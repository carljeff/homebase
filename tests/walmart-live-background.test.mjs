import {test} from 'node:test';import assert from 'node:assert/strict';
let listener,store={},clicks=0,hold=null;
globalThis.chrome={runtime:{id:'test-id',onMessage:{addListener:fn=>listener=fn}},tabs:{get:async()=>({active:true})},storage:{local:{get:async key=>({[key]:store[key]}),set:async patch=>Object.assign(store,patch)}},scripting:{executeScript:async()=>{clicks++;if(hold)await hold;return [{result:{status:'click_sent_verify_manually'}}];}}};
await import('../tools/walmart-one-item/background.mjs');
const message={type:'approve-one',approved:true,tabId:1,snapshot:{id:'123',url:'https://www.walmart.com/ip/123',title:'Almondmilk',quantity:1}};
const send=m=>new Promise(resolve=>listener(m,{id:'test-id'},resolve));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('background persists intent before injection and blocks duplicate and concurrent approvals',async()=>{
 store={};clicks=0;let release;hold=new Promise(resolve=>release=resolve);const first=send(message);await settle();assert.equal(store['attempt:123'].status,'uncertain');assert.equal(clicks,1);assert.equal((await send(message)).status,'blocked');release();assert.equal((await first).status,'click_sent_verify_manually');await settle();hold=null;
 const duplicate=await send(message);assert.match(duplicate.reason,/already has an attempted/);assert.equal(clicks,1);await settle();
});
test('invalid consent and quantities never inject a click',async()=>{for(const patch of [{approved:false},{snapshot:{...message.snapshot,quantity:2}},{snapshot:{...message.snapshot,url:'https://evil.test/ip/123'}}]){clicks=0;await send({...message,...patch});await settle();assert.equal(clicks,0);}});
test('storage failure prevents injection and uncertain injection blocks future retries',async()=>{
 store={};clicks=0;const save=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw Error('storage unavailable');};assert.match((await send(message)).reason,/storage unavailable/);await settle();assert.equal(clicks,0);chrome.storage.local.set=save;
 const inject=chrome.scripting.executeScript;chrome.scripting.executeScript=async()=>{throw Error('tab closed');};assert.equal((await send(message)).status,'uncertain');await settle();assert.equal(store['attempt:123'].status,'uncertain');chrome.scripting.executeScript=inject;await send(message);await settle();assert.equal(clicks,0);
});
test('confirmed no-click block permits a fresh approval while uncertain attempts stay locked',async()=>{
 store={};clicks=0;const inject=chrome.scripting.executeScript;chrome.scripting.executeScript=async()=>[{result:{status:'blocked',reason:'No button. Nothing clicked.'}}];
 assert.equal((await send(message)).status,'blocked');await settle();assert.equal(store['attempt:123'].status,'not_clicked');
 chrome.scripting.executeScript=inject;assert.equal((await send(message)).status,'click_sent_verify_manually');await settle();assert.equal(clicks,1);
});
test('recovery requires explicit absence confirmation and fresh matching product inspection, then separate add approval',async()=>{
 store={'attempt:123':{status:'uncertain'}};clicks=0;const inject=chrome.scripting.executeScript;
 await send({...message,type:'recover-one',confirmedAbsent:false});await settle();assert.equal(store['attempt:123'].status,'uncertain');assert.equal(clicks,0);
 chrome.scripting.executeScript=async opts=>{assert.deepEqual(opts.args,['identify']);return [{result:{status:'ready',snapshot:message.snapshot}}];};
 const result=await send({...message,type:'recover-one',confirmedAbsent:true});await settle();assert.equal(result.status,'unlocked');assert.equal(store['attempt:123'].status,'cleared');assert.equal(store['attempt:123'].previousStatus,'uncertain');assert.equal(clicks,0);
 chrome.scripting.executeScript=inject;assert.equal((await send(message)).status,'click_sent_verify_manually');await settle();assert.equal(clicks,1);
});
test('recovery of a changed or unavailable product preserves the attempt lock',async()=>{
 store={'attempt:123':{status:'uncertain'}};const inject=chrome.scripting.executeScript;
 chrome.scripting.executeScript=async()=>[{result:{status:'ready',snapshot:{...message.snapshot,id:'999'}}}];
 await send({...message,type:'recover-one',confirmedAbsent:true});await settle();assert.equal(store['attempt:123'].status,'uncertain');chrome.scripting.executeScript=inject;
});
