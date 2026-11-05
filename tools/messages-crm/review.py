#!/usr/bin/env python
"""Opt-in outbound-contact review. Raw phone/email handles never leave this Mac."""
from __future__ import print_function
import argparse, hashlib, hmac, json, os, stat, subprocess, sys, threading, time, uuid
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location('review_contacts', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contacts.py'))
    d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)
except ImportError:
    import imp
    d = imp.load_source('review_contacts', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contacts.py'))
c = d.c
SETTINGS = 'contact-review-settings.json'
STATE = 'contact-review-state.json'
# Read-only scripting dictionary access. No Contacts updates, Messages content or GUI clicks.
CONTACTS_SCRIPT = '''var book=Application('Contacts');
var people=book.people();
if(people.length>10000)throw Error('Contact limit');
JSON.stringify(people.map(function(p){return {name:p.name(),handles:p.phones.value().concat(p.emails.value())};}));'''


def native_cards(runner=None):
    if runner is None:
        def runner(args):
            process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, close_fds=True)
            def expire():
                try:
                    process.kill()
                except OSError:
                    pass
            timer = threading.Timer(30, expire); timer.daemon = True; timer.start()
            try:
                out, unused = process.communicate()
            finally:
                timer.cancel()
            if process.returncode:
                raise d.ContactError('Mac Contacts could not be read. Authorize access locally or use the vCard option.')
            return out
    raw = runner(['/usr/bin/osascript', '-l', 'JavaScript', '-e', CONTACTS_SCRIPT])
    if len(raw) > 20000000:
        raise d.ContactError('Contacts response too large.')
    values = json.loads(raw.decode('utf-8') if isinstance(raw, bytes) else raw)
    if not isinstance(values, list) or len(values) > 10000:
        raise d.ContactError('Unexpected Contacts response.')
    cards = []
    for value in values:
        if not d.exact(value, 'name handles') or not isinstance(value['handles'], list) or len(value['handles']) > 50:
            raise d.ContactError('Unexpected Contacts fields. No data transmitted.')
        if not d.valid_name(value['name']):
            continue
        if any(not isinstance(handle, d.text_type) for handle in value['handles']):
            raise d.ContactError('Unexpected contact handle.')
        handles = sorted(set(c.normalize_handle(h) for h in value['handles']) - set(['']))
        if handles:
            cards.append(dict(name=value['name'].strip(), handles=handles))
    return cards


def read_source(settings):
    if settings['source'] == 'contacts':
        return native_cards()
    return d.parse_vcards(settings['vcard'], max_cards=10000, skip_invalid_names=True)


def settings_for(args, directory):
    path = os.path.join(directory, SETTINGS)
    saved = d.load_private(path) if os.path.exists(path) else {}
    source = args.source or saved.get('source', 'contacts')
    vcard = os.path.abspath(os.path.expanduser(args.vcard)) if args.vcard else saved.get('vcard', '')
    if source == 'vcard' and not vcard:
        raise d.ContactError('Choose a local vCard file first.')
    return saved, dict(source=source, vcard=vcard, limit=args.limit or saved.get('limit', 10000))


def candidate_id(secret, card):
    value = d.name_key(card['name']) + '\n' + '\n'.join(sorted(card['handles']))
    return hmac.new(secret.encode('ascii'), ('homebase-contact-review-v1:' + value).encode('utf-8'), hashlib.sha256).hexdigest()


def scan(config, settings, state, now=None, book=None, source=None):
    now = time.time() if now is None else now
    book = read_source(settings) if book is None else book
    source = c.Source(config['database']) if source is None else source
    source.inspect()
    high = int(source.query('SELECT COALESCE(max(ROWID),0) FROM message')[0][0])
    book_hash = hashlib.sha256(json.dumps(book, sort_keys=True, ensure_ascii=True).encode('utf-8')).hexdigest()
    # Avoid repeated source scans when neither messages nor Contacts changed. Daily rebuild
    # handles deletions/association changes. Every rebuild is bounded to newest recorded rows.
    if state.get('high') == high and state.get('bookHash') == book_hash and state.get('mappingHash') == config['_mapping_hash'] and now - state.get('scannedAt', 0) < 86400:
        cards = state.get('cards', [])
        scanned_at = state['scannedAt']
    else:
        scanned_at = now
        cards, unused = d.discover_contacts(source, book, config['_mapping'], limit=settings['limit'], now=now, outbound_only=True)
    # The existing discovery path excludes reactions, system events, ambiguous/unlinked
    # associations, incoming-only senders and all group-only participants.
    eligible = [card for card in cards if card['activity']['directOut'] > 0 and card['activity']['last'] >= now - 90 * 86400]
    eligible.sort(key=lambda card: (-card['activity']['last'], d.name_key(card['name'])))
    return eligible, dict(high=high, bookHash=book_hash, mappingHash=config['_mapping_hash'], scannedAt=scanned_at, cards=eligible)


def publish_entries(cards, secret, closed):
    local = {}
    for card in cards:
        ident = candidate_id(secret, card)
        local[ident] = card
    proposals = []
    for ident, card in local.items():
        if ident in closed:
            continue
        proposals.append(dict(candidateId=ident, name=card['name'], directOut=card['activity']['directOut'], lastOutgoing=c.utc(card['activity']['last']), existingContactId=card.get('mappedId')))
    proposals.sort(key=lambda card: (card['lastOutgoing'], card['candidateId']), reverse=True)
    return proposals[:50], local


def check_decisions(value):
    if not d.exact(value, 'version action decisions') or value['version'] != 1 or value['action'] != 'review-sync' or not isinstance(value['decisions'], list) or len(value['decisions']) > 50:
        raise d.ContactError('Unexpected contact-review receipt. No mappings changed.')
    seen = set()
    for decision in value['decisions']:
        if not d.exact(decision, 'candidateId status contactId') or not isinstance(decision['candidateId'], d.text_type) or len(decision['candidateId']) != 64 or any(ch not in '0123456789abcdef' for ch in decision['candidateId']) or decision['candidateId'] in seen:
            raise d.ContactError('Invalid contact-review receipt.')
        seen.add(decision['candidateId'])
        if decision['status'] == 'ignored':
            if decision['contactId'] is not None:
                raise d.ContactError('Invalid ignore receipt.')
        elif decision['status'] == 'approved':
            if str(uuid.UUID(decision['contactId'])) != decision['contactId']:
                raise d.ContactError('Invalid approved contact ID.')
        else:
            raise d.ContactError('Unknown contact-review decision.')
    return value['decisions']


def synchronize(config_path, config, settings, state, cards, scan_state, secret, send, now=None):
    now = time.time() if now is None else now
    closed = set(state.get('closed', []))
    proposals, local = publish_entries(cards, secret, closed)
    acknowledgements = list(state.get('applied', []))
    current_config = c.load_config(config_path)
    remaining_plans = []
    for plan in state.get('applying', []):
        if all(current_config['_mapping'].get(h) == plan['contactId'] for h in plan['handles']):
            ack = dict(candidateId=plan['candidateId'], contactId=plan['contactId'])
            if ack not in acknowledgements:
                acknowledgements.append(ack)
            closed.add(plan['candidateId'])
        else:
            remaining_plans.append(plan)
    payload = dict(version=1, action='review-sync', candidates=proposals, applied=acknowledgements)
    encoded = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    if len(encoded) > 50000:
        raise d.ContactError('Review payload exceeds the metadata limit. No upload attempted.')
    decisions = check_decisions(send(payload))
    entries = []; applied = []; plans = []
    for decision in decisions:
        ident = decision['candidateId']
        if decision['status'] == 'ignored':
            closed.add(ident); continue
        # Approvals must still identify the exact locally known Contacts name/handles.
        # A rename, reassigned/shared handle or missing card cannot silently remap someone.
        card = local.get(ident)
        if not card:
            continue
        mapped = card.get('mappedId')
        if mapped and mapped != decision['contactId']:
            raise d.ContactError('Approved person conflicts with an existing local mapping.')
        entries.append(dict(contactId=decision['contactId'], handles=card['handles']))
        applied.append(dict(candidateId=ident, contactId=decision['contactId']))
        plans.append(dict(candidateId=ident, contactId=decision['contactId'], handles=card['handles']))
        closed.add(ident)
    directory = os.path.dirname(os.path.abspath(config_path))
    current = d.load_private(config_path)
    d.ensure_no_upload_pending(directory, current)
    merged = d.merge_mappings(current, entries)
    # Journal approval intent before the atomic mapping write. A crash after that write
    # can safely acknowledge mappings already present, even if Contacts/source changed.
    journal = dict(state, applying=plans + [p for p in remaining_plans if p['candidateId'] not in set(a['candidateId'] for a in plans)])
    d.atomic_json(os.path.join(directory, STATE), journal)
    if merged != current:
        backup = os.path.join(directory, 'contacts-backup-' + str(uuid.uuid4()) + '.json')
        d.atomic_json(backup, current); d.atomic_json(config_path, merged)
    # Persist acknowledgements before sending them. A lost response can be retried
    # without adding mappings or creating friends a second time.
    result = dict(scan_state, closed=sorted(closed), applied=applied, applying=journal['applying'], lastSuccess=c.utc(now), keyTag=hashlib.sha256(secret.encode('ascii')).hexdigest())
    d.atomic_json(os.path.join(directory, STATE), result)
    if applied:
        check_decisions(send(dict(version=1, action='review-sync', candidates=[], applied=applied)))
        result['applied'] = []; result['applying'] = remaining_plans
        d.atomic_json(os.path.join(directory, STATE), result)
    return len(proposals), len(applied)


def main():
    parser = argparse.ArgumentParser(description='Private outbound-contact inbox; Apple message content is never collected')
    parser.add_argument('command', choices=['dry-run', 'sync', 'enable', 'disable', 'health'])
    parser.add_argument('--source', choices=['contacts', 'vcard'])
    parser.add_argument('--vcard')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--config', default=os.path.join(c.BASE, 'config.json'))
    parser.add_argument('--confirm-manual-sync', action='store_true')
    parser.add_argument('--approve-automation', action='store_true')
    parser.add_argument('--scheduled', action='store_true')
    args = parser.parse_args(); os.umask(0o077)
    config_path = os.path.abspath(os.path.expanduser(args.config)); directory = os.path.dirname(config_path)
    if os.path.islink(directory) or os.stat(directory).st_uid != os.getuid() or stat.S_IMODE(os.stat(directory).st_mode) & 0o077:
        raise d.ContactError('Private collector directory required.')
    config = c.load_config(config_path); d.load_private(config_path)
    saved, settings = settings_for(args, directory)
    if not 1 <= settings['limit'] <= 10000:
        raise d.ContactError('Choose a review limit from 1 to 10000.')
    state_path = os.path.join(directory, STATE)
    state = d.load_private(state_path) if os.path.exists(state_path) else {}
    if args.command == 'health':
        print(json.dumps(dict(enabled=bool(saved.get('enabled')),lastSuccess=state.get('lastSuccess'),manualSuccess=saved.get('manualSuccess'),pendingMappingAcks=len(state.get('applied', []))), sort_keys=True)); return
    if args.command == 'disable':
        saved['enabled'] = False; d.atomic_json(os.path.join(directory, SETTINGS), saved)
        print('Contact review disabled. Activity synchronization and approved mappings unchanged.'); return
    if args.command == 'enable':
        if not args.approve_automation or not saved.get('manualSuccess') or saved.get('deviceId') != config['device_id'] or any(saved.get(k) != settings[k] for k in ['source', 'vcard', 'limit']) or not os.path.isfile(os.path.join(directory, 'AUTOMATION_APPROVED')):
            raise d.ContactError('Validate a manual review sync, then explicitly approve contact-review automation. Existing activity automation must already be approved.')
        saved['enabled'] = True; d.atomic_json(os.path.join(directory, SETTINGS), saved)
        print('Contact review enabled on the existing collector schedule, at most every 30 minutes.'); return
    if args.command == 'sync' and args.scheduled:
        if not saved.get('enabled') or not os.path.isfile(os.path.join(directory, 'AUTOMATION_APPROVED')):
            return
        if time.time() - state.get('checkedAt', 0) < 1800:
            return
    elif args.command == 'sync' and not args.confirm_manual_sync:
        raise d.ContactError('Use --confirm-manual-sync after a local-only dry run.')
    with d.locked(directory):
        config = c.load_config(config_path)
        if os.path.exists(os.path.join(directory, d.PENDING)):
            raise d.ContactError('Finish the older contact-import plan before starting review sync.')
        cards, scanned = scan(config, settings, state)
        if args.command == 'dry-run':
            print(json.dumps(dict(directOutboundCandidates=len(cards),source=settings['source'],uploads=0,mappingChanges=0),sort_keys=True)); return
        if config['endpoint'] != c.RELAY_ENDPOINT:
            raise d.ContactError('Existing authenticated relay pairing required.')
        secret = c.keychain_read(c.SIGNING_SERVICE)
        if state.get('keyTag') and state['keyTag'] != hashlib.sha256(secret.encode('ascii')).hexdigest():
            state = {}
        def send(payload):
            return c.transmit(json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(',', ':')), config, '/api/crm/contacts')
        state['checkedAt'] = time.time()
        d.atomic_json(state_path, state)
        proposed, applied = synchronize(config_path, config, settings, state, cards, scanned, secret, send)
        latest = d.load_private(state_path); latest['checkedAt'] = time.time(); d.atomic_json(state_path, latest)
        previous_source = all(saved.get(k) == settings[k] for k in ['source', 'vcard', 'limit'])
        settings.update(enabled=bool(saved.get('enabled')) and previous_source,deviceId=config['device_id'],manualSuccess=c.utc() if args.confirm_manual_sync else saved.get('manualSuccess'))
        d.atomic_json(os.path.join(directory, SETTINGS), settings)
        print('Contact review acknowledged: %d candidate names, %d approved mappings applied. No phone/email handles or message content transmitted.' % (proposed, applied))

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Contact review failed safely. Check local Contacts permission, Keychain, pairing or network. Existing activity sync and Messages are unchanged.', file=sys.stderr)
        sys.exit(1)
