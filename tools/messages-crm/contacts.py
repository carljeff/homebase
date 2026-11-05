#!/usr/bin/env python
"""Selective local vCard matching. Only approved names/UUIDs cross the relay."""
from __future__ import print_function
import argparse, collections, fcntl, hashlib, json, os, re, stat, sys, tempfile, time, unicodedata, uuid
from contextlib import contextmanager
try:
    text_type = unicode
    read_input = raw_input
except NameError:
    text_type = str
    read_input = input
collector_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'collector.py')
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location('homebase_collector', collector_path)
    c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
except ImportError:
    import imp
    c = imp.load_source('homebase_collector', collector_path)
PENDING = 'contacts-import.pending.json'

class ContactError(RuntimeError):
    pass

def output(value):
    value = ''.join(ch if not unicodedata.category(ch).startswith('C') else ' ' for ch in text_type(value))
    print(value.encode('utf-8') if sys.version_info[0] < 3 else value)

def name_key(value):
    return ' '.join(unicodedata.normalize('NFKC', value).lower().split())

def valid_name(value):
    return isinstance(value, text_type) and 0 < len(value) <= 100 and value == value.strip() and '@' not in value and not any(unicodedata.category(ch).startswith('C') for ch in value) and not re.match(r'^\+?[\d\s().-]{7,}$', value)

def unescape(value):
    return re.sub(r'\\([nN,;\\])', lambda m: ' ' if m.group(1).lower() == 'n' else m.group(1), value)

def content_line(value):
    quoted = False
    for i, ch in enumerate(value):
        if ch == '"':
            quoted = not quoted
        if ch == ':' and not quoted:
            return value[:i], value[i + 1:]
    raise ContactError('Malformed vCard line. Export selected contacts as UTF-8 vCard 3.0 or 4.0.')

def structured_name(value):
    parts, current, escaped = [], [], False
    for ch in value:
        if escaped:
            current.extend(['\\', ch]); escaped = False
        elif ch == '\\':
            escaped = True
        elif ch == ';':
            parts.append(unescape(''.join(current))); current = []
        else:
            current.append(ch)
    if escaped:
        current.append('\\')
    parts.append(unescape(''.join(current)))
    parts += [''] * max(0, 5 - len(parts))
    return ' '.join(' '.join(parts[j].split()) for j in [3, 1, 2, 0, 4] if parts[j].strip())


def parse_vcards(path, max_cards=200, skip_invalid_names=True, stats=None):
    stats = {} if stats is None else stats
    stats.update(cards=0, usable=0, missingVersion=0, skippedNames=0, structuredNames=0, noHandles=0, duplicates=0)
    if not os.path.isfile(path):
        raise ContactError('vCard file not found. Check the --vcard path and filename.')
    if os.path.getsize(path) > 20000000:
        raise ContactError('vCard exceeds 20 MB. Export fewer contacts without photos.')
    with open(path, 'rb') as src:
        raw = src.read(20000001)
    if len(raw) > 20000000:
        raise ContactError('vCard exceeds 20 MB.')
    raw = raw.lstrip(b'\xef\xbb\xbf').replace(b'\r\n', b'\n').replace(b'\r', b'\n')
    lines = []
    for line in raw.split(b'\n'):
        if line.startswith((b' ', b'\t')) and lines:
            lines[-1].append(line[1:])
        elif line:
            lines.append([line])
    cards, current, seen_cards = [], None, set()
    for parts in lines:
        raw_line = b''.join(parts)
        try:
            line = raw_line.decode('utf-8')
        except UnicodeError:
            raise ContactError('Export vCard in UTF-8 format; no remote conversion is used.')
        if line.upper() == 'BEGIN:VCARD':
            if current is not None:
                raise ContactError('Nested vCards are not supported.')
            current = {'names': [], 'structured': [], 'handles': [], 'version': None}
            continue
        if line.upper() == 'END:VCARD':
            if current is None:
                raise ContactError('Unexpected END:VCARD; export a fresh vCard file.')
            stats['cards'] += 1
            if current['version'] is None:
                stats['missingVersion'] += 1; current = None; continue
            if current['version'] not in ('3.0', '4.0'):
                raise ContactError('Unsupported vCard version. Re-export as UTF-8 vCard 3.0 or 4.0.')
            name = next((' '.join(unescape(v).split()) for v in current['names'] if valid_name(' '.join(unescape(v).split()))), '')
            if not name:
                name = next((structured_name(v) for v in current['structured'] if valid_name(structured_name(v))), '')
                if name:
                    stats['structuredNames'] += 1
            if not valid_name(name):
                stats['skippedNames'] += 1
                if skip_invalid_names:
                    current = None
                    continue
                raise ContactError('A contact lacks a usable display name; no contact details were printed.')
            handles = sorted(set(current['handles']))
            if handles:
                card = {'name': name, 'handles': handles}
                identity = (name, tuple(handles))
                if identity not in seen_cards:
                    cards.append(card); seen_cards.add(identity); stats['usable'] += 1
                else:
                    stats['duplicates'] += 1
            else:
                stats['noHandles'] += 1
            current = None
            if len(cards) > max_cards:
                raise ContactError('Export exceeds the supported contact-card limit; split the local export.')
            continue
        if current is None:
            raise ContactError('Unexpected data outside a vCard.')
        header, value = content_line(line)
        field = header.split(';', 1)[0].split('.')[-1].upper()
        if field == 'VERSION':
            current['version'] = {'3': '3.0', '4': '4.0'}.get(value.strip(), value.strip())
        elif field in ('FN', 'N', 'TEL', 'EMAIL'):
            if 'ENCODING=' in header.upper() or 'CHARSET=' in header.upper():
                raise ContactError('Encoded text fields are unsupported. Export UTF-8 vCard 3.0/4.0.')
            if field == 'FN':
                current['names'].append(value)
            elif field == 'N':
                current['structured'].append(value)
            else:
                value = unescape(value).strip()
                if field == 'TEL' and value.lower().startswith('tel:'):
                    value = value[4:].split(';', 1)[0]
                if field == 'EMAIL' and value.lower().startswith('mailto:'):
                    value = value[7:]
                if field == 'TEL':
                    value = value.split(';', 1)[0]
                    value = re.sub(r'(?i)\s*(?:ext\.?|x|#)\s*\d+\s*$', '', value)
                    if re.search(r'[A-Za-z]', value):
                        continue
                handle = c.normalize_handle(value)
                if handle:
                    current['handles'].append(handle)
        # PHOTO, NOTE, ADR, birthday, UID and all other fields are ignored locally.
    if current is not None:
        raise ContactError('Unterminated vCard.')
    if not cards:
        raise ContactError('No usable cards remain. A supported version, display/structured name, and phone/email handle are required.')
    return cards

def read_cards(path, max_cards=200):
    stats = {}
    try:
        return parse_vcards(path, max_cards=max_cards, stats=stats)
    finally:
        if stats:
            output('vCard summary: %d cards, %d usable, %d structured-name fallbacks.' % (stats['cards'], stats['usable'], stats['structuredNames']))
            output('Skipped: %d missing version, %d missing/invalid names, %d without matching handles, %d duplicates.' % (stats['missingVersion'], stats['skippedNames'], stats['noHandles'], stats['duplicates']))


def selected_numbers(value, maximum, default_all=False):
    if not value.strip():
        return list(range(maximum)) if default_all else []
    result = set()
    for item in value.split(','):
        item = item.strip()
        if not item.isdigit() or not 1 <= int(item) <= maximum:
            raise ContactError('Use comma-separated numbers from the displayed list.')
        result.add(int(item) - 1)
    if len(result) > 25:
        raise ContactError('Choose at most 25 entries at a time.')
    return sorted(result)

def exact(value, keys):
    return isinstance(value, dict) and set(value) == set(keys.split())

def check_roster(value):
    if not exact(value, 'version action friends') or value['version'] != 1 or value['action'] != 'list' or not isinstance(value['friends'], list) or len(value['friends']) > 200:
        raise ContactError('Unexpected friend roster; nothing was changed.')
    ids = set()
    for friend in value['friends']:
        if not exact(friend, 'contactId name trackMessaging') or not isinstance(friend['name'], text_type) or len(friend['name']) > 100 or type(friend['trackMessaging']) is not bool:
            raise ContactError('Unexpected roster fields; nothing was changed.')
        ident = str(uuid.UUID(friend['contactId']))
        if ident in ids:
            raise ContactError('Duplicate friend IDs in roster.')
        ids.add(ident)
    return value['friends']

def request_for(plan):
    # Construct a fresh allowlist. Never serialize the plan's phone/email mappings.
    return {'version': 1, 'action': 'apply', 'selectionId': plan['selectionId'], 'contacts': [{'contactId': e['contactId'], 'name': e['name'], 'create': e['create']} for e in plan['contacts']]}

def check_receipt(value, plan):
    if not exact(value, 'version action selectionId contacts') or value['version'] != 1 or value['action'] != 'apply' or value['selectionId'] != plan['selectionId'] or not isinstance(value['contacts'], list):
        raise ContactError('Unexpected receipt. Keep the saved plan and retry; mappings were not changed.')
    expected = dict((e['contactId'], e['name']) for e in plan['contacts'])
    if len(value['contacts']) != len(expected) or any(not exact(e, 'contactId name') for e in value['contacts']) or dict((e['contactId'], e['name']) for e in value['contacts']) != expected:
        raise ContactError('Receipt does not match the approved selection; no mapping changes made.')

def atomic_json(path, value):
    fd, temp = tempfile.mkstemp(prefix='.contacts-', dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, 'w') as dst:
            json.dump(value, dst, ensure_ascii=True, sort_keys=True, separators=(',', ':'))
            dst.flush(); os.fsync(dst.fileno())
        os.rename(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

def load_private(path):
    if os.path.islink(path) or os.stat(path).st_uid != os.getuid() or stat.S_IMODE(os.stat(path).st_mode) & 0o077:
        raise ContactError('Private local file ownership/mode required; no changes made.')
    with open(path) as src:
        return json.load(src)

def config_digest(config):
    return hashlib.sha256(json.dumps(config, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()

@contextmanager
def locked(directory):
    path = os.path.join(directory, 'collector.lock')
    if os.path.islink(path):
        raise ContactError('Unexpected lock symlink.')
    with open(path, 'a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except IOError:
            raise ContactError('Collector is busy. Retry after its current run finishes.')
        yield

def ensure_no_upload_pending(directory, config):
    cache = os.path.join(directory, 'metadata.sqlite')
    if os.path.exists(cache):
        if os.path.samefile(cache, os.path.expanduser(config['database'])):
            raise ContactError('Cache/source paths must differ.')
        db = c.cache_open(cache)
        try:
            if c.get_meta(db, 'pending'):
                raise ContactError('Finish the pending metadata upload before changing mappings. The contact plan is saved.')
        finally:
            db.close()

def merge_mappings(config, entries):
    result = json.loads(json.dumps(config))
    by_id = {}
    owner = {}
    for contact in result['contacts']:
        cid = str(uuid.UUID(contact['contact_id']))
        by_id.setdefault(cid, set()).update(c.normalize_handle(h) for h in contact['handles'])
    for cid, handles in by_id.items():
        for handle in handles:
            if not handle or handle in owner and owner[handle] != cid:
                raise ContactError('Existing local mappings conflict; no changes made.')
            owner[handle] = cid
    for entry in entries:
        cid = entry['contactId']
        for raw in entry['handles']:
            handle = c.normalize_handle(raw)
            if not handle or handle in owner and owner[handle] != cid:
                raise ContactError('A selected handle belongs to a different friend. No mappings changed.')
            owner[handle] = cid; by_id.setdefault(cid, set()).add(handle)
    result['contacts'] = [{'contact_id': cid, 'handles': sorted(handles)} for cid, handles in sorted(by_id.items())]
    if len(result['contacts']) > 200:
        raise ContactError('Local contact limit exceeded.')
    return result

def validate_plan(plan):
    if not exact(plan, 'version selectionId configDigest contacts') or plan['version'] != 1 or not re.match(r'^[a-f0-9]{64}$', plan['configDigest']):
        raise ContactError('Invalid saved plan.')
    uuid.UUID(plan['selectionId'])
    if not isinstance(plan['contacts'], list) or not 1 <= len(plan['contacts']) <= 25:
        raise ContactError('Invalid contact selection.')
    ids = set()
    for entry in plan['contacts']:
        if not exact(entry, 'contactId name create handles') or not valid_name(entry['name']) or type(entry['create']) is not bool or not isinstance(entry['handles'], list) or not 1 <= len(entry['handles']) <= 50:
            raise ContactError('Invalid selected contact.')
        cid = str(uuid.UUID(entry['contactId']))
        if cid in ids:
            raise ContactError('Select each Homebase friend only once per import; combine duplicate cards in Contacts first.')
        ids.add(cid)
        if any(not isinstance(h, text_type) or c.normalize_handle(h) != h for h in entry['handles']):
            raise ContactError('Invalid handle in saved plan.')


def apply_plan(config_path, plan, send):
    validate_plan(plan)
    directory = os.path.dirname(os.path.abspath(config_path))
    with locked(directory):
        config = load_private(config_path)
        ensure_no_upload_pending(directory, config)
        merged = merge_mappings(config, plan['contacts'])
        already_applied = merged == config
        if config_digest(config) != plan['configDigest'] and not already_applied:
            raise ContactError('Configuration changed since selection. No mappings overwritten; keep the plan for review.')
        receipt = send(request_for(plan))
        check_receipt(receipt, plan)
        if not already_applied:
            backup = os.path.join(directory, 'contacts-backup-' + plan['selectionId'] + '.json')
            if os.path.exists(backup):
                if load_private(backup) != config:
                    raise ContactError('Backup differs; no local changes made.')
            else:
                atomic_json(backup, config)
            atomic_json(config_path, merged)
        pending = os.path.join(directory, PENDING)
        if os.path.exists(pending):
            os.rename(pending, os.path.join(directory, 'contacts-complete-' + plan['selectionId'] + '.json'))
    return len(plan['contacts'])

def choose_plan(cards, roster, config, ask=None):
    if ask is None:
        ask = read_input
    for number, card in enumerate(cards, 1):
        output('%d. %s (%d matching handles)' % (number, card['name'], len(card['handles'])))
    selected = selected_numbers(ask('Choose contacts (e.g. 1,3; Enter cancels): '), len(cards))
    if not selected:
        return None
    entries = []
    for index in selected:
        card = cards[index]
        if card.get('discovery'):
            output(card['discovery'])
        output('Local handles for ' + card['name'] + ':')
        for number, handle in enumerate(card['handles'], 1):
            output('  %d. %s' % (number, handle))
        picks = selected_numbers(ask('Choose handles (Enter keeps all): '), len(card['handles']), True)
        handles = [card['handles'][i] for i in picks]
        if not handles:
            continue
        output('Homebase friends (names/IDs only; no notes were downloaded):')
        for number, friend in enumerate(roster, 1):
            output('  %d. %s%s%s' % (number, friend['name'], ' [name match]' if name_key(friend['name']) == name_key(card['name']) else '', '' if friend['trackMessaging'] else ' [tracking off]'))
        choice = ask('Match existing friend number, N for a new friend, or S to skip: ').strip().lower()
        if choice == 's':
            continue
        if choice == 'n':
            if card.get('mappedId'):
                raise ContactError('This person already has a local Homebase mapping. Choose that existing friend instead of creating a duplicate.')
            if any(name_key(f['name']) == name_key(card['name']) for f in roster) and ask('A Homebase friend has this name. Type NEW to create a distinct person: ').strip() != 'NEW':
                raise ContactError('Cancelled. Choose the existing friend to avoid a duplicate.')
            entry = {'contactId': str(uuid.uuid4()), 'name': card['name'], 'create': True, 'handles': handles}
        elif choice.isdigit() and 1 <= int(choice) <= len(roster):
            friend = roster[int(choice) - 1]
            if card.get('mappedId') and card['mappedId'] != friend['contactId']:
                raise ContactError('This card already maps to another Homebase friend; no reassignment was made.')
            if not friend['trackMessaging']:
                raise ContactError('Enable messaging metadata for that friend in Homebase first, then restart selection.')
            entry = {'contactId': friend['contactId'], 'name': friend['name'], 'create': False, 'handles': handles}
        else:
            raise ContactError('Invalid friend selection; no changes made.')
        entries.append(entry)
    if not entries:
        return None
    plan = {'version': 1, 'selectionId': str(uuid.uuid4()), 'configDigest': config_digest(config), 'contacts': entries}
    validate_plan(plan); merge_mappings(config, entries)
    output('Review: only the following names and UUIDs will be sent to Homebase:')
    for entry in entries:
        output('  %s: %s (%d handles stay on this Mac)' % ('Create' if entry['create'] else 'Link existing', entry['name'], len(entry['handles'])))
    output('New friends will have messaging metadata enabled. Existing notes and reminders are unchanged.')
    return plan if ask('Type IMPORT to approve, or Enter to cancel: ').strip() == 'IMPORT' else None

def discover_contacts(source, cards, mapping, limit=10000, include_groups=False, include_mapped=False, now=None):
    if not 1 <= limit <= 50000:
        raise ContactError('Choose a message limit between 1 and 50000.')
    now = time.time() if now is None else now
    source.inspect()
    high = int(source.query('SELECT COALESCE(max(ROWID),0) FROM message')[0][0])
    # Indexed bounded read, newest recorded rows first. Never select message content.
    rows = source.messages(high, limit=limit, descending=True)
    index = collections.defaultdict(set)
    for number, card in enumerate(cards):
        for handle in card['handles']:
            index[handle].add(number)
    stats = {}; unmatched = set(); seen = set()
    summary = dict(scanned=len(rows), uniqueMessages=0, duplicates=0, invalidTimestamp=0, excluded=0, eligibleUnlinked=0, ambiguousMessages=0, ambiguousContactHandles=0, unmatchedHandles=0, alreadyMapped=0, groupOnlyOmitted=0, conflictingMappings=0)
    identity_map = dict((h, h) for h in source.handles.values() if h)
    ambiguous_handles = set()
    for row in reversed(rows):
        identity = ('guid:' + row[7]) if len(row) > 7 and row[7] else 'row:' + row[0]
        if identity in seen:
            summary['duplicates'] += 1; continue
        seen.add(identity); summary['uniqueMessages'] += 1
        entries, reason, unused = c.classify(row, source, identity_map, now)
        if reason in ('invalidTimestamp', 'excluded'):
            summary[reason] += 1
        elif reason == 'unlinked':
            summary['eligibleUnlinked'] += 1
        elif reason == 'ambiguous':
            summary['ambiguousMessages'] += 1
        message_people = set()
        for handle, kind, outgoing, stamp in entries:
            matches = index.get(handle, set())
            if len(matches) != 1:
                if matches: ambiguous_handles.add(handle)
                else: unmatched.add(handle)
                continue
            number = next(iter(matches)); token = (number, kind, outgoing)
            state = stats.setdefault(number, dict(directIn=0, directOut=0, groupIn=0, groupOut=0, last=0, observed=set()))
            state['observed'].add(handle)
            if token in message_people:
                continue
            message_people.add(token)
            key = ('direct' if kind == 'direct' else 'group') + ('Out' if outgoing else 'In')
            state[key] += 1; state['last'] = max(state['last'], stamp)
    summary['ambiguousContactHandles'] = len(ambiguous_handles); summary['unmatchedHandles'] = len(unmatched)
    candidates = []
    for number, state in stats.items():
        card = cards[number]
        # Shared handles are excluded from proposals, never guessed or reassigned.
        handles = [h for h in card['handles'] if len(index[h]) == 1]
        ids = set(mapping[h] for h in handles if h in mapping)
        if len(ids) > 1:
            summary['conflictingMappings'] += 1; continue
        mapped_id = next(iter(ids)) if ids else None
        new_observed = any(h not in mapping for h in state['observed'])
        if mapped_id and not new_observed and not include_mapped:
            summary['alreadyMapped'] += 1; continue
        if not state['directIn'] and not state['directOut'] and not include_groups:
            summary['groupOnlyOmitted'] += 1; continue
        item = dict(name=card['name'], handles=handles, mappedId=mapped_id)
        item['activity'] = dict((key, state[key]) for key in ['directIn', 'directOut', 'groupIn', 'groupOut', 'last'])
        item['discovery'] = 'Direct: %d incoming / %d outgoing; group: %d incoming / %d outgoing; last UTC: %s%s' % (state['directIn'], state['directOut'], state['groupIn'], state['groupOut'], c.utc(state['last']), ' [existing mapping: choose its Homebase friend]' if mapped_id else '')
        candidates.append(item)
    candidates.sort(key=lambda item: (-(item['activity']['directIn'] + item['activity']['directOut'] > 0), -(item['activity']['directIn'] + item['activity']['directOut']), -item['activity']['last'], name_key(item['name'])))
    summary['candidates'] = len(candidates)
    return candidates, summary

def show_discovery(cards, summary):
    output('Local discovery: %d newest recorded rows; %d review candidates; %d already mapped; %d unmatched handles; %d ambiguous contact handles.' % (summary['scanned'], summary['candidates'], summary['alreadyMapped'], summary['unmatchedHandles'], summary['ambiguousContactHandles']))
    output('Excluded: %d invalid dates, %d non-personal events, %d eligible unlinked, %d ambiguous messages, %d group-only people omitted, %d conflicting existing mappings.' % (summary['invalidTimestamp'], summary['excluded'], summary['eligibleUnlinked'], summary['ambiguousMessages'], summary['groupOnlyOmitted'], summary['conflictingMappings']))
    for number, card in enumerate(cards, 1):
        output('%d. %s - %s' % (number, card['name'], card['discovery']))
    output('Names and activity above are local only. Group activity is separate from direct outreach; counts do not measure relationship quality.')
    output('Discovery does not change mappings, upload cursors or the sync schedule. Use discover-import to review selections before importing.')

def main():
    parser = argparse.ArgumentParser(description='Local selective vCard import; phone/email matching stays on this Mac')
    parser.add_argument('command', choices=['preview', 'import', 'resume', 'restore', 'cancel', 'discover', 'discover-import', 'vcard-info'])
    parser.add_argument('--vcard')
    parser.add_argument('--limit', type=int, default=10000)
    parser.add_argument('--include-groups', action='store_true')
    parser.add_argument('--include-mapped', action='store_true')
    parser.add_argument('--backup')
    parser.add_argument('--config', default=os.path.join(c.BASE, 'config.json'))
    args = parser.parse_args(); os.umask(0o077)
    if args.command == 'vcard-info':
        read_cards(os.path.expanduser(args.vcard or ''), max_cards=10000)
        return
    if args.command == 'preview':
        for number, card in enumerate(read_cards(os.path.expanduser(args.vcard or '')), 1):
            output('%d. %s (%d handles; local only)' % (number, card['name'], len(card['handles'])))
        return
    directory = os.path.dirname(os.path.abspath(args.config))
    if os.path.islink(directory) or os.stat(directory).st_uid != os.getuid() or stat.S_IMODE(os.stat(directory).st_mode) & 0o077:
        raise ContactError('Private owned collector directory required.')
    config = load_private(args.config); validated = c.load_config(args.config)
    pending = os.path.join(directory, PENDING)
    if args.command == 'cancel':
        with locked(directory):
            plan = load_private(pending); validate_plan(plan)
            if read_input('Type CANCEL to archive this saved plan (created Homebase friends remain): ').strip() == 'CANCEL':
                os.rename(pending, os.path.join(directory, 'contacts-cancelled-' + plan['selectionId'] + '.json'))
                output('Saved plan archived privately. No mappings or Homebase friends deleted.')
        return
    if args.command == 'restore':
        with locked(directory):
            if os.path.exists(pending):
                raise ContactError('Resume or cancel the saved contact plan before restoring mappings.')
            backup_path = os.path.abspath(os.path.expanduser(args.backup or ''))
            if os.path.dirname(backup_path) != directory or not os.path.basename(backup_path).startswith('contacts-backup-'):
                raise ContactError('Choose a contact backup in the private collector directory.')
            old = load_private(backup_path); c.load_config(backup_path)
            if old['device_id'] != config['device_id'] or old['endpoint'] != config['endpoint']:
                raise ContactError('Backup uses a different pairing; do not restore it over current settings.')
            ensure_no_upload_pending(directory, config)
            if read_input('Type RESTORE to restore this mapping backup (Homebase friends remain): ').strip() != 'RESTORE':
                return
            safety = os.path.join(directory, 'contacts-backup-' + str(uuid.uuid4()) + '.json')
            atomic_json(safety, config); atomic_json(args.config, old)
        output('Mapping backup restored. No Homebase friends or Messages were deleted.'); return
    discovery_cards = None
    if args.command in ('discover', 'discover-import'):
        book = read_cards(os.path.expanduser(args.vcard or ''), max_cards=10000)
        source = c.Source(config['database'])
        discovery_cards, summary = discover_contacts(source, book, validated['_mapping'], limit=args.limit, include_groups=args.include_groups, include_mapped=args.include_mapped)
        show_discovery(discovery_cards, summary)
        if args.command == 'discover' or not discovery_cards:
            return
    if config['endpoint'] != c.RELAY_ENDPOINT:
        raise ContactError('Pair the authenticated relay before contact import.')
    def send(payload):
        return c.transmit(json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(',', ':')), validated, '/api/crm/contacts')
    if args.command == 'resume':
        plan = load_private(pending); validate_plan(plan)
        output('The saved plan will be retried with the same contact IDs to prevent duplicate creation.')
        if read_input('Type IMPORT to retry the previously approved names: ').strip() != 'IMPORT':
            return
    else:
        if os.path.exists(pending):
            raise ContactError('A saved import is pending. Use resume before starting another.')
        cards = discovery_cards if discovery_cards is not None else read_cards(os.path.expanduser(args.vcard or ''))
        roster = check_roster(send({'version': 1, 'action': 'list'}))
        plan = choose_plan(cards, roster, config)
        if not plan:
            output('Cancelled. No Homebase or mapping changes made.'); return
        with locked(directory):
            if os.path.exists(pending) or load_private(args.config) != config:
                raise ContactError('Another change occurred. Restart selection.')
            atomic_json(pending, plan)
    count = apply_plan(args.config, plan, send)
    output('Imported/linked %d friends. Phone/email mappings saved locally with a private backup. Existing sync scheduling is unchanged.' % count)
    output('The collector will reconcile the new mappings on its next scheduled run. Refresh Friends after that run.')

if __name__ == '__main__':
    try:
        main()
    except (ContactError, c.CollectorFailure) as error:
        output(str(error)); sys.exit(1)
    except Exception:
        output('Contact operation failed safely. No contact fields or exception details were logged. Keep any pending plan and retry with resume.'); sys.exit(1)
