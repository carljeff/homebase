import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {assertFriendsOwner} from './friends-access';
import {friendSchema} from './friends';
import {normalizePersonName} from './friend-memory';
import {list} from './store';
const id=z.string().regex(/^[a-f0-9]{64}$/),uuid=z.string().uuid();
const name=z.string().trim().min(1).max(100).refine(v=>!/[\u0000-\u001f\u007f@]/.test(v)&&!/^\+?[\d\s().-]{7,}$/.test(v));
const stamp=z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v);
export const candidateSchema=z.object({candidateId:id,name,directOut:z.number().int().min(1).max(10000000),lastOutgoing:stamp,existingContactId:uuid.nullable()}).strict();
export const reviewSyncSchema=z.object({version:z.literal(1),action:z.literal('review-sync'),candidates:z.array(candidateSchema).max(50),applied:z.array(z.object({candidateId:id,contactId:uuid}).strict()).max(50)}).strict();
type Candidate=z.infer<typeof candidateSchema>;
type ReviewRow={device_id:string;candidate_id:string;data_json:string;status:string;contact_id:string|null;version:number;updated_at:string};
const deviceActive=(deviceId:string,user:string)=>env.DB!.prepare("SELECT id FROM crm_devices WHERE id=? AND owner_id=? AND enabled=1 AND source_mode='relay'").bind(deviceId,user).first();
export async function syncContactReview(input:z.infer<typeof reviewSyncSchema>,deviceId:string,user:string,now=Date.now()){
 await assertFriendsOwner(user);if(!await deviceActive(deviceId,user))throw new Error('Collector unavailable');
 if(new Set(input.candidates.map(c=>c.candidateId)).size!==input.candidates.length||new Set(input.applied.map(c=>c.candidateId)).size!==input.applied.length)throw new Error('Duplicate candidates');
 const friends=(await list(user)).filter(r=>r.kind==='friend'),updatedAt=new Date(now).toISOString();
 for(const candidate of input.candidates){
  if(Date.parse(candidate.lastOutgoing)>now+300000||Date.parse(candidate.lastOutgoing)<now-90*86400000)throw new Error('Candidate date outside review window');
  if(candidate.existingContactId&&!friends.some(f=>f.id===candidate.existingContactId))throw new Error('Existing contact unavailable');
 }
 for(const item of input.applied){const row=await env.DB!.prepare('SELECT status,contact_id FROM crm_contact_review WHERE device_id=? AND candidate_id=?').bind(deviceId,item.candidateId).first<{status:string;contact_id:string|null}>();if(!row||!['approved','applied'].includes(row.status)||row.contact_id!==item.contactId)throw new Error('Mapping acknowledgement does not match approval');}
 const total=await env.DB!.prepare('SELECT count(*) count FROM crm_contact_review WHERE device_id=?').bind(deviceId).first<{count:number}>();
 const known=await env.DB!.prepare('SELECT candidate_id FROM crm_contact_review WHERE device_id=?').bind(deviceId).all<{candidate_id:string}>();const knownIds=new Set(known.results.map(r=>r.candidate_id));if((total?.count??0)+input.candidates.filter(c=>!knownIds.has(c.candidateId)).length>500)throw new Error('Review limit reached');
 const writes=[];
 for(const item of input.applied)writes.push(env.DB!.prepare("UPDATE crm_contact_review SET status='applied',data_json='{}',version=version+1,updated_at=? WHERE device_id=? AND candidate_id=? AND contact_id=? AND status='approved'").bind(updatedAt,deviceId,item.candidateId,item.contactId));
 for(const candidate of input.candidates){
  const old=await env.DB!.prepare('SELECT data_json,status FROM crm_contact_review WHERE device_id=? AND candidate_id=?').bind(deviceId,candidate.candidateId).first<{data_json:string;status:string}>();
  if(old&&old.status!=='pending')continue;
  if(old){const prior=JSON.parse(old.data_json) as Candidate;if(prior.lastOutgoing>candidate.lastOutgoing||old.data_json===JSON.stringify(candidate))continue;}
  writes.push(env.DB!.prepare("INSERT INTO crm_contact_review(device_id,candidate_id,data_json,status,updated_at) SELECT ?,?,?,'pending',? WHERE EXISTS (SELECT 1 FROM crm_devices WHERE id=? AND owner_id=? AND enabled=1 AND source_mode='relay') ON CONFLICT(device_id,candidate_id) DO UPDATE SET data_json=excluded.data_json,version=crm_contact_review.version+1,updated_at=excluded.updated_at WHERE crm_contact_review.status='pending'").bind(deviceId,candidate.candidateId,JSON.stringify(candidate),updatedAt,deviceId,user));
 }
 writes.push(env.DB!.prepare('INSERT INTO crm_contact_review_state(device_id,last_sync) VALUES (?,?) ON CONFLICT(device_id) DO UPDATE SET last_sync=excluded.last_sync').bind(deviceId,updatedAt));
 if(writes.length)await env.DB!.batch(writes);
 if(!await deviceActive(deviceId,user))throw new Error('Collector unavailable');
 const decisions=await env.DB!.prepare("SELECT candidate_id,status,contact_id FROM crm_contact_review WHERE device_id=? AND status IN ('approved','ignored') ORDER BY CASE WHEN status='approved' THEN 0 ELSE 1 END,updated_at DESC").bind(deviceId).all<{candidate_id:string;status:string;contact_id:string|null}>();
 // Previously ignored IDs are returned only if published again; names are not retained for ignored rows.
 const published=new Set(input.candidates.map(c=>c.candidateId));
 return {version:1,action:'review-sync',decisions:decisions.results.filter(d=>d.status==='approved'?friends.some(f=>f.id===d.contact_id&&f.data.trackMessaging===true):published.has(d.candidate_id)).slice(0,50).map(d=>({candidateId:d.candidate_id,status:d.status,contactId:d.contact_id}))};
}
export async function contactReviewList(user:string){
 await assertFriendsOwner(user);
 const rows=await env.DB!.prepare("SELECT r.* FROM crm_contact_review r JOIN crm_devices d ON d.id=r.device_id WHERE d.owner_id=? AND d.enabled=1 AND d.source_mode='relay' AND r.status IN ('pending','approved') ORDER BY r.updated_at DESC LIMIT 100").bind(user).all<ReviewRow>();
 const health=await env.DB!.prepare("SELECT max(s.last_sync) last_sync FROM crm_contact_review_state s JOIN crm_devices d ON d.id=s.device_id WHERE d.owner_id=? AND d.enabled=1 AND d.source_mode='relay'").bind(user).first<{last_sync:string|null}>();
 return {lastSync:health?.last_sync??null,candidates:rows.results.map(row=>({deviceId:row.device_id,candidateId:row.candidate_id,version:row.version,status:row.status,contactId:row.contact_id,...JSON.parse(row.data_json)}))};
}
const decisionSchema=z.object({deviceId:uuid,candidateId:id,version:z.number().int().positive(),action:z.enum(['approve','ignore']),contactId:uuid.nullable().optional(),friendVersion:z.number().int().positive().optional(),confirmMetadata:z.literal(true).optional(),allowDuplicate:z.boolean().default(false)}).strict();
export async function decideContactReview(raw:unknown,user:string,now=Date.now()){
 await assertFriendsOwner(user);const input=decisionSchema.parse(raw);if(!await deviceActive(input.deviceId,user))throw new Error('Collector unavailable');
 const row=await env.DB!.prepare('SELECT * FROM crm_contact_review WHERE device_id=? AND candidate_id=?').bind(input.deviceId,input.candidateId).first<ReviewRow>();if(!row)throw new Error('Candidate unavailable');
 if(input.action==='ignore'&&row.status==='ignored'||input.action==='approve'&&['approved','applied'].includes(row.status))return {status:row.status,contactId:row.contact_id};
 if(row.status!=='pending'||row.version!==input.version)throw new Error('Conflict: refresh the candidate before approving');
 const updatedAt=new Date(now).toISOString();
 if(input.action==='ignore'){const ignored=await env.DB!.prepare("UPDATE crm_contact_review SET status='ignored',data_json='{}',version=version+1,updated_at=? WHERE device_id=? AND candidate_id=? AND status='pending' AND version=? AND EXISTS (SELECT 1 FROM crm_devices WHERE id=? AND owner_id=? AND enabled=1)").bind(updatedAt,input.deviceId,input.candidateId,input.version,input.deviceId,user).run();if(!ignored.meta.changes)throw new Error('Conflict: refresh the candidate');return {status:'ignored',contactId:null};}
 if(!input.confirmMetadata)throw new Error('Explicit messaging approval required');
 const candidate=candidateSchema.parse(JSON.parse(row.data_json)),friends=(await list(user)).filter(r=>r.kind==='friend');
 if(candidate.existingContactId&&input.contactId!==candidate.existingContactId)throw new Error('This candidate already has a local friend mapping');
 const existing=input.contactId?friends.find(f=>f.id===input.contactId):null;
 if(input.contactId&&!existing)throw new Error('Friend unavailable');
 if(!existing&&!input.allowDuplicate&&friends.some(f=>normalizePersonName(f.data.name)===normalizePersonName(candidate.name)))throw new Error('Possible duplicate: link the existing friend or explicitly choose a different person');
 if(!existing&&friends.length>=200)throw new Error('Contact limit reached');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.deviceId+':'+input.candidateId))),b=>b.toString(16).padStart(2,'0')).join('');
 const contactId=existing?.id??`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
 if(!existing&&await env.DB!.prepare('SELECT id FROM records WHERE id=?').bind(contactId).first())throw new Error('Contact identifier collision');
 const guard="EXISTS (SELECT 1 FROM crm_contact_review r JOIN crm_devices d ON d.id=r.device_id WHERE r.device_id=? AND r.candidate_id=? AND r.version=? AND r.status='pending' AND d.owner_id=? AND d.enabled=1 AND d.source_mode='relay')";
 const writes=[];
 if(!existing){const data=friendSchema.parse({name:candidate.name,trackMessaging:true,createdAt:updatedAt});writes.push(env.DB!.prepare(`INSERT INTO records(id,kind,data,version,updated_at,updated_by) SELECT ?,'friend',?,1,?,? WHERE ${guard}`).bind(contactId,JSON.stringify(data),updatedAt,user,input.deviceId,input.candidateId,input.version,user));}
 else if(!existing.data.trackMessaging){if(existing.version!==input.friendVersion)throw new Error('Conflict: refresh the friend before enabling messaging');writes.push(env.DB!.prepare(`UPDATE records SET data=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND kind='friend' AND version=? AND ${guard}`).bind(JSON.stringify({...existing.data,trackMessaging:true}),updatedAt,user,contactId,existing.version,input.deviceId,input.candidateId,input.version,user));}
 writes.push(env.DB!.prepare(`UPDATE crm_contact_review SET status='approved',contact_id=?,version=version+1,updated_at=? WHERE device_id=? AND candidate_id=? AND version=? AND status='pending' AND ${guard} AND EXISTS (SELECT 1 FROM records f WHERE f.id=? AND f.kind='friend' AND json_extract(f.data,'$.trackMessaging')=1)`).bind(contactId,updatedAt,input.deviceId,input.candidateId,input.version,input.deviceId,input.candidateId,input.version,user,contactId));
 await env.DB!.batch(writes);
 const result=await env.DB!.prepare('SELECT status,contact_id FROM crm_contact_review WHERE device_id=? AND candidate_id=?').bind(input.deviceId,input.candidateId).first<{status:string;contact_id:string|null}>();if(result?.status!=='approved'||result.contact_id!==contactId)throw new Error('Conflict: contact approval changed; refresh');
 return {status:'approved',contactId};
}
