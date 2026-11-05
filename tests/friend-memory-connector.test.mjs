import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){if(url.endsWith('/app/chatgpt-auth.ts'))return {format:'module',source:'export async function getChatGPTUser(){return globalThis.__memoryVisitor;} export async function requireChatGPTUser(){if(!globalThis.__memoryVisitor)throw Error("Sign in required");return globalThis.__memoryVisitor;}',shortCircuit:true};return next(url,context);}});
const {env}=await import('cloudflare:workers');env.FRIENDS_OWNER_EMAIL='owner@example.test';
const {POST}=await import('../app/mcp/route.ts'),api=await import('../app/api/homebase/route.ts');
const owner={userId:'connector-memory-owner',email:'owner@example.test'},other={userId:'connector-memory-other',email:'other@example.test'};
function request(path,body){return new Request('https://homebase.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://homebase.example'},body:JSON.stringify(body)});}
async function call(args){const r=await POST(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'homebase_friends',arguments:args}}));const body=await r.json();return body.result;}
const value=result=>JSON.parse(result.content[0].text);
test('same authenticated connector supports search, retry-safe creation, explicit updates, notes and follow-up dates',async()=>{
 globalThis.__memoryVisitor=owner;
 const tools=(await (await POST(request('/mcp',{id:1,method:'tools/list'}))).json()).result.tools;
 assert.ok(tools.find(t=>t.name==='homebase_friends'));assert.ok(tools.find(t=>t.name==='homebase_write'));assert.ok(tools.find(t=>t.name==='homebase_list'));
 assert.deepEqual(value(await call({action:'search',query:'Daniel Example'})),[]);
 let person=value(await call({action:'quick_add',requestId:crypto.randomUUID(),data:{name:'Daniel Example',meetingPlace:'Soccer field',howWeMet:'At a game',notes:'Talked about camping'}}));
 person=value(await call({action:'update',id:person.id,version:person.version,patch:{children:'Son Oliver',occupation:'Architect',partner:'PRIVATE_PARTNER',birthday:'05-17'}}));
 assert.equal(person.data.followUpOn,null);assert.equal(value(await call({action:'search',query:'camping architect'}))[0].id,person.id);
 person=value(await call({action:'note_save',id:person.id,version:person.version,note:{id:crypto.randomUUID(),date:'2026-11-04',text:'PRIVATE_MEMORY: Ask about a trip'}}));assert.equal(person.data.notes,'Talked about camping');
 person=value(await call({action:'update',id:person.id,version:person.version,patch:{followUpOn:'2026-11-18'}}));assert.equal(person.data.followUpOn,'2026-11-18');assert.equal(person.data.birthday,'05-17');assert.equal(person.data.relationshipNotes.length,1);
 const response=await api.POST(request('/api/homebase',{action:'friend_search',query:'Oliver'}));assert.equal(response.status,200);assert.equal((await response.json())[0].id,person.id);
 globalThis.__memoryVisitor=other;
 const hidden=(await (await POST(request('/mcp',{id:1,method:'tools/list'}))).json()).result.tools;assert.ok(!hidden.some(t=>t.name==='homebase_friends'));
 assert.equal((await call({action:'search',query:''})).isError,true);
 assert.equal((await api.POST(request('/api/homebase',{action:'friend_search',query:''}))).status,403);
 for(const action of ['friend_update','friend_note_save','friend_note_delete','friend_saw_today','friend_suggestion','friend_quick_add'])assert.equal((await api.POST(request('/api/homebase',{action,id:person.id,version:person.version,patch:{partner:'Forged'},userId:owner.userId}))).status,403);
 const shared=await api.GET();assert.ok(!(await shared.text()).includes('PRIVATE_'));
 globalThis.__memoryVisitor=null;assert.equal((await POST(request('/mcp',{id:1,method:'tools/list'}))).status,401);assert.equal((await api.POST(request('/api/homebase',{action:'friend_search'}))).status,401);
});
