import {test} from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {readFileSync} from 'node:fs';
test('desktop mock UI imports exported batch, requires resume, renders progress, pauses and stops',async()=>{
 const {document}=parseHTML(readFileSync(new URL('../tools/walmart-mock/index.html',import.meta.url),'utf8'));
 globalThis.document=document;globalThis.location={origin:'http://127.0.0.1:8765'};globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
 await import('../tools/walmart-mock/ui.mjs');
 const $=id=>document.getElementById(id);
 await $('file').onchange({target:{files:[{text:async()=>JSON.stringify({version:1,mode:'mock-only',items:[{id:'a',name:'Synthetic milk',quantity:2,url:'https://www.walmart.com/ip/123'}]})}]}});
 assert.match($('item').textContent,/1\/1: Synthetic milk — 2 packages/);assert.equal($('next').disabled,true);
 $('resume').onclick();assert.equal($('next').disabled,false);$('pause').onclick();assert.equal($('next').disabled,true);$('stop').onclick();$('resume').onclick();assert.equal($('next').disabled,true);
});
