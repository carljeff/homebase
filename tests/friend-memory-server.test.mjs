import {test} from 'node:test';import assert from 'node:assert/strict';
import {setFriendsOwnerForTest} from './server-env.mjs';
import {friendOperation,saveFriend} from '../lib/friend-operations.ts';
import {list} from '../lib/store.ts';import {operate} from '../lib/operations.ts';
import {crmStatus,registerCollector} from '../lib/crm-store.ts';
const {env}=await import('cloudflare:workers');env.CRM_INGEST_MASTER_KEY='a'.repeat(64);
const owner='memory-owner',now=new Date('2026-11-04T20:00:00Z');
const run=(input,date=now)=>{setFriendsOwnerForTest(owner);return friendOperation(input,owner,date);};
test('read/search is nonmutating for legacy contacts and does not manufacture creation dates',async()=>{
 setFriendsOwnerForTest(owner);const id=crypto.randomUUID(),data={name:'Legacy Synthetic',birthday:'05-17',partner:'Legacy Partner',notes:'Untouched note',trackMessaging:true,reminderDays:14};
 await env.DB.prepare("INSERT INTO records(id,kind,data,version,updated_at,updated_by) VALUES (?,'friend',?,7,?,?)").bind(id,JSON.stringify(data),'2026-10-01T12:00:00Z',owner).run();
 const before=(await list(owner)).find(r=>r.id===id);const result=await run({action:'friend_search',query:'Legacy Partner'});assert.ok(result.some(r=>r.id===id));assert.deepEqual((await list(owner)).find(r=>r.id===id),before);
});
test('quick capture requires only a name, retries idempotently and blocks unintended duplicates',async()=>{
 const requestId=crypto.randomUUID(),input={action:'friend_quick_add',requestId,data:{name:'Quick Synthetic'}};
 const first=await run(input),retry=await run(input,new Date('2026-11-05T20:00:00Z'));assert.deepEqual(retry,first);assert.equal(first.data.metOn,'2026-11-04');assert.equal(first.data.trackMessaging,false);
 await assert.rejects(run({...input,requestId:crypto.randomUUID(),data:{name:'Quick  Synthetic'}}),/Possible duplicate/);
 const other=await run({...input,requestId:crypto.randomUUID(),allowDuplicate:true});assert.notEqual(other.id,first.id);
 await assert.rejects(run({...input,data:{name:'Different person'}}),/Conflict/);
 const blank=await run({action:'friend_quick_add',requestId:crypto.randomUUID(),data:{name:'No Meeting Date',metOn:null}});assert.equal(blank.data.metOn,null);
});
test('partial updates and dated-note CRUD preserve partner, birthday, general notes and sync state',async()=>{
 setFriendsOwnerForTest(owner);let person=await saveFriend({data:{name:'Memory Synthetic',birthday:'05-17',partner:'PRIVATE_PARTNER',notes:'PRIVATE_GENERAL',trackMessaging:true}},owner,now);
 const device=await registerCollector(owner,'Memory fixture');const sourceBefore=await crmStatus(owner);
 person=await run({action:'friend_update',id:person.id,version:person.version,patch:{meetingPlace:'Soccer',occupation:'Architect',children:'Oliver',interests:'Camping',followUpOn:'2026-11-18'}});
 const note={id:crypto.randomUUID(),date:'2026-11-04',text:'PRIVATE_NOTE camping plans'};
 person=await run({action:'friend_note_save',id:person.id,version:person.version,note});const createdAt=person.data.relationshipNotes[0].createdAt,version=person.version;
 const retry=await run({action:'friend_note_save',id:person.id,version:version-1,note});assert.equal(retry.version,version);
 await assert.rejects(run({action:'friend_note_save',id:person.id,version:person.version,note:{...note,text:'Silent replacement'}}),/Conflict/);
 person=await run({action:'friend_note_save',id:person.id,version:person.version,edit:true,note:{...note,text:'Updated camping plan'}},new Date('2026-11-05T20:00:00Z'));assert.equal(person.data.relationshipNotes[0].createdAt,createdAt);assert.notEqual(person.data.relationshipNotes[0].updatedAt,createdAt);
 await assert.rejects(run({action:'friend_update',id:person.id,version:1,patch:{partner:'Lost edit'}}),/Conflict/);
 person=await saveFriend({id:person.id,version:person.version,data:{name:person.data.name,notes:'Updated general'}},owner,now);assert.equal(person.data.relationshipNotes[0].text,'Updated camping plan');assert.equal(person.data.birthday,'05-17');assert.equal(person.data.partner,'PRIVATE_PARTNER');assert.equal(person.data.occupation,'Architect');
 person=await run({action:'friend_saw_today',id:person.id,version:person.version});assert.equal(person.data.lastInPerson,'2026-11-04');assert.equal(person.data.manualLastContact,null);
 person=await run({action:'friend_suggestion',id:person.id,version:person.version,key:'follow-up:2026-11-18',disposition:'snoozed'});assert.equal(person.data.suggestionState[0].until,'2026-11-11');
 person=await run({action:'friend_note_delete',id:person.id,version:person.version,noteId:note.id});assert.equal(person.data.relationshipNotes.length,0);assert.equal(person.data.notes,'Updated general');assert.equal(person.data.followUpOn,'2026-11-18');assert.deepEqual(await crmStatus(owner),sourceBefore);assert.ok(device.deviceId);
});
test('owner gates, explicit patch boundaries and input validation protect relationship memory',async()=>{
 const person=await run({action:'friend_quick_add',requestId:crypto.randomUUID(),data:{name:'Private Boundary'}});
 for(const action of ['friend_search','friend_quick_add','friend_update','friend_note_save','friend_note_delete','friend_saw_today','friend_suggestion'])await assert.rejects(friendOperation({action,id:person.id,version:person.version,query:'Private'},'other-user',now),/private|owner|access/i);
 await assert.rejects(run({action:'friend_update',id:person.id,version:person.version,patch:{relationshipNotes:[]}}));
 await assert.rejects(run({action:'friend_update',id:person.id,version:person.version,patch:{createdAt:now.toISOString()}}));
 await assert.rejects(run({action:'friend_update',id:person.id,version:person.version,patch:{lastInPerson:'2026-11-10'}}),/future/);
 await assert.rejects(run({action:'friend_update',id:person.id,version:person.version,patch:{metOn:'2026-02-30'}}));
 await assert.rejects(operate({action:'friend_update',id:person.id,version:person.version,patch:{passportNumber:'PRIVATE'}},owner),/Vault/);
 const before=(await list(owner)).find(r=>r.id===person.id);assert.equal(before.version,person.version);
});
