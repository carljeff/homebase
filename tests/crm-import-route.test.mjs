import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {execFileSync} from 'node:child_process';
registerHooks({load(url,context,next){if(url.endsWith('/app/chatgpt-auth.ts'))return {format:'module',source:'export async function getChatGPTUser(){return globalThis.__crmImportUser;}',shortCircuit:true};return next(url,context);}});
const {POST}=await import('../app/api/crm/import/route.ts');const {operate}=await import('../lib/operations');
test('manual import route requires sign-in and origin, limits uploads, and rejects private fields',async()=>{
 const body=JSON.parse(execFileSync('python3',['tests/messages-crm/make_payload.py'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const request=(value=body,origin='https://homebase.example',extra={})=>new Request('https://homebase.example/api/crm/import',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...extra},body:JSON.stringify(value)});
 globalThis.__crmImportUser=null;assert.equal((await POST(request())).status,401);
 globalThis.__crmImportUser={userId:'manual-route-owner'};assert.equal((await POST(request(body,'https://evil.example'))).status,403);
 assert.equal((await POST(request(body,'https://homebase.example',{'Content-Length':'1000001'}))).status,413);
 const rejected=await POST(request({...body,text:'PRIVATE_BODY_SENTINEL'}));assert.equal(rejected.status,400);assert.ok(!(await rejected.text()).includes('PRIVATE_BODY_SENTINEL'));
 const friend=await operate({action:'save',kind:'friend',data:{name:'Synthetic import friend',trackMessaging:true}},'manual-route-owner');
 body.contacts=body.contacts.slice(0,1);body.contacts[0].contactId=friend.id;body.deviceId=crypto.randomUUID();
 assert.equal((await POST(request())).status,200);const duplicate=await POST(request());assert.equal((await duplicate.json()).duplicate,true);
});
