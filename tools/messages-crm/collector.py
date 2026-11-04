#!/usr/bin/env python
"""Python 2.7/3 compatible, metadata-only Messages collector. No source writes."""
from __future__ import print_function, division
import argparse, binascii, collections, datetime, fcntl, getpass, hashlib, hmac, json, math, os, re, shlex, sqlite3, stat, subprocess, sys, threading, time, uuid, tempfile, calendar, decimal
try:
    from urllib.parse import quote
except ImportError:
    from urllib import quote
APPLE_EPOCH = 978307200
STAMP = '%Y-%m-%dT%H:%M:%SZ'
EXPECTED_ENDPOINT = 'https://homebase.carl-jeff.chatgpt.site/api/crm/ingest'
RELAY_ENDPOINT = 'https://homebase-messages-relay.carl-jeff.chatgpt.site/api/crm/ingest'
BASE = os.path.expanduser('~/Library/Application Support/HomebaseMessagesCRM')
SIGNING_SERVICE = 'com.homebase.messages.signing'
GATE_SERVICE = 'com.homebase.messages.sites-access'
class CollectorFailure(RuntimeError):
    pass

SAFE_ERROR = 'Collector failed; no source changes made. Check permissions, schema, credentials or network using the local diagnostics.'

def utc(value=None):
    return time.strftime(STAMP, time.gmtime(time.time() if value is None else value))

def normalize_handle(value):
    value = value.strip().lower()
    if '@' in value:
        return value if re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', value) else None
    value = re.sub(r'[\s().-]', '', value)
    if re.match(r'^\+\d{7,15}$', value):
        return value
    if re.match(r'^\d{10}$', value):
        return '+1' + value
    if re.match(r'^1\d{10}$', value):
        return '+' + value
    return None

def apple_time(value, now=None):
    try:
        n = decimal.Decimal(str(value))
        if not n.is_finite():
            return None
        scale = 1000000000 if abs(n) >= 10**16 else 1000000 if abs(n) >= 10**13 else 1000 if abs(n) >= 10**10 else 1
        seconds = decimal.Decimal(APPLE_EPOCH) + n / scale
        if n <= 0 or seconds > decimal.Decimal(str(time.time() if now is None else now)) + 300 or seconds < APPLE_EPOCH:
            return None
        return int(seconds), str(scale)
    except (ValueError, TypeError, OverflowError, decimal.InvalidOperation):
        return None

def private_json(path, data):
    temp = path + '.tmp'
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as out:
        json.dump(data, out, sort_keys=True, separators=(',', ':'))
    os.rename(temp, path)

def load_config(path):
    with open(path) as src:
        config = json.load(src)
    if set(config) - set(['database', 'device_id', 'endpoint', 'contacts', 'reconcile_hours']):
        raise ValueError('Unknown configuration fields')
    uuid.UUID(config['device_id'])
    if config.get('endpoint') not in (EXPECTED_ENDPOINT, RELAY_ENDPOINT):
        raise ValueError('HTTPS ingestion URL required')
    if len(config['contacts']) > 200:
        raise ValueError('Too many contact mappings')
    mappings = {}
    for contact in config['contacts']:
        if set(contact) != set(['contact_id', 'handles']):
            raise ValueError('Invalid local mapping')
        cid = str(uuid.UUID(contact['contact_id']))
        for raw in contact['handles']:
            handle = normalize_handle(raw)
            if not handle or handle in mappings and mappings[handle] != cid:
                raise ValueError('Invalid or conflicting local handle mapping')
            mappings[handle] = cid
    config['_mapping'] = mappings
    config['_mapping_hash'] = hashlib.sha256(json.dumps(sorted(mappings.items())).encode('utf-8')).hexdigest()
    return config

class Source(object):
    def __init__(self, path, runner=None):
        self.path = os.path.abspath(os.path.expanduser(path))
        if not os.path.isfile(self.path):
            raise IOError('Database missing')
        self.uri = 'file:' + quote(self.path, safe='/') + '?mode=ro'
        self.runner = runner
    def query(self, sql):
        # Only static allowlisted metadata SQL is supplied by this module.
        if self.runner:
            return self.runner(sql)
        for attempt in range(3):
            process = subprocess.Popen(['/usr/bin/sqlite3', '-batch', '-noheader', '-separator', '\t', self.uri], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            timer = threading.Timer(20, process.kill)
            timer.start()
            try:
                out, err = process.communicate(('.bail on\n.timeout 1500\nPRAGMA query_only=ON;\nBEGIN;\n' + sql + ';\nCOMMIT;\n').encode('utf-8'))
            finally:
                timer.cancel()
            if process.returncode == 0:
                return [line.split('\t') for line in out.decode('utf-8').splitlines()]
            if attempt < 2 and (b'locked' in err.lower() or b'busy' in err.lower()):
                time.sleep(0.25 * (attempt + 1))
                continue
            raise RuntimeError('Read-only metadata query failed')
        raise RuntimeError('Database busy')
    def columns(self, table):
        return set(row[1] for row in self.query('PRAGMA table_info(' + table + ')'))
    def inspect(self):
        columns = self.columns('message')
        if not set(['date', 'is_from_me', 'handle_id']).issubset(columns):
            raise ValueError('Required message metadata columns missing')
        if not set(['id']).issubset(self.columns('handle')):
            raise ValueError('Required handle metadata missing')
        self.message_columns = columns
        self.associations = set(['message_id', 'chat_id']).issubset(self.columns('chat_message_join')) and set(['chat_id', 'handle_id']).issubset(self.columns('chat_handle_join'))
        self.handles = {}
        for rowid, encoded in self.query('SELECT ROWID,hex(id) FROM handle'):
            try:
                raw = binascii.unhexlify(encoded).decode('utf-8')
                self.handles[int(rowid)] = normalize_handle(raw)
            except (ValueError, UnicodeError, binascii.Error):
                pass
        self.chats = collections.defaultdict(set)
        if self.associations:
            for chat, handle in self.query('SELECT chat_id,handle_id FROM chat_handle_join'):
                try:
                    self.chats[int(chat)].add(int(handle))
                except ValueError:
                    pass
        return self
    def messages(self, after, limit=500):
        system = 'COALESCE(m.item_type,0)' if 'item_type' in self.message_columns else '0'
        reaction = 'COALESCE(m.associated_message_type,0)' if 'associated_message_type' in self.message_columns else '0'
        chats = '(SELECT group_concat(DISTINCT chat_id) FROM chat_message_join WHERE message_id=m.ROWID)' if self.associations else "''"
        sql = 'SELECT m.ROWID,CASE WHEN typeof(m.date) IN (\'integer\',\'real\') THEN m.date ELSE NULL END,m.is_from_me,COALESCE(m.handle_id,0),' + system + ',' + reaction + ',' + chats + ',' + ('hex(m.guid)' if 'guid' in self.message_columns else "''") + ' FROM message m WHERE m.ROWID>' + str(int(after)) + ' ORDER BY m.ROWID LIMIT ' + str(int(limit))
        return self.query(sql)
    def totals(self):
        row = self.query('SELECT count(*),sum(CASE WHEN is_from_me=0 THEN 1 ELSE 0 END),sum(CASE WHEN is_from_me=1 THEN 1 ELSE 0 END),COALESCE(max(ROWID),0) FROM message')[0]
        linked = int(self.query('SELECT count(DISTINCT message_id) FROM chat_message_join WHERE message_id IN (SELECT ROWID FROM message)')[0][0]) if self.associations else 0
        return {'total': int(row[0]), 'incoming': int(row[1] or 0), 'outgoing': int(row[2] or 0), 'max_rowid': int(row[3]), 'linked': linked, 'unlinked': int(row[0]) - linked, 'handles': int(self.query('SELECT count(*) FROM handle')[0][0]), 'conversations': int(self.query('SELECT count(*) FROM chat')[0][0]) if self.columns('chat') else len(self.chats), 'direct_conversations': sum(len(v) == 1 for v in self.chats.values()), 'group_conversations': sum(len(v) > 1 for v in self.chats.values())}

def classify(row, source, mapping, now):
    rid, date, outgoing, sender, system, reaction, associations = row[:7]
    timestamp = apple_time(date, now)
    if timestamp is None:
        return [], 'invalidTimestamp', None
    if outgoing not in ('0', '1', 0, 1) or str(system) != '0' or str(reaction) != '0':
        return [], 'excluded', timestamp
    chats = set(int(c) for c in (associations or '').split(',') if c)
    if not chats:
        return [], 'unlinked', timestamp
    if len(chats) != 1:
        return [], 'ambiguous', timestamp
    participants = source.chats.get(next(iter(chats)), set())
    if not participants:
        return [], 'ambiguous', timestamp
    direction = int(outgoing)
    if len(participants) == 1:
        participant = next(iter(participants))
        if not direction and int(sender) != participant:
            return [], 'ambiguous', timestamp
        cids = set([mapping.get(source.handles.get(participant))])
        kind = 'direct'
    else:
        if not direction and int(sender) not in participants:
            return [], 'ambiguous', timestamp
        handles = participants if direction else [int(sender)]
        cids = set(mapping.get(source.handles.get(h)) for h in handles)
        kind = 'group'
    cids.discard(None)
    return [(cid, kind, direction, timestamp[0]) for cid in sorted(cids)], None if cids else 'unmatched', timestamp

def cache_open(path):
    if os.path.islink(path):
        raise ValueError('Cache must not be a symlink')
    existed = os.path.exists(path) and os.path.getsize(path) > 0
    db = sqlite3.connect(path)
    if existed and db.execute('PRAGMA application_id').fetchone()[0] != 1212302147:
        db.close(); raise ValueError('Unrecognized cache; refusing changes')
    db.execute('PRAGMA application_id=1212302147')
    os.chmod(path, 0o600)
    db.executescript('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT); CREATE TABLE IF NOT EXISTS messages (rid INTEGER PRIMARY KEY, reason TEXT, stamp INTEGER, identity TEXT); CREATE TABLE IF NOT EXISTS activity (rid INTEGER,contact TEXT,kind TEXT,outgoing INTEGER,stamp INTEGER,PRIMARY KEY(rid,contact)); CREATE INDEX IF NOT EXISTS activity_contact ON activity(contact,stamp);')
    return db

def get_meta(db, key, default=None):
    row = db.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
    return row[0] if row else default

def put_meta(db, key, value):
    db.execute('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)', (key, str(value)))

def collect(source, db, config, now=None, force=False):
    now = time.time() if now is None else now
    source.inspect()
    high = int(source.query('SELECT COALESCE(max(ROWID),0) FROM message')[0][0])
    cursor = int(get_meta(db, 'cursor', '0'))
    full = force or get_meta(db, 'mapping') != config['_mapping_hash'] or get_meta(db, 'source') != source.path or high < cursor or now - float(get_meta(db, 'reconcile', '0')) >= min(168, max(1, config.get('reconcile_hours', 24))) * 3600
    after = 0 if full else max(0, cursor - 100)
    if full:
        db.execute('DELETE FROM messages'); db.execute('DELETE FROM activity')
    seen, formats, scanned = set(), collections.Counter(), 0
    while True:
        rows = source.messages(after)
        if not rows:
            break
        for row in rows:
            rid = int(row[0]); seen.add(rid)
            entries, reason, stamp = classify(row, source, config['_mapping'], now)
            if stamp:
                formats[stamp[1]] += 1
            db.execute('DELETE FROM activity WHERE rid=?', (rid,))
            identity = hashlib.sha256(row[7].encode('ascii')).hexdigest() if len(row) > 7 and row[7] else 'row:' + str(rid)
            db.execute('INSERT OR REPLACE INTO messages VALUES (?,?,?,?)', (rid, reason, stamp[0] if stamp else None, identity))
            for cid, kind, outgoing, seconds in entries:
                db.execute('INSERT INTO activity VALUES (?,?,?,?,?)', (rid, cid, kind, outgoing, seconds))
            after = rid; scanned += 1
        if scanned >= 50000:
            # Bound work. A partial full reconciliation is not safe to publish.
            raise RuntimeError('Collection limit reached; local review required')
        if len(rows) < 500:
            break
    floor = 0 if full else max(0, cursor - 100)
    for (rid,) in db.execute('SELECT rid FROM messages WHERE rid>?', (floor,)).fetchall():
        if rid not in seen:
            db.execute('DELETE FROM messages WHERE rid=?', (rid,)); db.execute('DELETE FROM activity WHERE rid=?', (rid,))
    put_meta(db, 'partial', 0 if source.associations else 1)
    put_meta(db, 'cursor', max(high, after)); put_meta(db, 'source', source.path); put_meta(db, 'mapping', config['_mapping_hash'])
    if full:
        put_meta(db, 'reconcile', now)
    return {'scannedThisRun': scanned, 'fullReconciliation': bool(full), 'timestampFormats': dict(formats)}

def snapshot(db, config, now=None):
    now = time.time() if now is None else now
    cutoff = datetime.datetime.strptime(utc(now), STAMP).date() - datetime.timedelta(days=180)
    contacts = []
    for cid in sorted(set(config['_mapping'].values())):
        contact = {'contactId': cid, 'days': []}
        for kind in ['direct', 'group']:
            total = {'incoming': 0, 'outgoing': 0, 'lastIncoming': None, 'lastOutgoing': None}
            for outgoing, count, last in db.execute('SELECT outgoing,count(*),max(stamp) FROM activity WHERE contact=? AND kind=? AND rid IN (SELECT min(rid) FROM messages GROUP BY identity) GROUP BY outgoing', (cid, kind)):
                total['outgoing' if outgoing else 'incoming'] = count
                total['lastOutgoing' if outgoing else 'lastIncoming'] = utc(last)
            contact[kind] = total
        buckets = {}
        for day, kind, outgoing, count in db.execute("SELECT date(stamp,'unixepoch'),kind,outgoing,count(*) FROM activity WHERE contact=? AND stamp>=? AND rid IN (SELECT min(rid) FROM messages GROUP BY identity) GROUP BY date(stamp,'unixepoch'),kind,outgoing", (cid, calendar.timegm(cutoff.timetuple()))):
            d = buckets.setdefault(day, dict(day=day, directIn=0, directOut=0, groupIn=0, groupOut=0))
            d[kind + ('Out' if outgoing else 'In')] = count
        contact['days'] = [buckets[d] for d in sorted(buckets)]
        contacts.append(contact)
    quality = dict(unlinked=0, invalidTimestamp=0, ambiguous=0, unmatched=0, excluded=0, scanned=db.execute('SELECT count(*) FROM messages').fetchone()[0], partial=get_meta(db, 'partial', '0') == '1')
    for reason, count in db.execute('SELECT reason,count(*) FROM messages WHERE reason IS NOT NULL GROUP BY reason'):
        quality[reason] = count
    return dict(version=1, deviceId=config['device_id'], sequence=int(get_meta(db, 'sequence', '0')) + 1, generatedAt=utc(now), reconciledAt=utc(float(get_meta(db, 'reconcile', str(now)))), contacts=contacts, quality=quality)

def keychain_read(service):
    p = subprocess.Popen(['/usr/bin/security', 'find-generic-password', '-a', getpass.getuser(), '-s', service, '-w'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, unused = p.communicate()
    if p.returncode:
        raise CollectorFailure('Keychain key unavailable. Unlock the login Keychain, then retry; do not share its password.')
    return out.decode('utf-8').strip()

def keychain_write(service, secret):
    command = 'add-generic-password -U -a ' + shlex_quote(getpass.getuser()) + ' -s ' + shlex_quote(service) + ' -w ' + shlex_quote(secret) + '\n'
    p = subprocess.Popen(['/usr/bin/security', '-i'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    p.communicate(command.encode('utf-8'))
    if p.returncode or keychain_read(service) != secret:
        raise RuntimeError('Keychain setup failed')

def setup_credentials():
    # Interactive security mode accepts secret arguments on stdin, never argv/files.
    for service, label in [(SIGNING_SERVICE, 'Collector signing key'), (GATE_SERVICE, 'Sites service access token')]:
        secret = getpass.getpass(label + ': ')
        if not re.match(r'^[A-Za-z0-9_=-]{20,512}$', secret):
            raise ValueError('Unexpected credential format')
        command = 'add-generic-password -U -a ' + shlex_quote(getpass.getuser()) + ' -s ' + shlex_quote(service) + ' -w ' + shlex_quote(secret) + '\n'
        p = subprocess.Popen(['/usr/bin/security', '-i'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        p.communicate(command.encode('utf-8'))
        if p.returncode:
            raise RuntimeError('Keychain setup failed')
    print('Credentials saved to login Keychain. No synchronization performed.')

def shlex_quote(value):
    return "'" + value.replace("'", "'\\''") + "'"

def transmit(body, config):
    secret = keychain_read(SIGNING_SERVICE)
    relay = config['endpoint'] == RELAY_ENDPOINT
    gate = None if relay else keychain_read(GATE_SERVICE)
    if not re.match(r'^[a-f0-9]{64}$', secret) or (not relay and not re.match(r'^[A-Za-z0-9_=-]{20,512}$', gate)):
        raise ValueError('Invalid credentials')
    stamp = str(int(time.time()))
    digest = hashlib.sha256(body.encode('utf-8')).hexdigest()
    signature = hmac.new(secret.encode('ascii'), ('POST\n/api/crm/ingest\n' + stamp + '\n' + digest).encode('ascii'), hashlib.sha256).hexdigest()
    # Request body goes through a private local pipe; secrets only through curl config stdin.
    payload_file = tempfile.TemporaryFile()
    payload_file.write(body.encode('utf-8')); payload_file.seek(0)
    read_fd = payload_file.fileno()
    if hasattr(os, 'set_inheritable'):
        os.set_inheritable(read_fd, True)
    headers = ['Content-Type: application/json', 'X-CRM-Device: ' + config['device_id'], 'X-CRM-Time: ' + stamp, 'X-CRM-Signature: ' + signature, 'X-CRM-Body-SHA256: ' + digest, 'X-CRM-Key-Tag: ' + hashlib.sha256(secret.encode('ascii')).hexdigest()]
    if not relay:
        headers.append('OAI-Sites-Authorization: Bearer ' + gate)
    args = ['/usr/bin/curl', '--silent', '--show-error', '--fail', '--proto', '=https', '--tlsv1.2', '--connect-timeout', '15', '--max-time', '45', '--max-redirs', '0', '--config', '-', '--data-binary', '@/dev/fd/' + str(read_fd), config['endpoint']]
    curl_config = ''.join('header = "' + h + '"\n' for h in headers)
    # close_fds=False is required for the read-only payload descriptor on Python 2.7.
    p = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, close_fds=False)
    out, unused = p.communicate(curl_config.encode('ascii')); payload_file.close()
    if p.returncode:
        raise CollectorFailure('HTTPS request failed (curl status %d). The pending upload is preserved; check relay diagnostics before re-pairing.' % p.returncode)
    result = json.loads(out.decode('utf-8'))
    if result.get('accepted') is not True or result.get('digest') != digest:
        raise RuntimeError('Unexpected acknowledgement')
    return result

def main():
    parser = argparse.ArgumentParser(description='Read-only, metadata-only Homebase Messages collector')
    parser.add_argument('command', choices=['diagnose', 'dry-run', 'sync', 'health', 'credentials', 'export', 'pair'])
    parser.add_argument('--base-sequence', type=int)
    parser.add_argument('--output', default=os.path.expanduser('~/Downloads/homebase-messages-metadata.json'))
    parser.add_argument('--config', default=os.path.join(BASE, 'config.json'))
    parser.add_argument('--confirm-manual-sync', action='store_true')
    parser.add_argument('--scheduled', action='store_true')
    parser.add_argument('--reconcile', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    if args.command == 'credentials':
        setup_credentials(); return
    config = load_config(args.config)
    directory = os.path.dirname(os.path.abspath(args.config))
    if args.command == 'sync' and not args.confirm_manual_sync and not (args.scheduled and os.path.isfile(os.path.join(directory, 'AUTOMATION_APPROVED'))):
        raise ValueError('Manual or automation approval required')
    if os.path.islink(args.config) or os.path.islink(directory) or os.stat(args.config).st_uid != os.getuid() or os.stat(directory).st_uid != os.getuid() or stat.S_IMODE(os.stat(directory).st_mode) & 0o077:
        raise ValueError('Private owned configuration directory required')
    mode = stat.S_IMODE(os.stat(args.config).st_mode)
    if mode & 0o077:
        raise ValueError('Local mapping configuration must have mode 600')
    lock = open(os.path.join(directory, 'collector.lock'), 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    try:
        run_collector(args, config, directory)
    finally:
        lock.close()

def run_collector(args, config, directory):
    db = None
    try:
        source = Source(config['database'])
        if args.command == 'diagnose':
            source.inspect(); summary = source.totals(); summary['databaseMode'] = oct(stat.S_IMODE(os.stat(source.path).st_mode)); summary['ownedByCurrentUser'] = os.stat(source.path).st_uid == os.getuid(); summary['sourceWritableByOthers'] = bool(os.stat(source.path).st_mode & 0o022)
            print(json.dumps(summary, sort_keys=True)); return
        cache_path = os.path.join(directory, 'metadata.sqlite')
        if os.path.exists(cache_path) and os.path.samefile(cache_path, source.path):
            raise ValueError('Cache and source must differ')
        db = cache_open(cache_path)
        if args.command == 'pair':
            if os.path.exists(os.path.join(directory, 'AUTOMATION_APPROVED')):
                raise RuntimeError('Disable scheduling before pairing again')
            if args.base_sequence is None:
                try:
                    read_input = raw_input
                except NameError:
                    read_input = input
                args.base_sequence = int(read_input('Pairing base sequence shown in Homebase: '))
            if args.base_sequence < 0 or args.base_sequence > 9007199254740991:
                raise ValueError('Use the base sequence shown in Homebase')
            secret = getpass.getpass('Relay signing key (hidden): ').strip()
            if not re.match(r'^[a-f0-9]{64}$', secret):
                raise ValueError('Expected the relay signing key shown in Homebase')
            keychain_write(SIGNING_SERVICE, secret)
            # Pairing explicitly replaces only retry/cursor state. Rebuild source metadata on next sync.
            config_path = os.path.abspath(args.config)
            with open(config_path) as src:
                public_config = json.load(src)
            public_config['endpoint'] = RELAY_ENDPOINT
            private_json(config_path, public_config)
            put_meta(db, 'sequence', args.base_sequence)
            db.execute("DELETE FROM meta WHERE key IN ('pending','last_success','relay_manual_success')")
            put_meta(db, 'relay_paired', '1'); put_meta(db, 'reconcile', '0'); db.commit()
            print('Relay key saved to login Keychain. Retry state replaced; mappings and Messages unchanged. Scheduling remains disabled. Run one manual sync next.')
            return
        if args.command == 'health':
            print(json.dumps({'lastSuccess': get_meta(db, 'last_success'), 'relayPaired': get_meta(db, 'relay_paired') == '1', 'manualRelaySuccess': get_meta(db, 'relay_manual_success'), 'pendingRetry': get_meta(db, 'pending') is not None, 'sequence': int(get_meta(db, 'sequence', '0'))})); return
        if args.command == 'dry-run':
            # Use in-memory cache so dry runs cannot advance the real incremental cursor.
            db.close(); db = sqlite3.connect(':memory:'); db.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE messages(rid INTEGER PRIMARY KEY,reason TEXT,stamp INTEGER,identity TEXT);CREATE TABLE activity(rid INTEGER,contact TEXT,kind TEXT,outgoing INTEGER,stamp INTEGER,PRIMARY KEY(rid,contact));')
            info = collect(source, db, config, force=True)
            data = snapshot(db, config)
            info.update(data['quality']); stamps = db.execute('SELECT min(stamp),max(stamp) FROM messages').fetchone(); info['earliestUTC'] = utc(stamps[0]) if stamps[0] else None; info['latestUTC'] = utc(stamps[1]) if stamps[1] else None; info['matchedContacts'] = sum(c['direct']['incoming'] + c['direct']['outgoing'] + c['group']['incoming'] + c['group']['outgoing'] > 0 for c in data['contacts']); print(json.dumps(info, sort_keys=True)); return
        if args.command == 'export':
            collect(source, db, config, force=True)
            data = snapshot(db, config)
            data['sequence'] = max(data['sequence'], int(get_meta(db, 'export_sequence', '0')) + 1)
            output = os.path.abspath(os.path.expanduser(args.output))
            # Exclusive creation prevents overwriting source, configuration or existing exports.
            fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w') as out:
                json.dump(data, out, sort_keys=True, separators=(',', ':'))
            put_meta(db, 'export_sequence', data['sequence']); db.commit()
            print('Metadata export created privately. No network request made. Upload only through Homebase Friends; existing files are never overwritten.')
            return
        pending = get_meta(db, 'pending')
        if not pending:
            collect(source, db, config, force=args.reconcile)
            pending = json.dumps(snapshot(db, config), sort_keys=True, separators=(',', ':'))
            put_meta(db, 'pending', pending); db.commit()
        ack = transmit(pending, config)
        sequence = json.loads(pending)['sequence']
        if ack.get('sequence') != sequence:
            raise RuntimeError('Sequence acknowledgement mismatch')
        put_meta(db, 'sequence', sequence); put_meta(db, 'last_success', utc());
        if config['endpoint'] == RELAY_ENDPOINT and args.confirm_manual_sync:
            put_meta(db, 'relay_manual_success', utc())
        db.execute('DELETE FROM meta WHERE key=?', ('pending',)); db.commit()
        print('Metadata synchronization acknowledged. No content transmitted.')
    finally:
        if db is not None:
            db.close()

if __name__ == '__main__':
    try:
        try:
            os.nice(10)
        except OSError:
            pass
        main()
    except CollectorFailure as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Never echo SQL, handles, payloads, credentials, subprocess output or exceptions.
        print(SAFE_ERROR, file=sys.stderr)
        sys.exit(1)
