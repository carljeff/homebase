#!/usr/bin/env python
"""Keep the two GUI apps available; never kill apps or access message/contact content."""
from __future__ import print_function
import argparse, datetime, fcntl, json, os, stat, subprocess, sys, tempfile, threading, time
from xml.sax.saxutils import escape
BASE = os.path.expanduser('~/Library/Application Support/HomebaseMessagesCRM')
LABEL = 'com.homebase.app-guard'
PLIST = os.path.expanduser('~/Library/LaunchAgents/' + LABEL + '.plist')
STATE = 'app-guard-health.json'
APPS = ('Messages', 'Contacts')


def run(args, timeout=15):
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, close_fds=True)
    def stop_probe():
        try: process.kill()  # Only our short-lived pgrep/open/osascript child, never an app.
        except OSError: pass
    timer = threading.Timer(timeout, stop_probe); timer.daemon = True; timer.start()
    try:
        out, unused = process.communicate()
        return process.returncode, out
    finally: timer.cancel()


def check(runner=run, uid=None):
    uid = os.getuid() if uid is None else uid
    code, value = runner(['/usr/bin/stat', '-f', '%u', '/dev/console'])
    if code or value.strip() != str(uid).encode('ascii'):
        return {'status': 'no_active_desktop', 'apps': {}}
    apps = {}
    for app in APPS:
        code, unused = runner(['/usr/bin/pgrep', '-u', str(uid), '-x', app])
        if code == 1:
            opened, unused = runner(['/usr/bin/open', '-g', '-a', app])
            if opened:
                apps[app] = 'open_failed'; continue
            code, unused = runner(['/usr/bin/pgrep', '-u', str(uid), '-x', app])
            apps[app] = 'reopened' if code == 0 else 'starting_or_unavailable'
        elif code == 0:
            apps[app] = 'running'
        else:
            apps[app] = 'process_check_failed'
    if apps.get('Contacts') in ('running', 'reopened'):
        code, value = runner(['/usr/bin/osascript', '-l', 'JavaScript', '-e', 'Application("Contacts").people.length'])
        if code or not value.strip().isdigit():
            apps['Contacts'] = 'not_responding_or_access_denied'
    healthy = all(apps.get(app) in ('running', 'reopened') for app in APPS)
    return {'status': 'healthy' if healthy else 'needs_attention', 'apps': apps}


def private_directory():
    if os.path.islink(BASE) or not os.path.isdir(BASE): raise RuntimeError('Existing collector directory required')
    info = os.stat(BASE)
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077: raise RuntimeError('Private owned directory required')


def safe_path(path):
    if os.path.lexists(path):
        info = os.lstat(path)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1: raise RuntimeError('Unsafe file')


def save(path, data):
    safe_path(path)
    fd, staged = tempfile.mkstemp(prefix='.app-guard-', dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, 'w') as out: out.write(data)
        os.chmod(staged, 0o600); os.rename(staged, path)
    finally:
        if os.path.exists(staged): os.unlink(staged)


def template(script):
    return '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.homebase.app-guard</string>
<key>ProgramArguments</key><array><string>/usr/bin/python</string><string>SCRIPT</string><string>check</string></array>
<key>LimitLoadToSessionType</key><string>Aqua</string>
<key>RunAtLoad</key><true/><key>StartInterval</key><integer>300</integer>
<key>ProcessType</key><string>Background</string><key>LowPriorityIO</key><true/>
<key>StandardOutPath</key><string>/dev/null</string><key>StandardErrorPath</key><string>/dev/null</string>
</dict></plist>'''.replace('SCRIPT', escape(script))


def main():
    parser = argparse.ArgumentParser(description='Local Messages/Contacts availability guard; no content or network access')
    parser.add_argument('command', choices=['check', 'health', 'enable', 'disable'])
    parser.add_argument('--approve-automation', action='store_true')
    args = parser.parse_args(); os.umask(0o077); private_directory()
    state_path = os.path.join(BASE, STATE)
    if args.command == 'check':
        path = os.path.join(BASE, 'app-guard.lock'); safe_path(path)
        with open(path, 'a') as lock:
            try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except IOError:
                print('App check already running.'); return
            result = check(); result['checkedAt'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'); result['checkedEpoch'] = time.time()
            save(state_path, json.dumps(result, sort_keys=True)); print(json.dumps(result, sort_keys=True))
    elif args.command == 'health':
        safe_path(state_path)
        if not os.path.isfile(state_path): print('Run a manual check first.'); return
        with open(state_path) as src: result = json.load(src)
        # Never echo arbitrary local file contents.
        print(json.dumps({'status': result.get('status') if result.get('status') in ('healthy','needs_attention','no_active_desktop') else 'unknown', 'checkedAt': result.get('checkedAt'), 'stale': time.time() - result.get('checkedEpoch', 0) > 600, 'scheduled': os.path.isfile(PLIST)}, sort_keys=True))
    elif args.command == 'enable':
        if not args.approve_automation: raise RuntimeError('Explicit approval required')
        safe_path(state_path)
        with open(state_path) as src: state = json.load(src)
        if state.get('status') != 'healthy' or not 0 <= time.time() - state.get('checkedEpoch', 0) < 600: raise RuntimeError('Recent healthy manual check required')
        script = os.path.abspath(__file__); safe_path(script)
        if os.path.dirname(script) != BASE: raise RuntimeError('Install script in collector directory first')
        directory = os.path.dirname(PLIST)
        if os.path.islink(directory): raise RuntimeError('Unsafe LaunchAgents directory')
        if not os.path.isdir(directory): os.makedirs(directory, 0o700)
        if os.stat(directory).st_uid != os.getuid(): raise RuntimeError('Owned LaunchAgents directory required')
        safe_path(PLIST)
        if os.path.exists(PLIST): raise RuntimeError('Already installed; disable before changing')
        save(PLIST, template(script))
        code, unused = run(['/bin/launchctl', 'load', '-S', 'Aqua', PLIST])
        if code:
            os.unlink(PLIST); raise RuntimeError('Load from Terminal in the logged-in desktop session')
        print('App guard enabled every five minutes for the logged-in desktop. Existing sync unchanged.')
    else:
        safe_path(PLIST)
        if os.path.exists(PLIST):
            code, unused = run(['/bin/launchctl', 'unload', '-S', 'Aqua', PLIST])
            if code: raise RuntimeError('Unload from Terminal in the logged-in desktop session')
            os.unlink(PLIST)
        print('App guard disabled. Messages, Contacts and the existing sync schedule were left unchanged.')

if __name__ == '__main__':
    try: main()
    except Exception:
        print('App guard could not complete. Check the desktop login, private directory, and recent manual health check. No app was force-quit or data reset.', file=sys.stderr)
        sys.exit(1)
