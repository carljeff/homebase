import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {registerHooks} from 'node:module';import ts from 'typescript';import {parseHTML} from 'linkedom';import {createElement,act} from 'react';
registerHooks({resolve(specifier,context,next){if(['./friend-memory','./contact-review-inbox'].includes(specifier)&&context.parentURL?.endsWith('/app/friends.tsx'))return next(new URL(specifier+'.tsx',context.parentURL).href,context);return next(specifier,context);},load(url,context,next){if(url.endsWith('/app/friends.tsx')||url.endsWith('/app/friend-memory.tsx')||url.endsWith('/app/contact-review-inbox.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}});
const {document,window}=parseHTML('<html><body><div id="root"></div></body></html>');document.oninput=null;globalThis.document=document;globalThis.window=window;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=await import('react-dom/client');const {default:Friends}=await import('../app/friends.tsx');
test('friend UI keeps direct/group activity separate and hides activity for opted-out contacts',async()=>{const snapshot=JSON.parse(execFileSync('python3',['tests/messages-crm/make_payload.py'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));globalThis.fetch=async()=>({ok:true,json:async()=>[{id:snapshot.deviceId,label:'Synthetic Mac',enabled:true,isOwner:false,lastSuccess:snapshot.generatedAt,sequence:1,snapshot}]});const host=document.getElementById('root');const root=createRoot(host);const rows=[{id:snapshot.contacts[0].contactId,kind:'friend',version:1,updatedAt:snapshot.generatedAt,data:{name:'Synthetic Friend',notes:'',trackMessaging:true,reminderDays:null}}];await act(async()=>root.render(createElement(Friends,{rows,action:async()=>true,busy:false})));assert.match(host.textContent,/All observed direct: 2 incoming \/ 1 outgoing/);assert.match(host.textContent,/All observed group: 1 incoming \/ 1 outgoing/);assert.match(host.textContent,/not personal outreach/);assert.ok(!host.textContent.includes('PRIVATE_'));await act(async()=>root.render(createElement(Friends,{rows:[{...rows[0],data:{...rows[0].data,trackMessaging:false}}],action:async()=>true,busy:false})));assert.match(host.textContent,/Messaging tracking is off/);assert.doesNotMatch(host.textContent,/All observed direct/);await act(async()=>root.unmount());});
test('manual import validates and previews before confirming',async()=>{const snapshot=JSON.parse(execFileSync('python3',['tests/messages-crm/make_payload.py'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));let uploads=[];globalThis.fetch=async(url,options)=>{if(url==='/api/crm/import')uploads.push(JSON.parse(options.body));return {ok:true,json:async()=>url==='/api/crm/import'?{accepted:true,duplicate:uploads.length>1}:[]};};const host=document.getElementById('root'),root=createRoot(host);await act(async()=>root.render(createElement(Friends,{rows:[],action:async()=>true,busy:false})));const input=host.querySelector('input[type="file"]');async function choose(value){Object.defineProperty(input,'files',{configurable:true,value:[{size:JSON.stringify(value).length,text:async()=>JSON.stringify(value)}]});await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));}async function click(text){const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,text);await act(async()=>b.dispatchEvent(new window.Event('click',{bubbles:true})));}await choose({...snapshot,text:'PRIVATE_BODY_SENTINEL'});assert.match(host.textContent,/Invalid metadata file/);assert.equal(uploads.length,0);await choose(snapshot);assert.match(host.textContent,/Ready to review/);assert.equal(uploads.length,0);await click('Cancel import');await choose(snapshot);await click('Confirm metadata import');assert.deepEqual(uploads,[snapshot]);assert.match(host.textContent,/Metadata imported/);await choose(snapshot);await click('Confirm metadata import');assert.match(host.textContent,/Already imported/);await act(async()=>root.unmount());});
test('friend overview sorts oldest first and collapses help and detailed metrics',async()=>{
 const snapshot=JSON.parse(execFileSync('python3',['tests/messages-crm/make_payload.py'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const base=snapshot.contacts[0];const newer={...base,contactId:'11111111-1111-4111-8111-111111111111',group:{...base.group,lastIncoming:'2026-11-04T20:00:00Z'}};snapshot.contacts.push(newer);
 globalThis.fetch=async()=>({ok:true,json:async()=>[{id:snapshot.deviceId,label:'Mac',enabled:true,isOwner:true,lastSuccess:snapshot.generatedAt,snapshot}]});
 const host=document.getElementById('root'),root=createRoot(host);
 const row=(id,name,trackMessaging=true)=>({id,kind:'friend',version:1,data:{name,notes:'',trackMessaging,reminderDays:null}});
 await act(async()=>root.render(createElement(Friends,{rows:[row(newer.contactId,'Newest'),row(base.contactId,'Older'),row('unknown','Untracked',false)],action:async()=>true,busy:false})));
 const cards=[...host.querySelectorAll('.friend-card')];assert.deepEqual(cards.map(c=>c.querySelector('h3').textContent),['Untracked','Older','Newest']);
 assert.equal(cards[0].querySelector('time'),null);assert.ok(cards[1].querySelector('time').getAttribute('dateTime'));
 for(const card of cards)assert.equal(card.querySelector('details').hasAttribute('open'),false);
 assert.equal(host.querySelector('.friends-tools').hasAttribute('open'),false);
 assert.ok(host.querySelector('input[type="file"]').closest('.friends-tools'));
 assert.ok(cards[2].textContent.includes('Last contact'));await act(async()=>root.unmount());
});
test('birthday highlight overrides recency and birthday and partner edit without cluttering cards',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>[]});
 const host=document.getElementById('root'),root=createRoot(host),saved=[];
 const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Indiana/Indianapolis',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const birthday=dateParts.find(p=>p.type==='month').value+'-'+dateParts.find(p=>p.type==='day').value;
 const friend={id:'birthday-contact',kind:'friend',version:3,data:{name:'Z Birthday Friend',notes:'Keep these notes',birthday,partner:'PRIVATE_PARTNER',trackMessaging:true,reminderDays:14}};
 await act(async()=>root.render(createElement(Friends,{rows:[{...friend,id:'ordinary',data:{...friend.data,name:'A Ordinary',birthday:null,partner:''}},friend],action:async input=>{saved.push(input);return true;},busy:false})));
 const cards=[...host.querySelectorAll('.friend-card')];assert.equal(cards[0].querySelector('h3').textContent,friend.data.name);assert.match(cards[0].className,/friend-birthday/);assert.equal(cards[0].querySelector('.friend-birthday-badge').textContent,'🎂 Birthday today');assert.equal(cards[1].querySelector('.friend-birthday-badge'),null);
 assert.ok(cards[0].querySelector('.friend-details').textContent.includes('PRIVATE_PARTNER'));assert.equal(cards[0].querySelector('.friend-details').hasAttribute('open'),false);
 assert.ok(!host.querySelector('form'));assert.ok(!cards[0].textContent.includes(birthday));
 await act(async()=>cards[0].querySelector('button').dispatchEvent(new window.Event('click',{bubbles:true})));
 const form=host.querySelector('form');assert.ok(form.querySelector('fieldset').textContent.includes('Birthday'));assert.equal(form.querySelectorAll('select').length,2);
 const partner=[...form.querySelectorAll('label')].find(l=>l.textContent==='Partner').querySelector('input');assert.equal(partner.value,'PRIVATE_PARTNER');
 await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(saved[0].data.birthday,birthday);assert.equal(saved[0].data.partner,'PRIVATE_PARTNER');assert.equal(saved[0].data.notes,'Keep these notes');assert.equal(saved[0].version,3);
 await act(async()=>host.querySelector('.friend-card button').dispatchEvent(new window.Event('click',{bubbles:true})));
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Clear birthday').dispatchEvent(new window.Event('click',{bubbles:true})));
 await act(async()=>host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(saved[1].data.birthday,null);assert.equal(saved[1].data.partner,'PRIVATE_PARTNER');await act(async()=>root.unmount());
});

test('Quick Add starts with only a name required, previews duplicates and uses a stable capture ID',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>[]});const host=document.getElementById('root'),root=createRoot(host),calls=[];
 await act(async()=>root.render(createElement(Friends,{rows:[],action:async p=>{calls.push(p);return false;},busy:false})));
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Quick add person').click());
 const form=host.querySelector('form');assert.equal(form.querySelectorAll('[required]').length,1);assert.equal(form.querySelector('details').hasAttribute('open'),false);
 const name=form.querySelector('input');const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(name),'value').set;
 await act(async()=>{setter.call(name,'Synthetic Quick Entry');name.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(calls[0].data.name,'Synthetic Quick Entry');assert.equal(calls[0].action,'friend_quick_add');assert.ok(calls[0].data.metOn);
 await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(calls[0].requestId,calls[1].requestId);
 const existing={id:crypto.randomUUID(),kind:'friend',version:1,data:{name:'Synthetic Quick Entry',notes:'Existing memory',trackMessaging:false}};
 await act(async()=>root.render(createElement(Friends,{rows:[existing],action:async()=>true,busy:false})));
 assert.ok(host.querySelector('.friend-duplicates'));assert.equal([...host.querySelectorAll('button')].find(b=>b.textContent==='Add person').disabled,true);
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Open Synthetic Quick Entry').click());assert.equal(host.querySelector('.friend-quick-add'),null);assert.equal(host.querySelector('form h3').textContent,'Edit friend');
 await act(async()=>root.unmount());
});

test('relationship notes, search, views and suggestion dismissal use the current versioned contact',async()=>{
 const {setFriendsOwnerForTest}=await import('./server-env.mjs'),{friendOperation}=await import('../lib/friend-operations.ts'),{householdToday}=await import('../lib/friend-memory.ts');
 const owner='ui-memory-owner';setFriendsOwnerForTest(owner);const now=new Date(),today=householdToday(now);
 let person=await friendOperation({action:'friend_quick_add',requestId:crypto.randomUUID(),data:{name:'UI Memory Person',meetingPlace:'Cycling event',metOn:today,notes:'Original general memory'}},owner,now);
 person=await friendOperation({action:'friend_update',id:person.id,version:person.version,patch:{followUpOn:today,birthday:today.slice(5),partner:'Existing partner'}},owner,now);
 const host=document.getElementById('root'),root=createRoot(host),calls=[];let pending=Promise.resolve();
 const render=()=>root.render(createElement(Friends,{rows:[person],action:p=>{pending=(async()=>{calls.push(p);person=await friendOperation(p,owner,now);render();return true;})();return pending;},busy:false}));
 const click=async text=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,text);await act(async()=>{b.click();await pending;});};
 const input=async(node,value)=>{const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node),'value').set;await act(async()=>{setter.call(node,value);node.dispatchEvent(new window.Event('input',{bubbles:true}));});};
 globalThis.fetch=async()=>({ok:true,json:async()=>[]});await act(async()=>render());
 try{
 await click('Saw them today');assert.equal(person.data.lastInPerson,today);
 await click('Add note');await input(host.querySelector('.friend-note-form textarea'),'Ask about camping');
 await act(async()=>{host.querySelector('.friend-note-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await pending;});
 assert.equal(person.data.relationshipNotes.length,1);assert.equal(person.data.notes,'Original general memory');assert.equal(person.data.partner,'Existing partner');
 const created=person.data.relationshipNotes[0].createdAt;
 await click('Edit note');await input(host.querySelector('.friend-note-form textarea'),'Updated camping plans');
 await act(async()=>{host.querySelector('.friend-note-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await pending;});
 assert.equal(person.data.relationshipNotes[0].createdAt,created);assert.equal(person.data.relationshipNotes[0].text,'Updated camping plans');
 await input(host.querySelector('.friend-view-controls input'),'camping');assert.equal(host.querySelectorAll('.friend-card').length,1);
 await input(host.querySelector('.friend-view-controls input'),'astronaut');assert.equal(host.querySelectorAll('.friend-card').length,0);
 await input(host.querySelector('.friend-view-controls input'),'');await click('Recently met');assert.ok(host.querySelector('.friend-meeting-preview').textContent.includes('Cycling event'));
 await click('Upcoming dates');assert.ok(host.querySelector('.friend-date-preview').textContent.includes('Birthday'));
 await click('Stay connected');assert.ok(host.querySelector('.friend-suggestions').textContent.includes('You set a follow-up'));
 await click('Dismiss');assert.equal(person.data.suggestionState[0].disposition,'dismissed');assert.equal(host.querySelectorAll('.friend-suggestions article').length,0);
 await click('People');globalThis.confirm=()=>true;await click('Delete note');assert.equal(person.data.relationshipNotes.length,0);assert.equal(person.data.notes,'Original general memory');
 assert.ok(calls.every(p=>p.id===person.id));assert.ok(calls.every(p=>Number.isInteger(p.version)));
 }finally{await act(async()=>root.unmount());}
});

test('new people inbox approves or ignores explicitly, links matching friends and refreshes without exposing handles',async()=>{
 const {default:Inbox}=await import('../app/contact-review-inbox.tsx');let items=[{deviceId:'11111111-1111-4111-a111-111111111111',candidateId:'a'.repeat(64),version:1,status:'pending',contactId:null,name:'Synthetic Candidate',directOut:2,lastOutgoing:'2026-11-04T20:00:00Z',existingContactId:null}],posts=[],refreshes=0;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/crm/review');if(options?.method==='POST'){posts.push(JSON.parse(options.body));items=posts.at(-1).action==='ignore'?[]:items.map(i=>({...i,status:'approved',version:2}));}return {ok:true,json:async()=>options?.method==='POST'?{status:'approved'}:{lastSync:'2026-11-05T20:00:00Z',candidates:items}};};
 const host=document.getElementById('root'),root=createRoot(host),rows=[{id:'22222222-2222-4222-a222-222222222222',kind:'friend',version:7,data:{name:'Synthetic Candidate',trackMessaging:false}}];
 await act(async()=>root.render(createElement(Inbox,{rows,onRefresh:async()=>{refreshes++;}})));assert.match(host.textContent,/1 to review/);assert.match(host.textContent,/2 outgoing direct messages/);assert.ok(!host.textContent.includes('PRIVATE_'));assert.equal(posts.length,0);assert.equal(host.querySelector('details').hasAttribute('open'),false);
 const click=async text=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,text);await act(async()=>button.dispatchEvent(new window.Event('click',{bubbles:true})));};
 await click('Link & enable messaging');assert.equal(posts[0].contactId,rows[0].id);assert.equal(posts[0].friendVersion,7);assert.equal(posts[0].confirmMetadata,true);assert.equal(refreshes,1);assert.match(host.textContent,/Waiting for the Mini/);assert.ok(!host.textContent.includes('Add & track messaging'));
 items=[{...items[0],status:'pending',version:3,candidateId:'b'.repeat(64),name:'Synthetic Other'}];await click('Refresh new people');await click('Ignore');assert.equal(posts[1].action,'ignore');assert.equal(posts[1].confirmMetadata,undefined);assert.match(host.textContent,/No new people to review/);await act(async()=>root.unmount());
});
