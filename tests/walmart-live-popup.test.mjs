import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';
test('popup recovery works without a matched cart button, requires inline absence confirmation, and never requests an add',async()=>{
 const {document}=parseHTML(readFileSync(new URL('../tools/walmart-one-item/popup.html',import.meta.url),'utf8'));globalThis.document=document;
 const snapshot={id:'123',title:'Almond Milk',url:'https://www.walmart.com/ip/123',quantity:1};let result={status:'blocked',reason:'No supported button.',snapshot};const messages=[];
 globalThis.chrome={runtime:{getManifest:()=>({version:'0.1.3'}),sendMessage:async message=>{messages.push(message);return {status:'unlocked',reason:'Unlocked only. Inspect again.'};}},tabs:{query:async()=>[{id:1}]},scripting:{executeScript:async()=>[{result}]}};
 globalThis.confirm=()=>{throw Error('Native popup dialogs must not be required');};
 await import('../tools/walmart-one-item/popup.mjs');const $=id=>document.getElementById(id);
 assert.match($('version').textContent,/0.1.3/);await $('inspect').onclick();assert.equal($('approve').disabled,true);assert.equal($('recover').disabled,true);assert.match($('status').textContent,/No supported button/);
 await $('recover').onclick();assert.equal(messages.length,0);
 $('absent').checked=true;$('absent').onchange();assert.equal($('recover').disabled,false);await $('recover').onclick();assert.equal(messages.length,1);assert.equal(messages[0].type,'recover-one');assert.equal(messages[0].confirmedAbsent,true);assert.equal($('recover').disabled,true);assert.equal($('approve').disabled,true);assert.match($('status').textContent,/Unlocked only/);
 result={status:'ready',snapshot};await $('inspect').onclick();assert.equal($('approve').disabled,true);$('consent').checked=true;$('consent').onchange();assert.equal($('approve').disabled,false);await $('approve').onclick();assert.equal(messages[1].type,'approve-one');assert.equal($('approve').disabled,true);
 result={status:'blocked',reason:'Not a product page'};await $('inspect').onclick();assert.equal($('recover').disabled,true);assert.equal($('approve').disabled,true);assert.match($('status').textContent,/Not a product page/);
});
