import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {list} from './store';
import {bodyDigest,relayDeviceSecret} from './crm-store';
const path='/api/crm/contacts';
const name=z.string().trim().min(1).max(100).refine(v=>!/[\u0000-\u001f\u007f@]/.test(v)&&!/^\+?[\d\s().-]{7,}$/.test(v));
const entry=z.object({contactId:z.string().uuid(),name,create:z.boolean()}).strict();
export const contactRequestSchema=z.discriminatedUnion('action',[
 z.object({version:z.literal(1),action:z.literal('list')}).strict(),
 z.object({version:z.literal(1),action:z.literal('apply'),selectionId:z.string().uuid(),contacts:z.array(entry).min(1).max(25)}).strict()
]);
function fail(status:number){return Response.json({error:'Contact request rejected. Verify relay pairing, selected names, and messaging opt-in; retry the same saved plan.'},{status,headers:{'Cache-Control':'no-store'}});}
export async function handleContactRequest(request:Request,now=Date.now()){
 if(request.method!=='POST'||new URL(request.url).protocol!=='https:'||new URL(request.url).pathname!==path||new URL(request.url).search)return fail(400);
 if(!request.headers.get('content-type')?.includes('application/json')||request.headers.has('content-encoding'))return fail(415);
 if(Number(request.headers.get('content-length')||0)>50000)return fail(413);
 const id=request.headers.get('x-crm-device')||'',stamp=request.headers.get('x-crm-time')||'',signature=request.headers.get('x-crm-signature')||'';
 if(!z.string().uuid().safeParse(id).success||!/^\d{10}$/.test(stamp)||Math.abs(now-Number(stamp)*1000)>300000||!/^[a-f0-9]{64}$/.test(signature))return fail(401);
 const device=await env.DB!.prepare("SELECT owner_id FROM crm_devices WHERE id=? AND enabled=1 AND source_mode='relay'").bind(id).first<{owner_id:string}>();if(!device)return fail(401);
 const reader=request.body?.getReader();if(!reader)return fail(400);let size=0;const chunks:Uint8Array[]=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>50000){await reader.cancel();return fail(413);}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes),digest=await bodyDigest(body),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(await relayDeviceSecret(id)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('POST\n'+path+'\n'+stamp+'\n'+digest))),b=>b.toString(16).padStart(2,'0')).join('');let mismatch=0;for(let i=0;i<64;i++)mismatch|=expected.charCodeAt(i)^signature.charCodeAt(i);if(mismatch)return fail(401);
 let input:z.infer<typeof contactRequestSchema>;try{input=contactRequestSchema.parse(JSON.parse(body));}catch{return fail(400);}
 const friends=(await list()).filter(r=>r.kind==='friend');
 if(input.action==='list')return Response.json({version:1,action:'list',friends:friends.map(f=>({contactId:f.id,name:f.data.name,trackMessaging:!!f.data.trackMessaging}))},{headers:{'Cache-Control':'no-store'}});
 if(new Set(input.contacts.map(c=>c.contactId)).size!==input.contacts.length)return fail(400);
 const creates=[];
 for(const item of input.contacts){const existing=friends.find(f=>f.id===item.contactId);if(existing){if(existing.data.name!==item.name||!existing.data.trackMessaging)return fail(409);}else{if(!item.create)return fail(409);const collision=await env.DB!.prepare('SELECT id FROM records WHERE id=?').bind(item.contactId).first();if(collision)return fail(409);creates.push(item);}}
 if(friends.length+creates.length>200)return fail(400);
 const timestamp=new Date(now).toISOString();
 if(creates.length)await env.DB!.batch(creates.map(c=>env.DB!.prepare("INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) SELECT ?,'friend',?,1,?,? WHERE EXISTS (SELECT 1 FROM crm_devices WHERE id=? AND enabled=1 AND source_mode='relay' AND owner_id=?)").bind(c.contactId,JSON.stringify({name:c.name,notes:'',trackMessaging:true,reminderDays:null}),timestamp,device.owner_id,id,device.owner_id)));
 const valid=await env.DB!.prepare("SELECT id FROM crm_devices WHERE id=? AND enabled=1 AND source_mode='relay'").bind(id).first();if(!valid)return fail(401);
 const refreshed=(await list()).filter(r=>r.kind==='friend');if(input.contacts.some(c=>!refreshed.some(f=>f.id===c.contactId&&f.data.name===c.name&&f.data.trackMessaging)))return fail(409);
 return Response.json({version:1,action:'apply',selectionId:input.selectionId,contacts:input.contacts.map(c=>({contactId:c.contactId,name:c.name}))},{headers:{'Cache-Control':'no-store'}});
}
