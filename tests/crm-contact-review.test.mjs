import {setFriendsOwnerForTest} from './server-env.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {syncContactReview,contactReviewList,decideContactReview,reviewSyncSchema} from '../lib/contact-review.ts';
import {operate} from '../lib/operations';import {list} from '../lib/store';
import {registerCollector,prepareRelay,revokeCollector,bodyDigest,crmStatus} from '../lib/crm-store.ts';
import {handleContactRequest} from '../lib/contact-import.ts';
const {env}=await import('cloudflare:workers');env.CRM_RELAY_MASTER='b'.repeat(64);env.CRM_INGEST_MASTER_KEY='a'.repeat(64);
const now=Date.parse('2026-11-05T20:00:00Z'),owner='review-owner';
const payload=(candidates=[],applied=[])=>({version:1,action:'review-sync',candidates,applied});
const candidate=(key='1',name='Synthetic New Person',existingContactId=null)=>({candidateId:key.repeat(64),name,directOut:2,lastOutgoing:'2026-11-04T20:00:00Z',existingContactId});
async function setup(){setFriendsOwnerForTest(owner);for(const d of await crmStatus(owner))if(d.enabled)await revokeCollector(owner,d.id);return prepareRelay(owner,(await registerCollector(owner,'Synthetic review')).deviceId);}
async function request(body,key,proof=true){const raw=JSON.stringify(body),stamp=String(now/1000),digest=await bodyDigest(raw),hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(key.signingKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode('POST\n/api/crm/contacts\n'+stamp+'\n'+digest))).toString('hex');return new Request('https://homebase.example/api/crm/contacts',{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Device':key.deviceId,'X-CRM-Time':stamp,'X-CRM-Signature':proof?signature:'0'.repeat(64)},body:raw});}
async function item(deviceId,id){return (await contactReviewList(owner)).candidates.find(r=>r.deviceId===deviceId&&r.candidateId===id);}
const decision=(row,extra={})=>({deviceId:row.deviceId,candidateId:row.candidateId,version:row.version,action:'approve',confirmMetadata:true,...extra});
test('signed outbound review is strict, authenticated, replay safe and independent of activity sequence',async()=>{
 const key=await setup(),p=payload([candidate()]);assert.equal((await handleContactRequest(await request(p,key,false),now)).status,401);
 assert.equal((await handleContactRequest(await request(p,key),now)).status,200);const first=await item(key.deviceId,candidate().candidateId);
 assert.equal((await handleContactRequest(await request(p,key),now)).status,200);assert.deepEqual(await item(key.deviceId,candidate().candidateId),first);
 for(const field of ['handles','email','text','attributedBody','attachments','notes']){const raw=payload([{...candidate(),[field]:'PRIVATE_SENTINEL'}]);assert.equal(reviewSyncSchema.safeParse(raw).success,false);const response=await handleContactRequest(await request(raw,key),now);assert.equal(response.status,400);assert.ok(!(await response.text()).includes('PRIVATE_SENTINEL'));}
 for(const bad of [{directOut:0},{lastOutgoing:'2026-02-31T20:00:00Z'},{name:'synthetic@example.test'},{name:'+13175550101'}])assert.equal(reviewSyncSchema.safeParse(payload([{...candidate(),...bad}])).success,false);
 await assert.rejects(syncContactReview(payload([candidate(),candidate()]),key.deviceId,owner,now),/Duplicate/);
 await assert.rejects(syncContactReview(payload([{...candidate(),lastOutgoing:'2025-01-01T00:00:00Z'}]),key.deviceId,owner,now),/window/);
 assert.equal((await crmStatus(owner)).find(d=>d.id===key.deviceId).sequence,0);
});
test('approval creates once, keeps existing records intact, and requires explicit consent and version',async()=>{
 const key=await setup(),c=candidate('2','Synthetic New Approved');const preserved=await operate({action:'save',kind:'friend',data:{name:'Preserved Friend',notes:'PRIVATE_NOTE',birthday:'11-09',partner:'PRIVATE_PARTNER',meetingPlace:'PRIVATE_PLACE',trackMessaging:true}},owner);
 await syncContactReview(payload([c]),key.deviceId,owner,now);let row=await item(key.deviceId,c.candidateId);
 await assert.rejects(decideContactReview(decision(row,{confirmMetadata:undefined}),owner,now),/approval/);
 await assert.rejects(decideContactReview(decision(row,{version:row.version+1}),owner,now),/Conflict/);
 await assert.rejects(decideContactReview(decision(row),'someone-else',now),/private|owner|unavailable/i);
 const accepted=await decideContactReview(decision(row),owner,now);assert.deepEqual(await decideContactReview(decision(row),owner,now),accepted);
 const all=await list(owner);assert.equal(all.filter(f=>f.id===accepted.contactId).length,1);assert.equal(all.find(f=>f.id===accepted.contactId).data.trackMessaging,true);assert.deepEqual(all.find(f=>f.id===preserved.id),preserved);
 const receipt=await syncContactReview(payload([c]),key.deviceId,owner,now);assert.deepEqual(receipt.decisions,[{candidateId:c.candidateId,status:'approved',contactId:accepted.contactId}]);
 await assert.rejects(syncContactReview(payload([],[{candidateId:c.candidateId,contactId:crypto.randomUUID()}]),key.deviceId,owner,now),/acknowledgement/);
 await syncContactReview(payload([],[{candidateId:c.candidateId,contactId:accepted.contactId}]),key.deviceId,owner,now);assert.equal(await item(key.deviceId,c.candidateId),undefined);
 const stored=await env.DB.prepare('SELECT data_json,status FROM crm_contact_review WHERE device_id=? AND candidate_id=?').bind(key.deviceId,c.candidateId).first();assert.deepEqual(JSON.parse(JSON.stringify(stored)),{data_json:'{}',status:'applied'});
 await syncContactReview(payload([c],[{candidateId:c.candidateId,contactId:accepted.contactId}]),key.deviceId,owner,now);assert.equal(await item(key.deviceId,c.candidateId),undefined);
});
test('ignore erases names permanently; duplicate matching and opt-in preserve personal details',async()=>{
 const key=await setup(),c=candidate('3','Synthetic Ignore');await syncContactReview(payload([c]),key.deviceId,owner,now);let row=await item(key.deviceId,c.candidateId);
 await decideContactReview(decision(row,{action:'ignore',confirmMetadata:undefined}),owner,now);assert.deepEqual((await syncContactReview(payload([c]),key.deviceId,owner,now)).decisions,[{candidateId:c.candidateId,status:'ignored',contactId:null}]);assert.equal(await item(key.deviceId,c.candidateId),undefined);
 const existing=await operate({action:'save',kind:'friend',data:{name:'Synthetic Duplicate',notes:'PRIVATE_NOTE',partner:'PRIVATE_PARTNER',birthday:'11-09',trackMessaging:false}},owner),other=candidate('4','Synthetic Duplicate',existing.id);
 await syncContactReview(payload([other]),key.deviceId,owner,now);row=await item(key.deviceId,other.candidateId);
 await assert.rejects(decideContactReview(decision(row),owner,now),/already has/);
 await assert.rejects(decideContactReview(decision(row,{contactId:existing.id}),owner,now),/Conflict/);
 await decideContactReview(decision(row,{contactId:existing.id,friendVersion:existing.version}),owner,now);const updated=(await list(owner)).find(f=>f.id===existing.id);assert.deepEqual(updated.data,{...existing.data,trackMessaging:true});
 const duplicate=candidate('5','Synthetic Duplicate');await syncContactReview(payload([duplicate]),key.deviceId,owner,now);row=await item(key.deviceId,duplicate.candidateId);await assert.rejects(decideContactReview(decision(row),owner,now),/duplicate/);
 await decideContactReview(decision(row,{contactId:existing.id}),owner,now);
 await revokeCollector(owner,key.deviceId);await assert.rejects(syncContactReview(payload([]),key.deviceId,owner,now),/unavailable/);assert.equal((await contactReviewList(owner)).candidates.some(c=>c.deviceId===key.deviceId),false);
});
