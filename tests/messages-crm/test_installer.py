import importlib.util, os, plistlib, tempfile, unittest
from pathlib import Path
from unittest import mock
SPEC=importlib.util.spec_from_file_location('manage',str(Path(__file__).parents[2]/'tools/messages-crm/manage.py'));m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)
class InstallerTest(unittest.TestCase):
    def test_install_is_disabled_and_enable_requires_explicit_approval(self):
        with tempfile.TemporaryDirectory() as temp:
            base=os.path.join(temp,'installed');agent=os.path.join(temp,'LaunchAgents','agent.plist');real_isfile=os.path.isfile
            with mock.patch.object(m,'BASE',base),mock.patch.object(m,'PLIST',agent),mock.patch.object(m,'PYTHON',os.sys.executable),mock.patch.object(m.os.path,'isfile',side_effect=lambda p:True if p=='/usr/bin/sqlite3' else real_isfile(p)),mock.patch.object(m.subprocess,'check_call') as launch,mock.patch.object(m.sys,'argv',['manage.py','install']):m.main()
            self.assertFalse(os.path.exists(agent));self.assertFalse(os.path.exists(os.path.join(base,'AUTOMATION_APPROVED')));launch.assert_not_called();self.assertEqual(os.stat(base).st_mode&0o777,0o700);self.assertEqual(os.stat(os.path.join(base,'config.json')).st_mode&0o777,0o600)
            template=plistlib.loads(Path(base,m.LABEL+'.plist.disabled').read_bytes());self.assertEqual(template['StartInterval'],900);self.assertIn('--scheduled',template['ProgramArguments'])
            with mock.patch.object(m,'BASE',base),mock.patch.object(m,'PLIST',agent),mock.patch.object(m.sys,'argv',['manage.py','enable']):
                with self.assertRaises(RuntimeError):m.main()
if __name__=='__main__':unittest.main()
