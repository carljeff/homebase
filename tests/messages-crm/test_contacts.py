import contextlib,hashlib,importlib.util,io,json,os,tempfile,unittest,uuid
from pathlib import Path
from unittest import mock
SPEC=importlib.util.spec_from_file_location('contacts',str(Path(__file__).parents[2]/'tools/messages-crm/contacts.py'));m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)
A='11111111-1111-4111-a111-111111111111';B='22222222-2222-4222-a222-222222222222'
VCARD='BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Alice\\, Example\r\nitem1.TEL;TYPE=CELL:(317) 555-0101\r\nTEL;TYPE=HOME:tel:+13175550102;ext=12\r\nEMAIL:ALICE@EXAMPLE.TEST\r\nNOTE:PRIVATE_NOTE_SENTINEL\r\nADR:PRIVATE_ADDRESS_SENTINEL\r\nPHOTO;ENCODING=b:PRIVATE_PHOTO_SENTINEL\r\nEND:VCARD\r\n'
class ContactsTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.directory=self.temp.name;self.config_path=os.path.join(self.directory,'config.json');self.vcard=os.path.join(self.directory,'Selected.vcf');Path(self.vcard).write_bytes(VCARD.encode());self.config={'database':os.path.join(self.directory,'chat.db'),'device_id':A,'endpoint':m.c.RELAY_ENDPOINT,'contacts':[]};m.atomic_json(self.config_path,self.config)
 def tearDown(self):self.temp.cleanup()
 def test_vcard_allowlist_folding_escaping_unicode_and_multiple_handles(self):
  cards=m.parse_vcards(self.vcard);self.assertEqual(cards,[{'name':'Alice, Example','handles':['+13175550101','+13175550102','alice@example.test']}]);self.assertNotIn('PRIVATE_',json.dumps(cards))
  Path(self.vcard).write_bytes(b'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Jos\xc3\r\n \xa9 Example\r\nTEL;VALUE=uri:tel:+13175550101\r\nEND:VCARD\r\n');self.assertEqual(m.parse_vcards(self.vcard)[0]['name'],'Jos\u00e9 Example')
 def test_unsupported_malformed_and_content_only_cards_fail_without_printing_private_data(self):
  for raw in ['BEGIN:VCARD\nVERSION:2.1\nFN:PRIVATE_NAME\nEND:VCARD', 'BEGIN:VCARD\nVERSION:3.0\nFN:PRIVATE_NAME', 'BEGIN:VCARD\nVERSION:3.0\nFN:Alice\nNOTE:PRIVATE_NOTE\nEND:VCARD']:
   Path(self.vcard).write_text(raw)
   with self.assertRaises(m.ContactError) as error:m.parse_vcards(self.vcard)
   self.assertNotIn('PRIVATE_',str(error.exception))
 def test_explicit_selection_existing_match_and_no_private_fields_in_request(self):
  cards=m.parse_vcards(self.vcard);roster=[{'contactId':B,'name':'Alice, Example','trackMessaging':True}];answers=iter(['1','','1','IMPORT'])
  with contextlib.redirect_stdout(io.StringIO()):plan=m.choose_plan(cards,roster,self.config,lambda prompt:next(answers))
  request=m.request_for(plan);self.assertFalse(request['contacts'][0]['create']);self.assertEqual(request['contacts'][0]['contactId'],B)
  for value in ['13175550101','alice@example.test','PRIVATE_','handles']:self.assertNotIn(value,json.dumps(request))
  answers=iter(['1','','1',''])
  with contextlib.redirect_stdout(io.StringIO()):self.assertIsNone(m.choose_plan(cards,roster,self.config,lambda prompt:next(answers)))
 def plan(self):return {'version':1,'selectionId':str(uuid.uuid4()),'configDigest':m.config_digest(self.config),'contacts':[{'contactId':B,'name':'Alice Example','create':True,'handles':['+13175550101','alice@example.test']}]}
 def receipt(self,p):return {'version':1,'action':'apply','selectionId':p['selectionId'],'contacts':[{'contactId':e['contactId'],'name':e['name']} for e in p['contacts']]}
 def test_apply_is_backed_up_atomic_and_retries_use_same_ids(self):
  plan=self.plan();m.atomic_json(os.path.join(self.directory,m.PENDING),plan);calls=[]
  def send(request):calls.append(request);return self.receipt(plan)
  self.assertEqual(m.apply_plan(self.config_path,plan,send),1);updated=m.load_private(self.config_path);self.assertEqual(updated['device_id'],A);self.assertEqual(updated['contacts'],[{'contact_id':B,'handles':['+13175550101','alice@example.test']}]);self.assertEqual(m.load_private(os.path.join(self.directory,'contacts-backup-'+plan['selectionId']+'.json')),self.config)
  self.assertEqual(os.stat(self.config_path).st_mode&0o777,0o600);m.apply_plan(self.config_path,plan,send);self.assertEqual(calls[0],calls[1]);self.assertEqual(len(updated['contacts']),1)
 def test_failed_receipt_network_conflict_and_pending_upload_never_modify_config(self):
  plan=self.plan();before=Path(self.config_path).read_bytes()
  with self.assertRaises(m.ContactError):m.apply_plan(self.config_path,plan,lambda p:{'version':1,'action':'apply','selectionId':plan['selectionId'],'contacts':[]})
  self.assertEqual(before,Path(self.config_path).read_bytes())
  with self.assertRaises(RuntimeError):m.apply_plan(self.config_path,plan,lambda p:(_ for _ in ()).throw(RuntimeError('outage')))
  self.assertEqual(before,Path(self.config_path).read_bytes())
  self.config['contacts']=[{'contact_id':A,'handles':['+13175550101']}];m.atomic_json(self.config_path,self.config)
  with self.assertRaises(m.ContactError):m.apply_plan(self.config_path,plan,lambda p:self.fail('No request on handle conflict'))
  Path(self.config['database']).touch();db=m.c.cache_open(os.path.join(self.directory,'metadata.sqlite'));m.c.put_meta(db,'pending','synthetic');db.commit();db.close()
  with self.assertRaises(m.ContactError):m.apply_plan(self.config_path,self.plan(),lambda p:self.fail('No request with pending upload'))
 def test_cli_import_preview_cancel_resume_and_preservation(self):
  captured=[]
  def send(raw,config,path):
   p=json.loads(raw);captured.append(p);self.assertEqual(path,'/api/crm/contacts')
   if p['action']=='list':return {'version':1,'action':'list','friends':[]}
   return {'version':1,'action':'apply','selectionId':p['selectionId'],'contacts':[{'contactId':e['contactId'],'name':e['name']} for e in p['contacts']]}
  with mock.patch.object(m.sys,'argv',['contacts.py','preview','--vcard',self.vcard]),mock.patch.object(m.c,'transmit',side_effect=AssertionError('No preview network')),contextlib.redirect_stdout(io.StringIO()):m.main()
  with mock.patch.object(m.sys,'argv',['contacts.py','import','--config',self.config_path,'--vcard',self.vcard]),mock.patch.object(m,'read_input',side_effect=['1','','n','IMPORT']),mock.patch.object(m.c,'transmit',side_effect=send),contextlib.redirect_stdout(io.StringIO()):
   # choose_plan captures the original default; inject current test prompt explicitly.
   original=m.choose_plan
   with mock.patch.object(m,'choose_plan',side_effect=lambda cards,roster,config:original(cards,roster,config,m.read_input)):m.main()
  self.assertEqual(len(captured),2);self.assertEqual(len(m.load_private(self.config_path)['contacts']),1)
  for marker in ['13175550101','alice@example.test','PRIVATE_','handles']:self.assertNotIn(marker,json.dumps(captured))

 def test_resume_after_outage_is_idempotent_and_restore_preserves_pairing(self):
  plan=self.plan();pending=os.path.join(self.directory,m.PENDING);m.atomic_json(pending,plan);before=Path(self.config_path).read_bytes()
  with self.assertRaises(m.c.CollectorFailure):m.apply_plan(self.config_path,plan,lambda p:(_ for _ in ()).throw(m.c.CollectorFailure('Network unavailable')))
  self.assertEqual(before,Path(self.config_path).read_bytes());self.assertTrue(os.path.exists(pending))
  captured=[]
  def send(raw,config,path):captured.append(json.loads(raw));return self.receipt(plan)
  with mock.patch.object(m.sys,'argv',['contacts.py','resume','--config',self.config_path]),mock.patch.object(m,'read_input',return_value='IMPORT'),mock.patch.object(m.c,'transmit',side_effect=send),contextlib.redirect_stdout(io.StringIO()):m.main()
  self.assertEqual(captured,[m.request_for(plan)]);self.assertFalse(os.path.exists(pending))
  backup=os.path.join(self.directory,'contacts-backup-'+plan['selectionId']+'.json')
  with mock.patch.object(m.sys,'argv',['contacts.py','restore','--config',self.config_path,'--backup',backup]),mock.patch.object(m,'read_input',return_value='RESTORE'),mock.patch.object(m.c,'transmit',side_effect=AssertionError('Restore is local')),contextlib.redirect_stdout(io.StringIO()):m.main()
  self.assertEqual(m.load_private(self.config_path),self.config)
 def test_stale_configuration_bad_receipts_and_cancellation_are_safe(self):
  plan=self.plan();changed=dict(self.config);changed['reconcile_hours']=12;m.atomic_json(self.config_path,changed)
  with self.assertRaises(m.ContactError):m.apply_plan(self.config_path,plan,lambda p:self.fail('No writes for stale configuration'))
  receipt=self.receipt(plan);receipt['contacts'][0]['notes']='PRIVATE_NOTE'
  with self.assertRaises(m.ContactError):m.check_receipt(receipt,plan)
  pending=os.path.join(self.directory,m.PENDING);m.atomic_json(pending,plan)
  with mock.patch.object(m.sys,'argv',['contacts.py','cancel','--config',self.config_path]),mock.patch.object(m,'read_input',return_value='CANCEL'),mock.patch.object(m.c,'transmit',side_effect=AssertionError('Cancel is local')),contextlib.redirect_stdout(io.StringIO()):m.main()
  self.assertFalse(os.path.exists(pending));self.assertTrue(os.path.exists(os.path.join(self.directory,'contacts-cancelled-'+plan['selectionId']+'.json')));self.assertEqual(m.load_private(self.config_path),changed)

 def test_missing_fn_uses_structured_name_and_skips_only_unusable_cards(self):
  Path(self.vcard).write_text('BEGIN:VCARD\nVERSION:3.0\nN:Example;Alice;M;Dr;Jr.\nTEL:+13175550101\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nTEL:+13175550102\nEND:VCARD\nBEGIN:VCARD\nFN:Missing Version\nTEL:+13175550103\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nFN:Preferred Name\nN:Ignored;Structured;;;\nTEL:+13175550104\nEND:VCARD\n');stats={};cards=m.parse_vcards(self.vcard,stats=stats);self.assertEqual([c['name'] for c in cards],['Dr Alice M Example Jr.','Preferred Name']);self.assertEqual(stats['cards'],4);self.assertEqual(stats['structuredNames'],1);self.assertEqual(stats['skippedNames'],1);self.assertEqual(stats['missingVersion'],1)
 def test_structured_name_handles_escaping_unicode_and_version_whitespace(self):
  Path(self.vcard).write_text('BEGIN:VCARD\nVERSION:3.0  \nN:Doe\\;Smith;Jos\u00e9;;;\nTEL:+13175550101\nEND:VCARD\n');self.assertEqual(m.parse_vcards(self.vcard)[0]['name'],'Jos\u00e9 Doe;Smith')
  Path(self.vcard).write_text('BEGIN:VCARD\nVERSION:3\nFN:Legacy Version Alias\nTEL:+13175550101\nEND:VCARD\n');self.assertEqual(m.parse_vcards(self.vcard)[0]['name'],'Legacy Version Alias')
 def test_vcard_info_outputs_counts_only_without_network_or_config(self):
  Path(self.vcard).write_text('BEGIN:VCARD\nVERSION:3.0\nN:PRIVATE_SURNAME;PRIVATE_GIVEN;;;\nEMAIL:private@example.test\nNOTE:PRIVATE_NOTE\nEND:VCARD\n');out=io.StringIO()
  with mock.patch.object(m.sys,'argv',['contacts.py','vcard-info','--vcard',self.vcard]),mock.patch.object(m.c,'transmit',side_effect=AssertionError('No network')),mock.patch.object(m.c,'Source',side_effect=AssertionError('No Messages database')),contextlib.redirect_stdout(out):m.main()
  self.assertIn('1 cards, 1 usable, 1 structured-name fallbacks',out.getvalue());self.assertNotIn('PRIVATE_',out.getvalue());self.assertNotIn('private@example.test',out.getvalue())
