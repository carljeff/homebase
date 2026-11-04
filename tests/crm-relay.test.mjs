import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {handle,deviceKey} from '../tools/messages-crm/relay/worker/index.js';
const {env}=await import('cloudflare:workers');const {prepareRelay,registerCollector,ingestMessaging,crmStatus,revokeCollector,bodyDigest}=await import('../lib/crm-store.ts');const {operate}=await import('../lib/operations');
test('synthetic collector snapshot passes relay and private ingestion with safe retries and revocation',async()=>{
 const master='b'.repeat(64);env.CRM_RELAY_MASTER=master;env.CRM_INGEST_MASTER_KEY='a'.repeat(64);
 const owner='relay-contract-owner',friend=await operate({action:'save',kind:'friend',data:{name:'Synthetic Relay Friend',trackMessaging:true}},owner),device=await registerCollector(owner,'Synthetic relay collector'),credentials=await prepareRelay(owner,device.deviceId);
 assert.equal(credentials.signingKey,await deviceKey(master,device.deviceId));
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('tools/messages-crm/relay/drizzle/0000_relay_limits.sql','utf8'));const relayEnv={CRM_RELAY_MASTER:master,HOMEBASE_ACCESS_TOKEN:'SYNTHETIC_SERVER_ONLY',DB:{prepare(sql){return {bind(...args){return {async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}}}}};
 const payload=JSON.parse(execFileSync('python3',['tests/messages-crm/make_payload.py'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));payload.deviceId=device.deviceId;payload.contacts=payload.contacts.slice(0,1);payload.contacts[0].contactId=friend.id;
 const now=Date.parse(payload.generatedAt),body=JSON.stringify(payload),stamp=String(now/1000),digest=await bodyDigest(body);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(credentials.signingKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('POST\n/api/crm/ingest\n'+stamp+'\n'+digest))).toString('hex');
 const request=()=>new Request('https://relay.example/api/crm/ingest',{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Device':device.deviceId,'X-CRM-Time':stamp,'X-CRM-Signature':signature},body});
 const forward=async(url,options)=>{assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer SYNTHETIC_SERVER_ONLY');return ingestMessaging(new Request(url,options),now);};
 const first=await handle(request(),relayEnv,forward,now);assert.equal(first.status,200);const repeated=await handle(request(),relayEnv,forward,now);assert.equal((await repeated.json()).duplicate,true);
 const status=(await crmStatus(owner)).find(s=>s.id===device.deviceId);assert.equal(status.snapshot.contacts[0].direct.incoming,payload.contacts[0].direct.incoming);assert.ok(!JSON.stringify(status).includes('SYNTHETIC_SERVER_ONLY'));
 await revokeCollector(owner,device.deviceId);assert.equal((await handle(request(),relayEnv,forward,now)).status,401);db.close();
});
