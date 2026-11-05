import contextlib, importlib.util, io, json, os, sqlite3, unittest
from pathlib import Path
from unittest import mock
import test_collector as fixture
SPEC=importlib.util.spec_from_file_location('review',str(Path(__file__).parents[2]/'tools/messages-crm/review.py'));m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)
NOW=fixture.NOW; A=fixture.A
class ReviewTest(unittest.TestCase):
 setUp=fixture.CollectorTest.setUp
 tearDown=fixture.CollectorTest.tearDown
 def book(self):return [{'name':'Alice Example','handles':['+13175550101','synthetic@example.test']},{'name':'Bob Example','handles':['+13175550102']}]
 def config_file(self):
  path=str(Path(self.temp.name,'config.json'));m.d.atomic_json(path,dict(database=self.path,device_id=A,endpoint=m.c.RELAY_ENDPOINT,contacts=[]));return path,m.c.load_config(path)
 def scan(self,config=None,state=None,now=NOW):
  return m.scan(config or dict(self.config,_mapping={},_mapping_hash='empty'),{'limit':10000},state or {},now=now,book=self.book(),source=self.source)
 def test_outbound_only_omits_incoming_group_spam_and_content_without_source_changes(self):
  before=Path(self.path).read_bytes();cards,state=self.scan();self.assertEqual([c['name'] for c in cards],['Alice Example']);self.assertEqual(cards[0]['activity']['directOut'],1);self.assertEqual(cards[0]['activity']['directIn'],0);self.assertEqual(cards[0]['activity']['groupOut'],0)
  sent,local=m.publish_entries(cards,'b'*64,[]);self.assertEqual(len(sent),1);self.assertEqual(set(sent[0]),set(['candidateId','name','directOut','lastOutgoing','existingContactId']))
  for private in ['13175550101','synthetic@example.test','PRIVATE_','handles','groupIn','directIn']:self.assertNotIn(private,json.dumps(sent))
  self.assertEqual(before,Path(self.path).read_bytes());self.assertIsNone(m.c.get_meta(self.cache,'cursor'))
  for sql in self.queries:
   for forbidden in ['attributedBody','attachment','SELECT *','m.text']:self.assertNotIn(forbidden,sql)
 def test_native_contacts_allowlist_normalization_and_read_only_script(self):
  calls=[]
  def runner(args):calls.append(args);return json.dumps([{'name':'Alice Example','handles':['(317) 555-0101','SYNTHETIC@EXAMPLE.TEST']},{'name':'unnamed@example.test','handles':['+13175550102']}]).encode()
  self.assertEqual(m.native_cards(runner),[{'name':'Alice Example','handles':['+13175550101','synthetic@example.test']}]);self.assertEqual(calls[0][:3],['/usr/bin/osascript','-l','JavaScript'])
  for forbidden in ['setProperty','activate','send','Messages','notes','image']:self.assertNotIn(forbidden,m.CONTACTS_SCRIPT)
  for extra in ['notes','body','photo','attachment']:
   with self.assertRaises(m.d.ContactError):m.native_cards(lambda args:json.dumps([dict(name='Alice',handles=['+13175550101'],**{extra:'PRIVATE_SENTINEL'})]))
 def test_cache_does_not_scan_unchanged_messages_but_daily_rebuild_is_not_starved(self):
  cards,state=self.scan();count=len(self.queries);cards,again=self.scan(state=state,now=NOW+600);self.assertEqual(again['scannedAt'],NOW);self.assertFalse(any('ORDER BY m.ROWID DESC' in sql for sql in self.queries[count:]));count=len(self.queries)
  self.scan(state=again,now=NOW+86401);self.assertTrue(any('ORDER BY m.ROWID DESC' in sql for sql in self.queries[count:]));self.assertEqual(self.scan(now=NOW+91*86400)[0],[])
 def test_approval_applies_all_handles_once_and_acks_without_touching_activity_state(self):
  path,config=self.config_file();cards,scanned=self.scan(config);proposals,local=m.publish_entries(cards,'b'*64,[]);ident=proposals[0]['candidateId'];requests=[]
  def send(payload):
   requests.append(payload);return dict(version=1,action='review-sync',decisions=[] if payload['applied'] else [dict(candidateId=ident,status='approved',contactId=fixture.B)])
  self.assertEqual(m.synchronize(path,config,{}, {},cards,scanned,'b'*64,send,now=NOW),(1,1));self.assertEqual(len(requests),2);self.assertEqual(requests[1]['applied'],[dict(candidateId=ident,contactId=fixture.B)]);updated=m.c.load_config(path);self.assertEqual(updated['_mapping'],dict((h,fixture.B) for h in self.book()[0]['handles']));self.assertEqual(m.d.load_private(str(Path(self.temp.name,m.STATE)))['applied'],[])
  after=Path(path).read_bytes();state=m.d.load_private(str(Path(self.temp.name,m.STATE)));m.synchronize(path,updated,{},state,[],scanned,'b'*64,lambda p:dict(version=1,action='review-sync',decisions=[]),now=NOW+1);self.assertEqual(after,Path(path).read_bytes());self.assertEqual(len(list(Path(self.temp.name).glob('contacts-backup-*.json'))),1);self.assertIsNone(m.c.get_meta(self.cache,'sequence'))
 def test_failed_ack_is_recovered_after_mapping_write_without_double_apply(self):
  path,config=self.config_file();cards,scanned=self.scan(config);ident=m.publish_entries(cards,'b'*64,[])[0][0]['candidateId'];calls=[]
  def send(payload):
   calls.append(payload)
   if len(calls)==2:raise RuntimeError('synthetic network failure')
   return dict(version=1,action='review-sync',decisions=[dict(candidateId=ident,status='approved',contactId=fixture.B)])
  with self.assertRaises(RuntimeError):m.synchronize(path,config,{}, {},cards,scanned,'b'*64,send,now=NOW)
  state=m.d.load_private(str(Path(self.temp.name,m.STATE)));self.assertEqual(len(state['applied']),1);self.assertEqual(len(state['applying']),1);before=Path(path).read_bytes();requests=[]
  m.synchronize(path,m.c.load_config(path),{},state,[],scanned,'b'*64,lambda p:requests.append(p) or dict(version=1,action='review-sync',decisions=[]),now=NOW+60);self.assertEqual(requests[0]['applied'],[dict(candidateId=ident,contactId=fixture.B)]);self.assertEqual(before,Path(path).read_bytes());self.assertEqual(m.d.load_private(str(Path(self.temp.name,m.STATE)))['applied'],[])
 def test_unknown_or_changed_person_cannot_apply_approval_and_ignore_does_not_recur(self):
  path,config=self.config_file();cards,scanned=self.scan(config);ident=m.publish_entries(cards,'b'*64,[])[0][0]['candidateId'];before=Path(path).read_bytes()
  m.synchronize(path,config,{}, {},[],scanned,'b'*64,lambda p:dict(version=1,action='review-sync',decisions=[dict(candidateId=ident,status='approved',contactId=fixture.B)]),now=NOW);self.assertEqual(before,Path(path).read_bytes())
  m.synchronize(path,config,{}, {},cards,scanned,'b'*64,lambda p:dict(version=1,action='review-sync',decisions=[dict(candidateId=ident,status='ignored',contactId=None)]),now=NOW);state=m.d.load_private(str(Path(self.temp.name,m.STATE)));self.assertEqual(m.publish_entries(cards,'b'*64,state['closed'])[0],[]);self.assertEqual(before,Path(path).read_bytes())
 def test_default_disabled_and_manual_approval_required_and_dry_run_offline(self):
  path,config=self.config_file();base=['review.py','--config',path]
  with mock.patch.object(m.sys,'argv',base+['sync','--scheduled']),mock.patch.object(m,'scan',side_effect=AssertionError('disabled must not scan')):m.main()
  with mock.patch.object(m.sys,'argv',base+['enable','--approve-automation']),self.assertRaises(m.d.ContactError):m.main()
  with mock.patch.object(m.sys,'argv',base+['sync']),self.assertRaises(m.d.ContactError):m.main()
  with mock.patch.object(m.sys,'argv',base+['dry-run']),mock.patch.object(m,'scan',return_value=([],{})),mock.patch.object(m.c,'keychain_read',side_effect=AssertionError('offline')),contextlib.redirect_stdout(io.StringIO()) as out:m.main()
  self.assertEqual(json.loads(out.getvalue())['uploads'],0);self.assertFalse(Path(self.temp.name,m.SETTINGS).exists());self.assertFalse(Path(self.temp.name,m.STATE).exists())
 def test_receipt_rejects_private_fields_duplicates_and_invalid_ids(self):
  decision=dict(candidateId='a'*64,status='approved',contactId=A)
  for values in [[dict(decision,text='PRIVATE')],[decision,decision],[dict(decision,contactId='invalid')],[dict(decision,status='ignored')]]:
   with self.assertRaises((m.d.ContactError,ValueError)):m.check_decisions(dict(version=1,action='review-sync',decisions=values))
