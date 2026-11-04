import contextlib,hashlib,importlib.util,io,json,os,sqlite3,unittest
from pathlib import Path
from unittest import mock
import test_collector as fixture
A=fixture.A; B=fixture.B; NOW=fixture.NOW
SPEC=importlib.util.spec_from_file_location('discovery_contacts',str(Path(__file__).parents[2]/'tools/messages-crm/contacts.py'));m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)
class DiscoveryTest(unittest.TestCase):
 setUp=fixture.CollectorTest.setUp
 tearDown=fixture.CollectorTest.tearDown
 def cards(self):return [{'name':'Alice Example','handles':['+13175550101','synthetic@example.test']},{'name':'Bob Example','handles':['+13175550102']}]
 def discover(self,**kwargs):return m.discover_contacts(self.source,self.cards(),{},now=NOW,**kwargs)
 def test_local_metadata_only_direct_group_counts_and_source_integrity(self):
  before=Path(self.path).read_bytes();cards,summary=self.discover();self.assertEqual(summary['scanned'],10);self.assertEqual(summary['groupOnlyOmitted'],1);self.assertEqual(summary['invalidTimestamp'],2);self.assertEqual(summary['eligibleUnlinked'],1);self.assertEqual(summary['ambiguousMessages'],1);self.assertEqual(len(cards),1);self.assertEqual(cards[0]['activity']['directIn'],2);self.assertEqual(cards[0]['activity']['directOut'],1);self.assertEqual(cards[0]['activity']['groupIn'],1);self.assertEqual(cards[0]['activity']['groupOut'],1);self.assertEqual(before,Path(self.path).read_bytes())
  for sql in self.queries:
   for forbidden in ['attributedBody','attachment','SELECT *','m.text']:self.assertNotIn(forbidden,sql)
  self.assertTrue(any('ORDER BY m.ROWID DESC LIMIT 10000' in sql for sql in self.queries))
  out=io.StringIO()
  with contextlib.redirect_stdout(out):m.show_discovery(cards,summary)
  self.assertNotIn('PRIVATE_',out.getvalue());self.assertNotIn('synthetic@example.test',out.getvalue());self.assertNotIn('13175550101',out.getvalue())
 def test_groups_are_optional_and_same_person_multiple_handles_count_once_per_message(self):
  db=sqlite3.connect(self.path);db.execute('INSERT INTO chat_handle_join VALUES (3,2)');db.commit();db.close();cards,summary=self.discover(include_groups=True);a=next(c for c in cards if c['name']=='Alice Example');b=next(c for c in cards if c['name']=='Bob Example');self.assertEqual(a['activity']['groupOut'],1);self.assertEqual(b['activity']['groupOut'],1);self.assertEqual(b['activity']['directIn'],0);self.assertEqual(cards[0]['name'],'Alice Example')
 def test_existing_mappings_skip_known_people_and_new_handles_require_same_friend(self):
  full={'+13175550101':A,'synthetic@example.test':A};cards,summary=m.discover_contacts(self.source,self.cards(),full,now=NOW);self.assertEqual(cards,[]);self.assertEqual(summary['alreadyMapped'],1)
  cards,_=m.discover_contacts(self.source,self.cards(),full,now=NOW,include_mapped=True);self.assertEqual(cards[0]['mappedId'],A)
  cards,_=m.discover_contacts(self.source,self.cards(),{'+13175550101':A},now=NOW);self.assertEqual(cards[0]['mappedId'],A)
  answers=iter(['1','','n'])
  with contextlib.redirect_stdout(io.StringIO()):
   with self.assertRaises(m.ContactError):m.choose_plan(cards,[{'contactId':A,'name':'Alice Example','trackMessaging':True}],{'contacts':[]},lambda prompt:next(answers))
 def test_shared_handles_and_conflicting_existing_ids_are_never_guessed(self):
  book=self.cards()+[{'name':'Other Person','handles':['+13175550101']}];cards,summary=m.discover_contacts(self.source,book,{},now=NOW);self.assertEqual(summary['ambiguousContactHandles'],1);self.assertNotIn('+13175550101',cards[0]['handles'])
  cards,summary=m.discover_contacts(self.source,self.cards(),{'+13175550101':A,'synthetic@example.test':B},now=NOW);self.assertEqual(cards,[]);self.assertEqual(summary['conflictingMappings'],1)
 def test_future_rerun_finds_new_person_and_bounded_rows_without_cursor_changes(self):
  db=sqlite3.connect(self.path);db.execute("INSERT INTO handle VALUES ('+13175550103')");db.execute('INSERT INTO chat_handle_join VALUES (4,4)');db.execute('INSERT INTO message(ROWID,date,is_from_me,handle_id,item_type,associated_message_type,guid) VALUES (1000,?,0,4,0,0,?)',((NOW-10-m.c.APPLE_EPOCH)*1000000000,'new-synthetic-guid'));db.execute('INSERT INTO chat_message_join VALUES (4,1000)');db.commit();db.close()
  book=self.cards()+[{'name':'New Person','handles':['+13175550103']}];cards,summary=m.discover_contacts(self.source,book,{'+13175550101':A,'synthetic@example.test':A},now=NOW,limit=2);self.assertEqual(summary['scanned'],2);self.assertEqual([c['name'] for c in cards],['New Person']);self.assertIsNone(m.c.get_meta(self.cache,'cursor'));self.assertIsNone(m.c.get_meta(self.cache,'sequence'))
  with self.assertRaises(m.ContactError):self.discover(limit=0)
  with self.assertRaises(m.ContactError):self.discover(limit=50001)
 def test_full_local_addressbook_limit_and_unnamed_cards_are_supported_for_discovery(self):
  path=Path(self.temp.name,'AllContacts.vcf');path.write_text(''.join('BEGIN:VCARD\nVERSION:3.0\nFN:Person %d\nTEL:+1317555%04d\nEND:VCARD\n'%(i,i) for i in range(300))+'BEGIN:VCARD\nVERSION:3.0\nFN:unnamed@example.test\nEMAIL:unnamed@example.test\nEND:VCARD\n')
  with self.assertRaises(m.ContactError):m.parse_vcards(str(path))
  self.assertEqual(len(m.parse_vcards(str(path),max_cards=10000,skip_invalid_names=True)),300)
 def test_cli_discovery_is_offline_and_does_not_change_mappings_or_cache(self):
  path=Path(self.temp.name,'config.json');config={'database':self.path,'device_id':A,'endpoint':m.c.RELAY_ENDPOINT,'contacts':[]};m.atomic_json(str(path),config);vcf=Path(self.temp.name,'AllContacts.vcf');vcf.write_text('BEGIN:VCARD\nVERSION:3.0\nFN:Alice Example\nTEL:+13175550101\nEMAIL:synthetic@example.test\nEND:VCARD\n');before=path.read_bytes()
  with mock.patch.object(m.sys,'argv',['contacts.py','discover','--config',str(path),'--vcard',str(vcf)]),mock.patch.object(m.c,'Source',return_value=self.source),mock.patch.object(m.c,'transmit',side_effect=AssertionError('Discovery must be offline')),contextlib.redirect_stdout(io.StringIO()):m.main()
  self.assertEqual(before,path.read_bytes());self.assertFalse(Path(self.temp.name,m.PENDING).exists());self.assertIsNone(m.c.get_meta(self.cache,'cursor'))
 def test_guid_duplicates_are_counted_once_and_unknown_handles_remain_counts_only(self):
  db=sqlite3.connect(self.path);db.execute("UPDATE message SET guid='guid-1' WHERE ROWID=3");db.commit();db.close();cards,summary=m.discover_contacts(self.source,[{'name':'Alice Example','handles':['+13175550101']}],{},now=NOW);self.assertEqual(summary['duplicates'],1);self.assertEqual(summary['unmatchedHandles'],1);self.assertEqual(cards[0]['activity']['directIn'],1)

 def test_discover_import_reuses_review_flow_and_never_sends_discovered_handles_or_activity(self):
  path=Path(self.temp.name,'config.json');config={'database':self.path,'device_id':A,'endpoint':m.c.RELAY_ENDPOINT,'contacts':[]};m.atomic_json(str(path),config);vcf=Path(self.temp.name,'AllContacts.vcf');vcf.write_text('BEGIN:VCARD\nVERSION:3.0\nFN:Alice Example\nTEL:+13175550101\nEMAIL:synthetic@example.test\nEND:VCARD\n');requests=[]
  def send(raw,config,path):
   payload=json.loads(raw);requests.append(payload)
   if payload['action']=='list':return {'version':1,'action':'list','friends':[{'contactId':A,'name':'Alice Example','trackMessaging':True}]}
   return {'version':1,'action':'apply','selectionId':payload['selectionId'],'contacts':[{'contactId':e['contactId'],'name':e['name']} for e in payload['contacts']]}
  with mock.patch.object(m.sys,'argv',['contacts.py','discover-import','--config',str(path),'--vcard',str(vcf)]),mock.patch.object(m.c,'Source',return_value=self.source),mock.patch.object(m.c,'transmit',side_effect=send),mock.patch.object(m,'read_input',side_effect=['1','','1','IMPORT']),contextlib.redirect_stdout(io.StringIO()):m.main()
  self.assertEqual([r['action'] for r in requests],['list','apply'])
  for value in ['13175550101','synthetic@example.test','directIn','groupOut','PRIVATE_','handles']:self.assertNotIn(value,json.dumps(requests))
  self.assertEqual(m.load_private(str(path))['contacts'],[{'contact_id':A,'handles':['+13175550101','synthetic@example.test']}]);self.assertIsNone(m.c.get_meta(self.cache,'sequence'));self.assertIsNone(m.c.get_meta(self.cache,'cursor'))
