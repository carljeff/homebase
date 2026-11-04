import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {messagingSnapshotSchema,type MessagingSnapshot} from './friends';
import {list} from './store';
type Device={source_mode:string;id:string;owner_id:string;label:string;enabled:number;sequence:number;digest:string;snapshot_json:string|null;last_success_at:string|null;created_at:string};
const encoder=new TextEncoder();
function master(){const value=(env as unknown as Record<string,unknown>).CRM_INGEST_MASTER_KEY;if(typeof value!=='string'||!/^\w{64,256}$/.test(value))throw Error('Collector signing is not configured');return value;}
async function mac(secret:string,value:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export const deviceSecret=(id:string)=>mac(master(),'homebase-crm-v1:'+id);
export async function bodyDigest(body:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(body))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function registerCollector(user:string,label:string){master();const id=crypto.randomUUID(),now=new Date().toISOString();const existing=await env.DB!.prepare('SELECT * FROM crm_devices WHERE owner_id=? AND enabled=1').bind(user).first<Device>();if(existing)throw Error('Revoke the existing collector before creating another');await env.DB!.prepare('INSERT INTO crm_devices (id,owner_id,label,created_at) VALUES (?,?,?,?)').bind(id,user,z.string().trim().min(1).max(80).parse(label),now).run();return {deviceId:id,signingKey:await deviceSecret(id)};}
export async function revokeCollector(user:string,id:string){await env.DB!.prepare("UPDATE crm_devices SET enabled=0,snapshot_json=NULL,digest='' WHERE id=? AND owner_id=?").bind(z.string().uuid().parse(id),user).run();}
export async function crmStatus(user:string){const tracked=new Set((await list()).filter(r=>r.kind==='friend'&&r.data.trackMessaging).map(r=>r.id));const rows=await env.DB!.prepare('SELECT * FROM crm_devices ORDER BY created_at DESC').all<Device>();return rows.results.map(d=>({id:d.id,label:d.label,sourceMode:d.source_mode,enabled:!!d.enabled,isOwner:d.owner_id===user,lastSuccess:d.last_success_at,sequence:d.sequence,snapshot:d.enabled&&d.snapshot_json?(()=>{const snapshot=messagingSnapshotSchema.parse(JSON.parse(d.snapshot_json));return {...snapshot,contacts:snapshot.contacts.filter(c=>tracked.has(c.contactId))};})():null}));}
export async function ingestMessaging(request:Request,now=Date.now()){
 const fail=(status:number)=>Response.json({error:'Collector request rejected'},{status,headers:{'Cache-Control':'no-store'}});
 if(new URL(request.url).pathname!=='/api/crm/ingest'||new URL(request.url).protocol!=='https:')return fail(400);
 if(request.method!=='POST'||!request.headers.get('content-type')?.includes('application/json'))return fail(415);
 if(Number(request.headers.get('content-length')||0)>1000000)return fail(413);
 const reader=request.body?.getReader();if(!reader)return fail(400);let size=0;const chunks:Uint8Array[]=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();return fail(413);}chunks.push(value);}const raw=new Uint8Array(size);let at=0;for(const c of chunks){raw.set(c,at);at+=c.length;}const body=new TextDecoder().decode(raw);
 const id=request.headers.get('x-crm-device')||'',stamp=request.headers.get('x-crm-time')||'',signature=request.headers.get('x-crm-signature')||'';
 if(!z.string().uuid().safeParse(id).success||!/^\d{10}$/.test(stamp)||Math.abs(now-Number(stamp)*1000)>300000||!/^\w{64}$/.test(signature))return fail(401);
 const d=await env.DB!.prepare('SELECT * FROM crm_devices WHERE id=? AND enabled=1').bind(id).first<Device>();if(!d||d.source_mode==='manual')return fail(401);
 const digest=await bodyDigest(body),expected=await mac(await deviceSecret(id),'POST\n/api/crm/ingest\n'+stamp+'\n'+digest);
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);if(diff)return fail(401);
 let snapshot:MessagingSnapshot;try{snapshot=messagingSnapshotSchema.parse(JSON.parse(body));}catch{return fail(400);}
 if(snapshot.deviceId!==id||Date.parse(snapshot.generatedAt)>now+300000||snapshot.reconciledAt>snapshot.generatedAt)return fail(400);
 if(snapshot.sequence===d.sequence&&digest===d.digest)return Response.json({accepted:true,sequence:d.sequence,digest,duplicate:true},{headers:{'Cache-Control':'no-store'}});
 if(snapshot.sequence!==d.sequence+1)return fail(409);
 const contacts=(await list()).filter(r=>r.kind==='friend'&&r.data.trackMessaging);if(snapshot.contacts.some(c=>!contacts.some(r=>r.id===c.contactId)))return fail(400);
 const result=await env.DB!.prepare('UPDATE crm_devices SET sequence=?,digest=?,snapshot_json=?,last_success_at=? WHERE id=? AND sequence=? AND enabled=1').bind(snapshot.sequence,digest,JSON.stringify(snapshot),new Date(now).toISOString(),id,d.sequence).run();if(!result.meta.changes)return fail(409);
 return Response.json({accepted:true,sequence:snapshot.sequence,digest,duplicate:false},{headers:{'Cache-Control':'no-store'}});
}

export async function importMessagingSnapshot(user:string,input:unknown,now=Date.now()){
 const snapshot=messagingSnapshotSchema.parse(input);
 if(Date.parse(snapshot.generatedAt)>now+300000||snapshot.reconciledAt>snapshot.generatedAt)throw Error('Invalid snapshot dates');
 const contacts=(await list()).filter(r=>r.kind==='friend'&&r.data.trackMessaging);
 if(!snapshot.contacts.length||snapshot.contacts.some(c=>!contacts.some(r=>r.id===c.contactId)))throw Error('Every imported contact must match an opted-in friend');
 const digest=await bodyDigest(JSON.stringify(snapshot));
 let device=await env.DB!.prepare('SELECT * FROM crm_devices WHERE id=?').bind(snapshot.deviceId).first<Device>();
 if(device&&(device.owner_id!==user||!device.enabled))throw Error('This collector is revoked or belongs to another account');
 if(device?.snapshot_json){
  const prior=messagingSnapshotSchema.parse(JSON.parse(device.snapshot_json));
  if(device.digest===digest)return {accepted:true,duplicate:true,contacts:snapshot.contacts.length};
  if(snapshot.generatedAt<=prior.generatedAt||snapshot.sequence<=device.sequence)throw Error('Older export rejected. Create a fresh export on the Mac');
 }
 if(!device){
  const active=await env.DB!.prepare('SELECT id FROM crm_devices WHERE owner_id=? AND enabled=1').bind(user).first();
  if(active)throw Error('The file device ID differs from your active collector. Check the Mac configuration');
  await env.DB!.prepare("INSERT INTO crm_devices (id,owner_id,label,created_at,source_mode) VALUES (?,?,?,?,?)").bind(snapshot.deviceId,user,'Mac mini · manual import',new Date(now).toISOString(),'manual').run();
  device=await env.DB!.prepare('SELECT * FROM crm_devices WHERE id=?').bind(snapshot.deviceId).first<Device>();
 }
 if(!device)throw Error('Collector unavailable');
 const result=await env.DB!.prepare("UPDATE crm_devices SET sequence=?,digest=?,snapshot_json=?,last_success_at=?,source_mode='manual',label='Mac mini · manual import' WHERE id=? AND owner_id=? AND enabled=1 AND sequence=? AND digest=?").bind(snapshot.sequence,digest,JSON.stringify(snapshot),new Date(now).toISOString(),snapshot.deviceId,user,device.sequence,device.digest).run();
 if(!result.meta.changes)throw Error('Import changed concurrently; refresh before retrying');
 return {accepted:true,duplicate:false,contacts:snapshot.contacts.length};
}
