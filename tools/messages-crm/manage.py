#!/usr/bin/env python
from __future__ import print_function
import argparse, json, os, shutil, subprocess, sys
from xml.sax.saxutils import escape
BASE = os.path.expanduser('~/Library/Application Support/HomebaseMessagesCRM')
LABEL = 'com.homebase.messages-metadata'
PLIST = os.path.expanduser('~/Library/LaunchAgents/' + LABEL + '.plist')
PYTHON = '/usr/bin/python'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['install', 'enable', 'disable', 'uninstall'])
    parser.add_argument('--approve-automation', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    if args.command == 'install':
        if not os.path.isfile(PYTHON) or not os.path.isfile('/usr/bin/sqlite3'):
            raise RuntimeError('Built-in Python and SQLite are required')
        if os.path.islink(BASE):
            raise RuntimeError('Installation directory must not be a symlink')
        if not os.path.isdir(BASE):
            os.makedirs(BASE, 0o700)
        if os.stat(BASE).st_uid != os.getuid():
            raise RuntimeError('Installation directory must be owned by this user')
        for name in ['collector.py', 'contacts.py', 'review.py', 'manage.py', 'config.example.json', 'config.json', LABEL + '.plist.disabled', 'AUTOMATION_APPROVED']:
            if os.path.islink(os.path.join(BASE, name)):
                raise RuntimeError('Installation files must not be symlinks')
        os.chmod(BASE, 0o700)
        source = os.path.dirname(os.path.abspath(__file__))
        for name in ['collector.py', 'contacts.py', 'review.py', 'manage.py', 'config.example.json']:
            target = os.path.join(BASE, name)
            if os.path.realpath(os.path.join(source, name)) != os.path.realpath(target):
                import tempfile
                fd, staged = tempfile.mkstemp(prefix='.install-', dir=BASE)
                os.close(fd)
                try:
                    shutil.copyfile(os.path.join(source, name), staged)
                    os.chmod(staged, 0o600)
                    os.rename(staged, target)
                finally:
                    if os.path.exists(staged): os.unlink(staged)
            os.chmod(target, 0o600)
        config = os.path.join(BASE, 'config.json')
        if not os.path.exists(config):
            shutil.copyfile(os.path.join(source, 'config.example.json'), config)
        os.chmod(config, 0o600)
        # Keep the template outside LaunchAgents: installing cannot start a job at login.
        xml = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.homebase.messages-metadata</string>
<key>ProgramArguments</key><array><string>/usr/bin/python</string><string>COLLECTOR</string><string>sync</string><string>--scheduled</string></array>
<key>RunAtLoad</key><true/><key>StartInterval</key><integer>900</integer>
<key>ProcessType</key><string>Background</string><key>LowPriorityIO</key><true/>
<key>StandardOutPath</key><string>OUT</string><key>StandardErrorPath</key><string>ERR</string>
</dict></plist>'''.replace('COLLECTOR', escape(os.path.join(BASE, 'collector.py'))).replace('OUT', escape(os.path.join(BASE, 'sync.log'))).replace('ERR', escape(os.path.join(BASE, 'sync-error.log')))
        with open(os.path.join(BASE, LABEL + '.plist.disabled'), 'w') as out:
            out.write(xml)
        print('Installed locally. No launch agent loaded or installed; no synchronization performed.')
    elif args.command == 'enable':
        if os.path.islink(PLIST) or os.path.islink(os.path.join(BASE, 'AUTOMATION_APPROVED')):
            raise RuntimeError('Automation files must not be symlinks')
        if not args.approve_automation:
            raise RuntimeError('Explicit automation approval required')
        import sqlite3
        db = sqlite3.connect(os.path.join(BASE, 'metadata.sqlite'))
        success = db.execute("SELECT value FROM meta WHERE key='last_success'").fetchone()
        relay_success = db.execute("SELECT value FROM meta WHERE key='relay_manual_success'").fetchone()
        with open(os.path.join(BASE, 'config.json')) as src:
            config = json.load(src)
        if config.get('endpoint') != 'https://homebase-messages-relay.carl-jeff.chatgpt.site/api/crm/ingest' or not relay_success:
            db.close()
            raise RuntimeError('A verified manual relay sync is required before scheduling')
        pending = db.execute("SELECT value FROM meta WHERE key='pending'").fetchone()
        db.close()
        if not success or pending:
            raise RuntimeError('A successful manual sync with no pending retry is required')
        directory = os.path.dirname(PLIST)
        if not os.path.isdir(directory):
            os.makedirs(directory, 0o700)
        with open(os.path.join(BASE, 'AUTOMATION_APPROVED'), 'w') as out:
            out.write('Explicit local automation approval\n')
        shutil.copyfile(os.path.join(BASE, LABEL + '.plist.disabled'), PLIST)
        subprocess.check_call(['/bin/launchctl', 'load', PLIST])
        print('LaunchAgent enabled for this logged-in account. Validate after reboot.')
    elif args.command == 'disable':
        if os.path.isfile(PLIST):
            subprocess.call(['/bin/launchctl', 'unload', PLIST])
            os.remove(PLIST)
        marker = os.path.join(BASE, 'AUTOMATION_APPROVED')
        if os.path.exists(marker):
            os.remove(marker)
        print('Automatic sync disabled. Manual tools and cache retained.')
    else:
        if os.path.isfile(PLIST):
            raise RuntimeError('Disable automation first')
        # No automatic deletion of credentials or local data. Revoke server-side first.
        print('Automation is absent. Revoke the collector in Homebase, then remove its two Keychain entries in Keychain Access and delete the HomebaseMessagesCRM folder when desired. Messages database is untouched.')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Management action failed. Verify prerequisites and approval; no Messages data was modified.', file=sys.stderr)
        sys.exit(1)
