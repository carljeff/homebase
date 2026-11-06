import importlib.util, os, unittest, xml.etree.ElementTree as ET
spec = importlib.util.spec_from_file_location('app_guard', os.path.join(os.path.dirname(__file__), '../../tools/messages-crm/app_guard.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

class GuardTests(unittest.TestCase):
    def runner(self, closed=(), frozen=False, desktop=True):
        calls = []; started = set()
        def run(args):
            calls.append(args)
            if args[0].endswith('/stat'): return 0, b'42' if desktop else b'0'
            if args[0].endswith('/pgrep'): return (1,b'') if args[-1] in closed and args[-1] not in started else (0,b'123')
            if args[0].endswith('/open'): started.add(args[-1]); return 0,b''
            return (-9,b'') if frozen else (0,b'494\n')
        return calls, run
    def test_running_apps_no_reopen(self):
        calls, run = self.runner(); self.assertEqual(g.check(run,42)['status'],'healthy'); self.assertFalse(any(c[0].endswith('/open') for c in calls))
    def test_closed_apps_reopen_without_foreground(self):
        calls, run = self.runner(closed=('Contacts','Messages')); result = g.check(run,42); self.assertEqual(result['status'],'healthy'); self.assertEqual(len([c for c in calls if c[0].endswith('/open')]),2); self.assertTrue(all('-g' in c for c in calls if c[0].endswith('/open')))
    def test_frozen_contacts_reported_without_killing_app(self):
        calls, run = self.runner(frozen=True); result = g.check(run,42); self.assertEqual(result['apps']['Contacts'],'not_responding_or_access_denied'); self.assertEqual(result['status'],'needs_attention'); self.assertFalse(any('kill' in c[0] for c in calls)); self.assertNotIn('494',str(result))
    def test_no_desktop_does_not_launch_or_probe(self):
        calls, run = self.runner(desktop=False); self.assertEqual(g.check(run,42)['status'],'no_active_desktop'); self.assertEqual(len(calls),1)
    def test_template_is_separate_bounded_aqua_job(self):
        xml=g.template('/Users/synthetic/A & B/app_guard.py'); ET.fromstring(xml); self.assertIn('A &amp; B',xml); self.assertIn('<integer>300</integer>',xml); self.assertIn('Aqua',xml); self.assertNotIn('KeepAlive',xml); self.assertNotIn('collector.py',xml)
    def test_open_failure_is_reported(self):
        def run(args):
            if args[0].endswith('/stat'): return 0,b'42'
            if args[0].endswith('/pgrep'): return 1,b''
            return 1,b''
        self.assertEqual(g.check(run,42)['apps']['Contacts'],'open_failed')
if __name__=='__main__': unittest.main()

class SafetyTests(unittest.TestCase):
    def test_child_timeout_is_bounded(self):
        import sys, time
        start=time.time(); code, unused=g.run([sys.executable,'-c','import time; time.sleep(10)'],timeout=.05); self.assertNotEqual(code,0); self.assertLess(time.time()-start,3)
    def test_symlink_rejected(self):
        import tempfile
        with tempfile.TemporaryDirectory() as root:
            original=os.path.join(root,'original'); link=os.path.join(root,'link')
            with open(original,'w') as out: out.write('canary')
            os.symlink(original,link)
            with self.assertRaises(RuntimeError): g.safe_path(link)
    def test_enable_requires_approval_and_disable_preserves_sync(self):
        import tempfile, json, sys, time
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as root:
            base=os.path.join(root,'collector'); os.mkdir(base,0o700); agents=os.path.join(root,'LaunchAgents'); plist=os.path.join(agents,g.LABEL+'.plist'); script=os.path.join(base,'app_guard.py')
            with open(script,'w') as out: out.write('# synthetic guard')
            with open(os.path.join(base,g.STATE),'w') as out: json.dump({'status':'healthy','checkedEpoch':time.time()},out)
            config=os.path.join(base,'config.json')
            with open(config,'w') as out: out.write('untouched synthetic config')
            calls=[]
            with patch.object(g,'BASE',base),patch.object(g,'PLIST',plist),patch.object(g,'__file__',script),patch.object(g,'run',lambda args:(calls.append(args) or (0,b''))):
                with patch.object(sys,'argv',['app_guard.py','enable']):
                    with self.assertRaises(RuntimeError): g.main()
                self.assertFalse(os.path.exists(plist))
                with patch.object(sys,'argv',['app_guard.py','enable','--approve-automation']): g.main()
                self.assertTrue(os.path.isfile(plist)); self.assertEqual(calls[0][1:4],['load','-S','Aqua'])
                with patch.object(sys,'argv',['app_guard.py','disable']): g.main()
                self.assertFalse(os.path.exists(plist))
                with open(config) as src: self.assertEqual(src.read(),'untouched synthetic config')
