#!/usr/bin/env python
"""Keep the two GUI apps available; opt-in Contacts recovery; no message/contact content access."""
from __future__ import print_function
import argparse, datetime, fcntl, json, os, re, stat, subprocess, sys, tempfile, threading, time
from xml.sax.saxutils import escape
BASE = os.path.expanduser('~/Library/Application Support/HomebaseMessagesCRM')
LABEL = 'com.homebase.app-guard'
PLIST = os.path.expanduser('~/Library/LaunchAgents/' + LABEL + '.plist')
STATE = 'app-guard-health.json'
APPS = ('Messages', 'Contacts')
RECOVERY = 'app-guard-recovery.json'


def run(args, timeout=15):
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, close_fds=True)
    expired = threading.Event()
    def stop_probe():
        expired.set()
        try: process.kill()  # Only our short-lived pgrep/open/osascript child, never an app.
        except OSError: pass
    timer = threading.Timer(timeout, stop_probe); timer.daemon = True; timer.start()
    try:
        out, err = process.communicate()
        code = 124 if expired.is_set() or b'(-1712)' in err else process.returncode
        return code, out
    finally: timer.cancel()


def check(runner=run, uid=None):
    uid = os.getuid() if uid is None else uid
    code, value = runner(['/usr/bin/stat', '-f', '%u', '/dev/console'])
    if code or value.strip() != str(uid).encode('ascii'):
        return {'status': 'no_active_desktop', 'apps': {}}
    apps = {}; contacts_pid = None
    for app in APPS:
        code, process_ids = runner(['/usr/bin/pgrep', '-u', str(uid), '-x', app])
        if code == 1:
            opened, unused = runner(['/usr/bin/open', '-g', '-a', app])
            if opened:
                apps[app] = 'open_failed'; continue
            code, process_ids = runner(['/usr/bin/pgrep', '-u', str(uid), '-x', app])
            apps[app] = 'reopened' if code == 0 else 'starting_or_unavailable'
        elif code == 0:
            apps[app] = 'running'
        else:
            apps[app] = 'process_check_failed'
        if app == 'Contacts' and code == 0 and re.match(b'^[0-9]+$', process_ids.strip()): contacts_pid = process_ids.strip().decode('ascii')
    if apps.get('Contacts') in ('running', 'reopened'):
        code, value = runner(['/usr/bin/osascript', '-l', 'JavaScript', '-e', 'Application("Contacts").people.length'])
        if code in (124, -9):
            apps['Contacts'] = 'unresponsive'
        elif code or not value.strip().isdigit():
            apps['Contacts'] = 'not_responding_or_access_denied'
    healthy = all(apps.get(app) in ('running', 'reopened') for app in APPS)
    return {'status': 'healthy' if healthy else 'needs_attention', 'apps': apps, 'contactsPid': contacts_pid}


def load_state(path):
    safe_path(path)
    if not os.path.isfile(path): return {}
    with open(path) as src:
        value = json.load(src)
    if not isinstance(value, dict): raise RuntimeError('Invalid local guard state')
    return value


def recover(result, previous, enabled, persist, runner=run, now=None):
    now = time.time() if now is None else now
    last = previous.get('lastRecoveryAt', 0)
    state = dict(result, lastRecoveryAt=last, failures=0, recovery='disabled' if not enabled else 'not_needed')
    if result.get('apps', {}).get('Contacts') != 'unresponsive' or not result.get('contactsPid'): return state
    pid = result['contactsPid']; old = previous.get('checkedEpoch', 0)
    same = previous.get('contactsPid') == pid and previous.get('apps', {}).get('Contacts') == 'unresponsive'
    count = previous.get('failures', 0) if same else 0
    # Only checks spaced at least four minutes apart count; stale/clock-reset history does not.
    if not same or now - old > 900 or now < old: count = 1
    elif now - old >= 240: count += 1
    state['failures'] = min(count, 3)
    if not enabled: return state
    state['recovery'] = 'waiting_for_three_timeouts'
    if count < 3: return state
    if last and now - last < 3600:
        state['recovery'] = 'cooldown'; return state
    # Verify desktop ownership and exact current Contacts PID immediately before recovery.
    code, value = runner(['/usr/bin/stat', '-f', '%u', '/dev/console'])
    if code or value.strip() != str(os.getuid()).encode('ascii'):
        state['recovery'] = 'desktop_changed'; return state
    code, value = runner(['/usr/bin/pgrep', '-u', str(os.getuid()), '-x', 'Contacts'])
    if code or value.strip() != pid.encode('ascii'):
        state['recovery'] = 'process_changed'; return state
    state.update(lastRecoveryAt=now, failures=0, recovery='attempt_started')
    persist(state)  # Durable cooldown before any quit; interrupted attempts cannot loop.
    runner(['/usr/bin/osascript', '-e', 'tell application "Contacts" to quit'])
    code, value = runner(['/usr/bin/pgrep', '-u', str(os.getuid()), '-x', 'Contacts'])
    if code == 0 and value.strip() == pid.encode('ascii'):
        # Never force-quit merely on a permission/script error or a changed process.
        probe, unused = runner(['/usr/bin/osascript', '-l', 'JavaScript', '-e', 'Application("Contacts").people.length'])
        if probe not in (124, -9):
            state['recovery'] = 'quit_not_forced'; return state
        owner_code, owner = runner(['/usr/bin/stat', '-f', '%u', '/dev/console'])
        pid_code, current = runner(['/usr/bin/pgrep', '-u', str(os.getuid()), '-x', 'Contacts'])
        if owner_code or owner.strip() != str(os.getuid()).encode('ascii') or pid_code or current.strip() != pid.encode('ascii'):
            state['recovery'] = 'process_changed'; return state
        stopped, unused = runner(['/bin/kill', '-KILL', pid])
        if stopped:
            state['recovery'] = 'stop_failed'; return state
        state['recovery'] = 'force_restart_requested'
    elif code == 1:
        state['recovery'] = 'normal_restart_requested'
    else:
        state['recovery'] = 'process_changed'; return state
    runner(['/usr/bin/open', '-g', '-a', 'Contacts'])
    # A later scheduled check establishes success; opening is not proof of responsiveness.
    return state


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
    parser.add_argument('command', choices=['check', 'health', 'enable', 'disable', 'enable-recovery', 'disable-recovery'])
    parser.add_argument('--approve-automation', action='store_true')
    parser.add_argument('--approve-contacts-restart', action='store_true')
    args = parser.parse_args(); os.umask(0o077); private_directory()
    state_path = os.path.join(BASE, STATE)
    if args.command == 'check':
        path = os.path.join(BASE, 'app-guard.lock'); safe_path(path)
        with open(path, 'a') as lock:
            try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except IOError:
                print('App check already running.'); return
            previous = load_state(state_path); enabled = load_state(os.path.join(BASE, RECOVERY)).get('enabled') is True
            collector_path = os.path.join(BASE, 'collector.lock'); safe_path(collector_path)
            with open(collector_path, 'a') as collector_lock:
                try: fcntl.flock(collector_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except IOError:
                    print('Collector busy; app recovery deferred.'); return
                result = recover(check(), previous, enabled, lambda state: save(state_path, json.dumps(dict(state, checkedEpoch=time.time()))))
            result['checkedAt'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'); result['checkedEpoch'] = time.time()
            save(state_path, json.dumps(result, sort_keys=True)); print(json.dumps(result, sort_keys=True))
    elif args.command in ('enable-recovery','disable-recovery'):
        if args.command == 'enable-recovery' and not args.approve_contacts_restart: raise RuntimeError('Explicit Contacts restart approval required')
        save(os.path.join(BASE, RECOVERY), json.dumps({'enabled': args.command == 'enable-recovery'}))
        print('Contacts recovery ' + ('enabled after three spaced timeouts, at most once per hour. Unsaved Contacts edits may be lost.' if args.command == 'enable-recovery' else 'disabled; open-only guard retained.'))
    elif args.command == 'health':
        safe_path(state_path)
        if not os.path.isfile(state_path): print('Run a manual check first.'); return
        with open(state_path) as src: result = json.load(src)
        # Never echo arbitrary local file contents.
        print(json.dumps({'status': result.get('status') if result.get('status') in ('healthy','needs_attention','no_active_desktop') else 'unknown', 'checkedAt': result.get('checkedAt'), 'stale': time.time() - result.get('checkedEpoch', 0) > 600, 'scheduled': os.path.isfile(PLIST), 'contactsRecoveryEnabled': load_state(os.path.join(BASE, RECOVERY)).get('enabled') is True, 'recovery': result.get('recovery')}, sort_keys=True))
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
        print('App guard could not complete. Check the desktop login, private directory, and recent manual health check. Inspect app health; no credential or data reset was requested.', file=sys.stderr)
        sys.exit(1)
