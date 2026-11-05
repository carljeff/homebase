# Synthetic-only protocol fixture. No real address book or secrets are read.
import contextlib,importlib.util,io,json,os,sys,tempfile
from pathlib import Path
from unittest import mock
spec=importlib.util.spec_from_file_location('contacts',str(Path(__file__).parents[2]/'tools/messages-crm/contacts.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
data=json.load(sys.stdin);requests=[]
with tempfile.TemporaryDirectory() as directory:
 config={'database':str(Path(directory,'unused.db')),'device_id':data['deviceId'],'endpoint':m.c.RELAY_ENDPOINT,'contacts':[]};config_path=str(Path(directory,'config.json'));m.atomic_json(config_path,config)
 roster=[{'contactId':data['friendId'],'name':'Existing Synthetic','trackMessaging':True}]
 cards=[{'name':'Existing Synthetic','handles':['+13175550101']},{'name':'New Synthetic','handles':['new@example.test']}]
 answers=iter(['1,2','','1','','n','IMPORT'])
 with contextlib.redirect_stdout(io.StringIO()):plan=m.choose_plan(cards,roster,config,lambda prompt:next(answers))
 m.atomic_json(str(Path(directory,m.PENDING)),plan)
 class FakeProcess:
  returncode=0
  def __init__(self,args,**kwargs):
   self.url=args[-1];self.body=Path(args[args.index('--data-binary')+1][1:]).read_text()
  def communicate(self,raw):
   headers={}
   for line in raw.decode().splitlines():
    header=json.loads(line.split(' = ',1)[1]);name,value=header.split(': ',1);headers[name]=value
   requests.append({'url':self.url,'headers':headers,'body':self.body});payload=json.loads(self.body)
   ack={'version':1,'action':'apply','selectionId':payload['selectionId'],'contacts':[{'contactId':e['contactId'],'name':e['name']} for e in payload['contacts']]}
   return json.dumps(ack).encode(),b''
 validated=m.c.load_config(config_path)
 with mock.patch.object(m.c,'keychain_read',return_value=data['signingKey']),mock.patch.object(m.c.subprocess,'Popen',FakeProcess):
  m.apply_plan(config_path,plan,lambda payload:m.c.transmit(json.dumps(payload,sort_keys=True,separators=(',',':')),validated,'/api/crm/contacts'))
 assert len(m.load_private(config_path)['contacts'])==2
 print(json.dumps(requests))
