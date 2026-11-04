import datetime, hashlib, importlib.util, json, os, sqlite3, tempfile, unittest
from pathlib import Path
SPEC = importlib.util.spec_from_file_location('collector', str(Path(__file__).parents[2] / 'tools/messages-crm/collector.py'))
c = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(c)
A = '11111111-1111-4111-a111-111111111111'
B = '22222222-2222-4222-a222-222222222222'
NOW = 1793811600  # fixed synthetic instant, no personal data
class CollectorTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.path = os.path.join(self.temp.name, 'chat.db')
        db = sqlite3.connect(self.path)
        db.executescript('CREATE TABLE message(date,is_from_me,handle_id,item_type,associated_message_type,text,attributedBody,guid);CREATE TABLE handle(id);CREATE TABLE chat_message_join(chat_id,message_id);CREATE TABLE chat_handle_join(chat_id,handle_id);CREATE TABLE attachment(filename);')
        db.executemany('INSERT INTO handle VALUES (?)', [('+13175550101',),('synthetic@example.test',),('+13175550102',)])
        db.executemany('INSERT INTO chat_handle_join VALUES (?,?)',[(1,1),(2,2),(3,1),(3,3)])
        for rid in range(1,11):
            date = (NOW-86400-c.APPLE_EPOCH)*1000000000 if rid != 7 else None
            if rid == 10: date='NOT A TIMESTAMP'
            db.execute('INSERT INTO message(ROWID,date,is_from_me,handle_id,item_type,associated_message_type,text,attributedBody,guid) VALUES (?,?,?,?,?,?,?,?,?)',(rid,date,1 if rid in (2,5) else 0,0 if rid in (2,5) else 2 if rid==3 else 1,0,2000 if rid==8 else 0,'PRIVATE_BODY_SENTINEL','PRIVATE_PREVIEW_SENTINEL','guid-'+str(rid)))
        db.executemany('INSERT INTO chat_message_join VALUES (?,?)',[(1,1),(1,1),(1,2),(2,3),(3,4),(3,5),(1,7),(1,8),(1,9),(3,9),(1,10)])
        db.execute("INSERT INTO attachment VALUES ('PRIVATE_ATTACHMENT_SENTINEL')");db.commit();db.close()
        self.queries=[]
        def runner(sql):
            self.queries.append(sql)
            db=sqlite3.connect('file:'+self.path+'?mode=ro',uri=True);db.execute('PRAGMA query_only=ON')
            try:return [[str(v) if v is not None else '' for v in row] for row in db.execute(sql)]
            finally:db.close()
        self.source=c.Source(self.path,runner)
        self.config={'database':self.path,'device_id':'33333333-3333-4333-a333-333333333333','contacts':[],'reconcile_hours':24,'_mapping':{'+13175550101':A,'synthetic@example.test':A,'+13175550102':B},'_mapping_hash':'one'}
        self.cache=c.cache_open(os.path.join(self.temp.name,'metadata.sqlite'))
    def tearDown(self):self.cache.close();self.temp.cleanup()
    def test_direct_group_handles_unlinked_and_privacy(self):
        before=hashlib.sha256(Path(self.path).read_bytes()).digest()
        c.collect(self.source,self.cache,self.config,now=NOW,force=True);p=c.snapshot(self.cache,self.config,now=NOW)
        a=next(x for x in p['contacts'] if x['contactId']==A);b=next(x for x in p['contacts'] if x['contactId']==B)
        self.assertEqual(a['direct']['incoming'],2);self.assertEqual(a['direct']['outgoing'],1)
        self.assertEqual(a['group']['incoming'],1);self.assertEqual(a['group']['outgoing'],1)
        self.assertEqual(b['group']['outgoing'],1);self.assertEqual(b['direct']['outgoing'],0)
        self.assertEqual(p['quality']['unlinked'],1);self.assertEqual(p['quality']['ambiguous'],1);self.assertEqual(p['quality']['invalidTimestamp'],2)
        payload=json.dumps(p)
        for forbidden in ['PRIVATE_BODY_SENTINEL','PRIVATE_PREVIEW_SENTINEL','PRIVATE_ATTACHMENT_SENTINEL','synthetic@example.test','13175550101','guid-']:
            self.assertNotIn(forbidden,payload)
        for sql in self.queries:
            self.assertNotIn('text',sql);self.assertNotIn('attributedBody',sql);self.assertNotIn('attachment',sql);self.assertNotIn('SELECT *',sql)
        self.assertEqual(before,hashlib.sha256(Path(self.path).read_bytes()).digest())
    def test_incremental_retries_deletions_and_duplicate_guids(self):
        c.collect(self.source,self.cache,self.config,now=NOW,force=True);first=c.snapshot(self.cache,self.config,now=NOW)
        c.collect(self.source,self.cache,self.config,now=NOW+60);again=c.snapshot(self.cache,self.config,now=NOW+60)
        self.assertEqual(first['contacts'],again['contacts'])
        db=sqlite3.connect(self.path);db.execute('INSERT INTO message SELECT date,is_from_me,handle_id,item_type,associated_message_type,text,attributedBody,guid FROM message WHERE ROWID=1');db.execute('INSERT INTO chat_message_join VALUES (1,11)');db.commit();db.close()
        c.collect(self.source,self.cache,self.config,now=NOW+120);self.assertEqual(first['contacts'],c.snapshot(self.cache,self.config,now=NOW+120)['contacts'])
        db=sqlite3.connect(self.path);db.execute('DELETE FROM message WHERE ROWID IN (1,11)');db.commit();db.close()
        c.collect(self.source,self.cache,self.config,now=NOW+180,force=True);a=next(x for x in c.snapshot(self.cache,self.config,now=NOW+180)['contacts'] if x['contactId']==A);self.assertEqual(a['direct']['incoming'],1)
    def test_mapping_change_reconciles_and_unknown_schema_fails_closed(self):
        c.collect(self.source,self.cache,self.config,now=NOW,force=True)
        self.config['_mapping']={'+13175550101':B};self.config['_mapping_hash']='changed'
        self.assertTrue(c.collect(self.source,self.cache,self.config,now=NOW+10)['fullReconciliation'])
        self.assertEqual(len(c.snapshot(self.cache,self.config,now=NOW+10)['contacts']),1)
        db=sqlite3.connect(self.path);db.execute('ALTER TABLE message RENAME TO different');db.commit();db.close()
        with self.assertRaises(ValueError):c.collect(self.source,self.cache,self.config,now=NOW+20)
    def test_dates_normalization_and_metadata_counts(self):
        seconds=NOW-c.APPLE_EPOCH
        for scale in (1,1000,1000000,1000000000):self.assertEqual(c.apple_time(seconds*scale,NOW)[0],NOW)
        for value in (None,0,'bad',float('nan'),float('inf'),-1):self.assertIsNone(c.apple_time(value,NOW))
        self.assertEqual(c.normalize_handle('(317) 555-0101'),'+13175550101');self.assertEqual(c.normalize_handle('SYNTHETIC@EXAMPLE.TEST'),'synthetic@example.test')
        self.assertIsNone(c.normalize_handle('123'))
        totals=self.source.inspect().totals();self.assertEqual(totals['total'],10);self.assertEqual(totals['linked'],9);self.assertEqual(totals['unlinked'],1)
    def test_cache_symlinks_and_noncache_databases_are_rejected(self):
        link=os.path.join(self.temp.name,'unsafe');os.symlink(self.path,link)
        with self.assertRaises(ValueError):c.cache_open(link)
        with self.assertRaises(ValueError):c.cache_open(self.path)
    def test_small_increment_is_bounded_on_large_database(self):
        db=sqlite3.connect(self.path)
        for rid in range(20,1020):db.execute('INSERT INTO message(ROWID,date,is_from_me,handle_id,item_type,associated_message_type,guid) VALUES (?,?,?,?,?,?,?)',(rid,(NOW-c.APPLE_EPOCH)*1000000000,1,0,0,0,'g'+str(rid)));db.execute('INSERT INTO chat_message_join VALUES (1,?)',(rid,))
        db.commit();db.close();c.collect(self.source,self.cache,self.config,now=NOW,force=True)
        info=c.collect(self.source,self.cache,self.config,now=NOW+60);self.assertFalse(info['fullReconciliation']);self.assertLessEqual(info['scannedThisRun'],100)

class FailureAndPrivacyTest(unittest.TestCase):
    setUp = CollectorTest.setUp
    tearDown = CollectorTest.tearDown
    def test_pending_upload_survives_outage_and_retries_exact_body_without_rescanning(self):
        from unittest import mock
        config_path=os.path.join(self.temp.name,'config.json')
        raw={'database':self.path,'device_id':self.config['device_id'],'endpoint':c.EXPECTED_ENDPOINT,'reconcile_hours':24,'contacts':[{'contact_id':A,'handles':['+13175550101','synthetic@example.test']},{'contact_id':B,'handles':['+13175550102']}]}
        Path(config_path).write_text(json.dumps(raw));os.chmod(config_path,0o600);self.cache.close()
        sent=[]
        def fail(body, config):sent.append(body);raise RuntimeError('synthetic outage')
        with mock.patch.object(c,'Source',return_value=self.source),mock.patch.object(c,'transmit',side_effect=fail),mock.patch.object(c.sys,'argv',['collector.py','sync','--config',config_path,'--confirm-manual-sync']):
            with self.assertRaises(RuntimeError):c.main()
        cache=c.cache_open(os.path.join(self.temp.name,'metadata.sqlite'));pending=c.get_meta(cache,'pending');self.assertEqual(pending,sent[0]);self.assertEqual(c.get_meta(cache,'sequence','0'),'0');cache.close()
        def success(body,config):sent.append(body);return {'accepted':True,'sequence':json.loads(body)['sequence'],'digest':hashlib.sha256(body.encode()).hexdigest()}
        with mock.patch.object(c,'Source',return_value=self.source),mock.patch.object(self.source,'messages',side_effect=AssertionError('Must retry pending body first')),mock.patch.object(c,'transmit',side_effect=success),mock.patch.object(c.sys,'argv',['collector.py','sync','--config',config_path,'--confirm-manual-sync']):c.main()
        self.assertEqual(sent[0],sent[1]);cache=c.cache_open(os.path.join(self.temp.name,'metadata.sqlite'));self.assertIsNone(c.get_meta(cache,'pending'));self.assertEqual(c.get_meta(cache,'sequence'),'1');cache.close()
    def test_local_dry_run_has_no_network_or_source_mutation_and_emits_no_identifiers(self):
        import contextlib,io
        from unittest import mock
        path=os.path.join(self.temp.name,'config.json');Path(path).write_text(json.dumps({'database':self.path,'device_id':self.config['device_id'],'endpoint':c.EXPECTED_ENDPOINT,'contacts':[]}));os.chmod(path,0o600);self.cache.close();before=Path(self.path).read_bytes();out=io.StringIO()
        with mock.patch.object(c,'Source',return_value=self.source),mock.patch.object(c,'transmit',side_effect=AssertionError('No network in dry run')),mock.patch.object(c.sys,'argv',['collector.py','dry-run','--config',path]),contextlib.redirect_stdout(out):c.main()
        parsed=json.loads(out.getvalue());self.assertEqual(parsed['scanned'],10);self.assertEqual(before,Path(self.path).read_bytes());self.assertNotIn('PRIVATE_',out.getvalue());self.assertNotIn('example.test',out.getvalue())
    def test_read_only_cli_retries_busy_without_echoing_errors(self):
        from unittest import mock
        first=mock.Mock();first.returncode=1;first.communicate.return_value=(b'',b'database is locked PRIVATE_BODY_SENTINEL')
        second=mock.Mock();second.returncode=0;second.communicate.return_value=(b'1\n',b'')
        source=c.Source(self.path)
        with mock.patch.object(c.subprocess,'Popen',side_effect=[first,second]) as launch,mock.patch.object(c.threading,'Timer'),mock.patch.object(c.time,'sleep'):
            self.assertEqual(source.query('SELECT count(*) FROM message'),[['1']]);self.assertEqual(launch.call_count,2);args=launch.call_args[0][0];self.assertTrue(args[-1].endswith('?mode=ro'));self.assertNotIn('-readonly',args)
    def test_cli_error_does_not_echo_private_configuration_fields(self):
        import subprocess
        path=os.path.join(self.temp.name,'bad.json');Path(path).write_text(json.dumps({'PRIVATE_BODY_SENTINEL':'PRIVATE_PREVIEW_SENTINEL'}));os.chmod(path,0o600)
        process=subprocess.run([os.sys.executable,str(Path(c.__file__)),'dry-run','--config',path],text=True,capture_output=True)
        self.assertNotEqual(process.returncode,0);self.assertNotIn('PRIVATE_',process.stdout+process.stderr)

class ManualExportTest(unittest.TestCase):
    setUp = CollectorTest.setUp
    tearDown = CollectorTest.tearDown
    def test_export_is_private_local_only_and_never_overwrites(self):
        from unittest import mock
        import contextlib, io
        path=os.path.join(self.temp.name,'config.json');Path(path).write_text(json.dumps({'database':self.path,'device_id':self.config['device_id'],'endpoint':c.EXPECTED_ENDPOINT,'contacts':[{'contact_id':A,'handles':['+13175550101']}]}));os.chmod(path,0o600)
        output=os.path.join(self.temp.name,'export.json');before=Path(self.path).read_bytes();self.cache.close()
        with mock.patch.object(c,'Source',return_value=self.source),mock.patch.object(c,'transmit',side_effect=AssertionError('No export network')),mock.patch.object(c.sys,'argv',['collector.py','export','--config',path,'--output',output]),contextlib.redirect_stdout(io.StringIO()):
            c.main();payload=json.loads(Path(output).read_text());self.assertEqual(payload['sequence'],1);self.assertEqual(os.stat(output).st_mode & 0o777,0o600)
            for forbidden in ['PRIVATE_', '13175550101', 'example.test', 'guid-']:self.assertNotIn(forbidden,Path(output).read_text())
            self.assertEqual(before,Path(self.path).read_bytes())
            with self.assertRaises(OSError):c.main()
        output2=os.path.join(self.temp.name,'second.json')
        with mock.patch.object(c,'Source',return_value=self.source),mock.patch.object(c.sys,'argv',['collector.py','export','--config',path,'--output',output2]),contextlib.redirect_stdout(io.StringIO()):c.main()
        self.assertEqual(json.loads(Path(output2).read_text())['sequence'],2)

class RelayPairTest(unittest.TestCase):
    setUp = CollectorTest.setUp
    tearDown = CollectorTest.tearDown
    def test_pair_preserves_mapping_and_snapshot_resets_pending_only_and_needs_no_network(self):
        from unittest import mock
        import contextlib, io
        config={'database':self.path,'device_id':self.config['device_id'],'endpoint':c.EXPECTED_ENDPOINT,'contacts':[{'contact_id':A,'handles':['+13175550101']}]}
        path=os.path.join(self.temp.name,'config.json');Path(path).write_text(json.dumps(config));os.chmod(path,0o600)
        c.put_meta(self.cache,'pending','old');c.put_meta(self.cache,'last_success','old');self.cache.commit();self.cache.close();before=Path(self.path).read_bytes()
        with mock.patch.object(c,'Source',return_value=self.source),mock.patch.object(c,'transmit',side_effect=AssertionError('No network during pair')),mock.patch.object(c.getpass,'getpass',return_value='a'*64),mock.patch.object(c,'keychain_write') as write,mock.patch.object(c.sys,'argv',['collector.py','pair','--config',path,'--base-sequence','7']),contextlib.redirect_stdout(io.StringIO()):c.main()
        write.assert_called_once_with(c.SIGNING_SERVICE,'a'*64);updated=json.loads(Path(path).read_text());self.assertEqual(updated['contacts'],config['contacts']);self.assertEqual(updated['device_id'],config['device_id']);self.assertEqual(updated['endpoint'],c.RELAY_ENDPOINT);self.assertNotIn('a'*64,Path(path).read_text());self.assertEqual(before,Path(self.path).read_bytes())
        self.cache=c.cache_open(os.path.join(self.temp.name,'metadata.sqlite'));self.assertEqual(c.get_meta(self.cache,'sequence'),'7');self.assertIsNone(c.get_meta(self.cache,'pending'));self.assertIsNone(c.get_meta(self.cache,'last_success'))
    def test_relay_transmission_never_reads_or_sends_sites_token(self):
        from unittest import mock
        payload=json.dumps({'sequence':1});digest=hashlib.sha256(payload.encode()).hexdigest();process=mock.Mock();process.returncode=0;process.communicate.return_value=(json.dumps({'accepted':True,'sequence':1,'digest':digest,'duplicate':False}).encode(),b'')
        config={'endpoint':c.RELAY_ENDPOINT,'device_id':self.config['device_id']}
        with mock.patch.object(c,'keychain_read',return_value='a'*64) as read,mock.patch.object(c.subprocess,'Popen',return_value=process) as launch:
            c.transmit(payload,config);read.assert_called_once_with(c.SIGNING_SERVICE);stdin=process.communicate.call_args[0][0];self.assertNotIn(b'OAI-Sites-Authorization',stdin);self.assertIn(('X-CRM-Body-SHA256: '+digest).encode(),stdin);self.assertIn(('X-CRM-Key-Tag: '+hashlib.sha256(('a'*64).encode()).hexdigest()).encode(),stdin);self.assertNotIn('a'*64,' '.join(launch.call_args[0][0]));self.assertEqual(launch.call_args[0][0][-1],c.RELAY_ENDPOINT)

class UploadTransportTest(unittest.TestCase):
    def test_named_file_preserves_exact_bytes_mode_and_cleanup_on_error(self):
        from unittest import mock
        payload = json.dumps({'sequence':1,'synthetic':'caf\u00e9'},ensure_ascii=False)
        encoded=payload.encode('utf-8');digest=hashlib.sha256(encoded).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            config={'endpoint':c.RELAY_ENDPOINT,'device_id':A,'_directory':directory}
            for returncode in (0,22):
                def launch(args,**kwargs):
                    self.assertTrue(kwargs['close_fds']);path=args[args.index('--data-binary')+1][1:]
                    self.assertNotIn('/dev/fd/',path);self.assertEqual(Path(path).read_bytes(),encoded);self.assertEqual(os.stat(path).st_mode&0o777,0o600);self.assertEqual(os.path.dirname(path),directory)
                    process=mock.Mock();process.returncode=returncode;process.communicate.return_value=(json.dumps({'accepted':True,'sequence':1,'digest':digest,'duplicate':False}).encode(),b'');return process
                with mock.patch.object(c,'keychain_read',return_value='a'*64),mock.patch.object(c.subprocess,'Popen',side_effect=launch):
                    if returncode:
                        with self.assertRaises(c.CollectorFailure):c.transmit(payload,config)
                    else:c.transmit(payload,config)
                self.assertEqual(os.listdir(directory),[])
    def test_actual_curl_sends_signed_bytes_over_synthetic_loopback(self):
        from unittest import mock
        import threading,http.server,subprocess
        payload=json.dumps({'sequence':1,'synthetic':'metadata-only'});secret='a'*64;observed={}
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                raw=self.rfile.read(int(self.headers['Content-Length']));digest=hashlib.sha256(raw).hexdigest();expected=c.hmac.new(secret.encode(),('POST\n/api/crm/ingest\n'+self.headers['X-CRM-Time']+'\n'+digest).encode(),hashlib.sha256).hexdigest();observed['bytes']=raw;observed['valid']=self.headers['X-CRM-Signature']==expected;self.send_response(200);self.end_headers();self.wfile.write(json.dumps({'accepted':True,'sequence':1,'digest':digest,'duplicate':False}).encode())
        server=http.server.HTTPServer(('127.0.0.1',0),Handler);server.timeout=5;thread=threading.Thread(target=server.handle_request);thread.start();real=subprocess.Popen
        def local(args,**kwargs):
            self.assertEqual(args[-1],c.RELAY_ENDPOINT);args=list(args);args[-1]='http://127.0.0.1:'+str(server.server_port)+'/api/crm/ingest';args[args.index('--proto')+1]='=http';return real(args,**kwargs)
        try:
            with mock.patch.object(c,'keychain_read',return_value=secret),mock.patch.object(c.subprocess,'Popen',side_effect=local):c.transmit(payload,{'endpoint':c.RELAY_ENDPOINT,'device_id':A})
        finally:thread.join(6);server.server_close()
        self.assertEqual(observed['bytes'],payload.encode());self.assertTrue(observed['valid'])

if __name__=='__main__':unittest.main()
