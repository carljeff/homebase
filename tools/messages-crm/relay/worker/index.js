const TARGET='https://homebase.carl-jeff.chatgpt.site/api/crm/ingest';
const PATH='/api/crm/ingest', encoder=new TextEncoder();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function mac(key,text){const k=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,encoder.encode(text)));}
function hex(value){return Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,'0')).join('');}
export const deviceKey=(master,id)=>mac(master,'homebase-crm-relay-v1:'+id);
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.split(' ').sort().join(',');}
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
const stamp=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().replace('.000Z','Z')===s;
export function metadata(s){
 if(!exact(s,'version deviceId sequence generatedAt reconciledAt contacts quality')||s.version!==1||!uuid.test(s.deviceId)||!Number.isSafeInteger(s.sequence)||s.sequence<1||!stamp(s.generatedAt)||!stamp(s.reconciledAt)||s.reconciledAt>s.generatedAt||!Array.isArray(s.contacts)||s.contacts.length>200)return false;
 if(!exact(s.quality,'unlinked invalidTimestamp ambiguous unmatched excluded scanned partial')||typeof s.quality.partial!=='boolean'||Object.entries(s.quality).some(([k,v])=>k!=='partial'&&!count(v)))return false;
 for(const c of s.contacts){
  if(!exact(c,'contactId direct group days')||!uuid.test(c.contactId)||!Array.isArray(c.days)||c.days.length>181)return false;
  for(const t of [c.direct,c.group])if(!exact(t,'incoming outgoing lastIncoming lastOutgoing')||!count(t.incoming)||!count(t.outgoing)||![t.lastIncoming,t.lastOutgoing].every(v=>v===null||stamp(v)))return false;
  for(const d of c.days)if(!exact(d,'day directIn directOut groupIn groupOut')||typeof d.day!=='string'||!/^\d{4}-\d\d-\d\d$/.test(d.day)||![d.directIn,d.directOut,d.groupIn,d.groupOut].every(count))return false;
 }
 return true;
}
function response(status,value={error:'Metadata request rejected'}){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function reject(status,code){console.warn('crm_relay '+code);return response(status,{error:'Metadata request rejected',code});}
export async function handle(request,env,forward=fetch,now=Date.now()){
 try{
 const url=new URL(request.url);
 if(url.protocol!=='https:'||url.search)return response(400);
 if(url.pathname==='/'&&request.method==='GET')return response(200,{service:'Authenticated Homebase metadata relay',status:'ready'});
 if(url.pathname!==PATH)return response(404);
 if(request.method!=='POST')return response(405);
 if(!request.headers.get('content-type')?.includes('application/json')||request.headers.has('content-encoding'))return response(415);
 const id=request.headers.get('x-crm-device')||'',time=request.headers.get('x-crm-time')||'',signature=request.headers.get('x-crm-signature')||'';
 if(!uuid.test(id)||!/^\d{10}$/.test(time)||!/^[a-f0-9]{64}$/.test(signature))return reject(401,'AUTH_HEADERS_INVALID');
 if(Math.abs(now-Number(time)*1000)>300000)return reject(401,'AUTH_CLOCK_OUTSIDE_WINDOW');
 if(!/^[a-f0-9]{64}$/.test(env.CRM_RELAY_MASTER||'')||!env.HOMEBASE_ACCESS_TOKEN||!env.DB)return reject(503,'SERVER_CONFIGURATION');
 if(Number(request.headers.get('content-length')||0)>1000000)return response(413);
 const reader=request.body?.getReader();if(!reader)return response(400);
 let size=0;const parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();return response(413);}parts.push(value);}
 const body=new Uint8Array(size);let at=0;for(const p of parts){body.set(p,at);at+=p.length;}
 const digest=hex(await crypto.subtle.digest('SHA-256',body));const expected=await mac(await deviceKey(env.CRM_RELAY_MASTER,id),'POST\n'+PATH+'\n'+time+'\n'+digest);
 const declaredDigest=request.headers.get('x-crm-body-sha256'),keyTag=request.headers.get('x-crm-key-tag');
 if(declaredDigest&&declaredDigest!==digest)return reject(401,'BODY_BYTES_CHANGED');
 if(keyTag&&keyTag!==hex(await crypto.subtle.digest('SHA-256',encoder.encode(await deviceKey(env.CRM_RELAY_MASTER,id)))))return reject(401,'DEVICE_KEY_MISMATCH');
 let mismatch=0;for(let i=0;i<64;i++)mismatch|=signature.charCodeAt(i)^expected.charCodeAt(i);if(mismatch)return reject(401,'SIGNATURE_MISMATCH');
 let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{return response(400);}
 if(!metadata(data)||data.deviceId!==id||Date.parse(data.generatedAt)>now+300000)return response(400);
 // Only verified devices consume a persistent quota. One fixed row per device, no activity payload storage.
 const minute=Math.floor(now/60000),day=Math.floor(now/86400000);
 const quota=await env.DB.prepare(`INSERT INTO relay_limits (id,minute,minute_used,day,day_used) VALUES (?,?,1,?,1) ON CONFLICT(id) DO UPDATE SET minute=excluded.minute,minute_used=CASE WHEN relay_limits.minute=excluded.minute THEN relay_limits.minute_used+1 ELSE 1 END,day=excluded.day,day_used=CASE WHEN relay_limits.day=excluded.day THEN relay_limits.day_used+1 ELSE 1 END WHERE (relay_limits.minute!=excluded.minute OR relay_limits.minute_used<4) AND (relay_limits.day!=excluded.day OR relay_limits.day_used<200)`).bind(id,minute,day).run();
 if(!quota.meta.changes)return response(429);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);let upstream;
 try{upstream=await forward(TARGET,{method:'POST',redirect:'manual',signal:controller.signal,headers:{'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+env.HOMEBASE_ACCESS_TOKEN,'X-CRM-Device':id,'X-CRM-Time':time,'X-CRM-Signature':signature},body});}finally{clearTimeout(timeout);}
 if(!upstream.ok)return reject([400,401,409,413,429].includes(upstream.status)?upstream.status:503,'UPSTREAM_HTTP_'+upstream.status);
 const ack=await upstream.json();if(!exact(ack,'accepted sequence digest duplicate')||ack.accepted!==true||ack.sequence!==data.sequence||ack.digest!==digest||typeof ack.duplicate!=='boolean')return response(502);
 return response(200,ack);
 }catch{return reject(503,'RELAY_INTERNAL');}
}
export default {fetch:(request,env)=>handle(request,env)};
