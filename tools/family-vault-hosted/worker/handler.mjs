import {validConfig,validEnvelope,exact,uuid} from '../vault/validation.mjs';
import {validCredential,validPackage,publicFingerprint} from '../vault/share-validation.mjs';
export const profiles=Array.from({length:5},(_,i)=>`${i+1}1111111-1111-4111-a111-111111111111`);
const expectedOrigin='https://homebase-vault-demo.carl-jeff.chatgpt.site',idle=120000,lifetime=600000;
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const token=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const publicCredential=c=>({v:c.v,memberId:c.memberId,publicKey:c.publicKey,fingerprint:c.fingerprint});
export const securityHeaders={'Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"};
export async function handle(request,env,assets,now=Date.now()){
 const reply=(status,data)=>Response.json(data,{status,headers:securityHeaders});
 try{
  const url=new URL(request.url);if(url.origin!==expectedOrigin||url.search)return reply(400,{error:'Invalid demo request'});
  const user=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if(!user||!email||user.length>300)return reply(401,{error:'Sign in to this private demo'});
  const ownerEmail=env.VAULT_OWNER_EMAIL?.trim().toLowerCase(),secondEmail=env.VAULT_SECOND_ADULT_EMAIL?.trim().toLowerCase();
  if(!ownerEmail||!secondEmail||ownerEmail===secondEmail)return reply(503,{error:'Demo adult identities are not configured'});
  if(![ownerEmail,secondEmail].includes(email))return reply(403,{error:'Not an authorized demo adult'});
  const primary=email===ownerEmail;
  if(request.method==='GET'&&assets[url.pathname]){const asset=assets[url.pathname];return new Response(asset.body,{headers:{...securityHeaders,'Content-Type':asset.type}});}
  if(!url.pathname.startsWith('/api/'))return reply(404,{error:'Not found'});
  if(!env.DB)return reply(503,{error:'Demo storage unavailable'});
  const origin=request.headers.get('origin');if(origin&&origin!==expectedOrigin||request.headers.get('sec-fetch-site')==='cross-site'||request.method!=='GET'&&origin!==expectedOrigin)return reply(403,{error:'Origin rejected'});
  if(!['POST','GET','PUT','DELETE'].includes(request.method))return reply(405,{error:'Method rejected'});
  const minute=Math.floor(now/60000),limit=await env.DB.prepare('INSERT INTO demo_limits(owner_id,minute,used) VALUES (?,?,1) ON CONFLICT(owner_id) DO UPDATE SET minute=excluded.minute,used=CASE WHEN demo_limits.minute=excluded.minute THEN demo_limits.used+1 ELSE 1 END WHERE demo_limits.minute!=excluded.minute OR demo_limits.used<120').bind(user,minute).run();if(!limit.meta.changes)return reply(429,{error:'Try again in a minute'});
  let body=null;if(request.method!=='GET'){
   if(request.headers.get('content-type')!=='application/json'||request.headers.has('content-encoding'))return reply(415,{error:'JSON required'});
   if(Number(request.headers.get('content-length')||0)>24000)return reply(413,{error:'Request too large'});
   const reader=request.body?.getReader();if(!reader)return reply(400,{error:'JSON required'});let length=0;const chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>24000){await reader.cancel();return reply(413,{error:'Request too large'});}chunks.push(value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }
  if(url.pathname==='/api/login'&&request.method==='POST'){
   if(!exact(body,''))return reply(400,{error:'Do not send passwords to the demo server'});
   if(primary)await env.DB.prepare('INSERT OR IGNORE INTO demo_household(slot,owner_id) VALUES (1,?)').bind(user).run();
   const home=await env.DB.prepare('SELECT owner_id FROM demo_household WHERE slot=1').first();
   if(!home||primary&&home.owner_id!==user)return reply(403,{error:'The first adult must open the demo first'});
   await env.DB.prepare('DELETE FROM demo_sessions WHERE owner_id=? AND (last_seen<=? OR expires_at<=?)').bind(user,now-idle,now).run();
   const active=await env.DB.prepare('SELECT count(*) count FROM demo_sessions WHERE owner_id=?').bind(user).first();if(active.count>=10)return reply(429,{error:'Wait for older test sessions to expire'});
   const value=token();await env.DB.prepare('INSERT INTO demo_sessions(token_digest,owner_id,last_seen,expires_at) VALUES (?,?,?,?)').bind(await digest(value),user,now,now+lifetime).run();return reply(200,{token:value,memberId:user,profiles,role:primary?'first':'second'});
  }
  const value=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!value)return reply(401,{error:'Unlock session expired'});const hash=await digest(value);
  const session=await env.DB.prepare('UPDATE demo_sessions SET last_seen=? WHERE token_digest=? AND owner_id=? AND last_seen>? AND expires_at>?').bind(now,hash,user,now-idle,now).run();if(!session.meta.changes)return reply(401,{error:'Unlock session expired'});
  if(url.pathname==='/api/lock'&&request.method==='POST'){if(!exact(body,''))return reply(400,{error:'Invalid request'});await env.DB.prepare('DELETE FROM demo_sessions WHERE token_digest=? AND owner_id=?').bind(hash,user).run();return reply(200,{locked:true});}
  const home=await env.DB.prepare('SELECT owner_id FROM demo_household WHERE slot=1').first();if(!home||primary&&home.owner_id!==user)return reply(403,{error:'Household unavailable'});const owner=home.owner_id;
  const membership=await env.DB.prepare('SELECT * FROM demo_members WHERE owner_id=? AND user_id=?').bind(owner,user).first();const isMember=primary||membership?.status==='approved';
  const stored=await env.DB.prepare('SELECT config_json FROM demo_vaults WHERE owner_id=?').bind(owner).first();const config=stored?JSON.parse(stored.config_json):null;
  if(url.pathname==='/api/state'&&request.method==='GET'){
   if(!isMember)return reply(200,{config:null,records:[],canInitialize:false,role:'second',membership:membership?{status:'pending',requestId:membership.request_id,credential:JSON.parse(membership.credential_json)}:null});
   const rows=await env.DB.prepare('SELECT data_json FROM demo_records WHERE owner_id=? AND deleted=0').bind(owner).all();
   const pending=await env.DB.prepare("SELECT request_id,credential_json FROM demo_members WHERE owner_id=? AND status='pending'").bind(owner).all();
   const shared=!!await env.DB.prepare("SELECT user_id FROM demo_members WHERE owner_id=? AND status='approved'").bind(owner).first();
   return reply(200,{shared,config:primary?config:config?{vaultId:config.vaultId}:null,records:rows.results.map(r=>JSON.parse(r.data_json)),canInitialize:primary,role:primary?'first':'second',membership:primary?null:{status:'approved',credential:JSON.parse(membership.credential_json),package:JSON.parse(membership.package_json)},requests:pending.results.map(r=>({requestId:r.request_id,credential:publicCredential(JSON.parse(r.credential_json))}))});
  }
  if(url.pathname==='/api/enroll'&&request.method==='POST'){
   if(primary||!config||!validCredential(body)||body.memberId!==user||await publicFingerprint(body.publicKey)!==body.fingerprint)return reply(400,{error:'Invalid second-adult request'});
   const result=await env.DB.prepare("INSERT OR IGNORE INTO demo_members(user_id,owner_id,request_id,credential_json,status) SELECT ?,?,?,?,'pending' WHERE EXISTS (SELECT 1 FROM demo_vaults WHERE owner_id=? AND config_json=?) AND EXISTS (SELECT 1 FROM demo_sessions WHERE token_digest=? AND owner_id=? AND expires_at>?)").bind(user,owner,crypto.randomUUID(),JSON.stringify(body),owner,stored.config_json,hash,user,now).run();return reply(result.meta.changes?201:409,result.meta.changes?{requested:true}:{error:'A request or membership already exists'});
  }
  if(!isMember)return reply(403,{error:'Explicit vault membership required'});
  if(url.pathname==='/api/approve'&&request.method==='POST'){
   if(!validPackage(body)||!config||body.vaultId!==config.vaultId)return reply(400,{error:'Invalid encrypted approval'});
   const row=await env.DB.prepare("SELECT * FROM demo_members WHERE owner_id=? AND request_id=? AND status='pending'").bind(owner,body.requestId).first();if(!row||row.user_id===user)return reply(409,{error:'Request changed'});const c=JSON.parse(row.credential_json);
   if(c.memberId!==body.recipientId||c.fingerprint!==body.fingerprint)return reply(409,{error:'Request changed'});
   const result=await env.DB.prepare("UPDATE demo_members SET status='approved',package_json=? WHERE owner_id=? AND request_id=? AND status='pending' AND credential_json=? AND EXISTS (SELECT 1 FROM demo_vaults WHERE owner_id=? AND config_json=?)").bind(JSON.stringify(body),owner,body.requestId,row.credential_json,owner,stored.config_json).run();return reply(result.meta.changes?200:409,result.meta.changes?{approved:true}:{error:'Request changed'});
  }
  if(url.pathname==='/api/reject'&&request.method==='POST'){if(!exact(body,'requestId')||!uuid.test(body.requestId))return reply(400,{error:'Invalid request'});await env.DB.prepare("DELETE FROM demo_members WHERE owner_id=? AND request_id=? AND status='pending'").bind(owner,body.requestId).run();return reply(200,{rejected:true});}
  if(url.pathname==='/api/reset')return reply(409,{error:'Use the explicit erase confirmation flow'});
  if(url.pathname==='/api/erase'&&request.method==='POST'){
   const auth=await env.DB.prepare('SELECT expires_at FROM demo_sessions WHERE token_digest=? AND owner_id=?').bind(hash,user).first();if(!auth||now-(auth.expires_at-lifetime)>60000)return reply(401,{error:'Start erase confirmation again'});
   const second=await env.DB.prepare("SELECT user_id FROM demo_members WHERE owner_id=? AND status='approved'").bind(owner).first(),shared=!!second;
   if(exact(body,'action')&&body.action==='request'){
    const requestId=crypto.randomUUID();await env.DB.prepare('INSERT INTO demo_erase(owner_id,request_id,requested_by,expires_at) VALUES (?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET request_id=excluded.request_id,requested_by=excluded.requested_by,expires_at=excluded.expires_at WHERE demo_erase.expires_at<=?').bind(owner,requestId,user,now+600000,now).run();
    const row=await env.DB.prepare('SELECT * FROM demo_erase WHERE owner_id=?').bind(owner).first();return reply(200,{requestId:row.request_id,shared,requestedByYou:row.requested_by===user,expiresAt:row.expires_at});
   }
   if(exact(body,'action requestId')&&body.action==='cancel'&&uuid.test(body.requestId)){await env.DB.prepare('DELETE FROM demo_erase WHERE owner_id=? AND request_id=?').bind(owner,body.requestId).run();return reply(200,{cancelled:true});}
   if(!exact(body,'action requestId confirm')||body.action!=='confirm'||!uuid.test(body.requestId)||body.confirm!==(shared?'ERASE SHARED DEMO':'ERASE DEMO'))return reply(400,{error:'Explicit erase confirmation required'});
   const row=await env.DB.prepare('SELECT * FROM demo_erase WHERE owner_id=? AND request_id=? AND expires_at>?').bind(owner,body.requestId,now).first();if(!row||shared&&row.requested_by===user)return reply(409,{error:'Both adults must confirm a shared erase'});
   const claim=token(),guard='EXISTS (SELECT 1 FROM demo_erase WHERE owner_id=? AND request_id=? AND requested_by=?)';
   const writes=[env.DB.prepare("UPDATE demo_erase SET requested_by=? WHERE owner_id=? AND request_id=? AND requested_by=? AND expires_at>? AND (SELECT count(*) FROM demo_members WHERE owner_id=? AND status='approved')=? AND EXISTS (SELECT 1 FROM demo_sessions WHERE token_digest=? AND owner_id=? AND expires_at>?)").bind(claim,owner,body.requestId,row.requested_by,now,owner,shared?1:0,hash,user,now)];
   writes.push(env.DB.prepare('DELETE FROM demo_sessions WHERE (owner_id=? OR owner_id IN (SELECT user_id FROM demo_members WHERE owner_id=?)) AND '+guard).bind(owner,owner,owner,body.requestId,claim));
   for(const table of ['demo_members','demo_records','demo_vaults'])writes.push(env.DB.prepare('DELETE FROM '+table+' WHERE owner_id=? AND '+guard).bind(owner,owner,body.requestId,claim));
   writes.push(env.DB.prepare('DELETE FROM demo_erase WHERE owner_id=? AND request_id=? AND requested_by=?').bind(owner,body.requestId,claim));
   const erased=await env.DB.batch(writes);return reply(erased[0].meta.changes?200:409,erased[0].meta.changes?{erased:true}:{error:'Erase approval changed; no data erased'});
  }
  if(url.pathname==='/api/setup'&&request.method==='POST'){if(!primary||!validConfig(body))return reply(400,{error:'Encrypted envelope required'});const result=await env.DB.prepare('INSERT OR IGNORE INTO demo_vaults(owner_id,config_json) SELECT ?,? WHERE EXISTS (SELECT 1 FROM demo_sessions WHERE token_digest=? AND owner_id=? AND expires_at>?)').bind(owner,JSON.stringify(body),hash,user,now).run();return reply(result.meta.changes?201:409,result.meta.changes?{created:true}:{error:'Already initialized'});}
  if(url.pathname==='/api/records'&&request.method==='PUT'){
   if(!config||!validEnvelope(body)||body.vaultId!==config.vaultId||!profiles.includes(body.profileId))return reply(400,{error:'Encrypted envelope required'});
   const existing=await env.DB.prepare('SELECT id FROM demo_records WHERE owner_id=? AND id=?').bind(owner,body.id).first();if(!existing){const count=await env.DB.prepare('SELECT count(*) count FROM demo_records WHERE owner_id=?').bind(owner).first();if(count.count>=100)return reply(409,{error:'Demo record limit reached'});}
   if(!existing&&body.revision!==1)return reply(409,{error:'Refresh before editing'});
   const result=await env.DB.prepare('INSERT INTO demo_records(owner_id,id,profile_id,revision,data_json,deleted) SELECT ?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM demo_vaults WHERE owner_id=? AND config_json=?) AND EXISTS (SELECT 1 FROM demo_sessions WHERE token_digest=? AND owner_id=? AND expires_at>?) ON CONFLICT(owner_id,id) DO UPDATE SET revision=excluded.revision,data_json=excluded.data_json WHERE demo_records.deleted=0 AND demo_records.profile_id=excluded.profile_id AND demo_records.revision+1=excluded.revision').bind(owner,body.id,body.profileId,body.revision,JSON.stringify(body),owner,stored.config_json,hash,user,now).run();return reply(result.meta.changes?200:409,result.meta.changes?{saved:true}:{error:'Refresh before editing'});
  }
  if(url.pathname==='/api/records'&&request.method==='DELETE'){
   if(!exact(body,'id revision')||!uuid.test(body.id)||!Number.isSafeInteger(body.revision))return reply(400,{error:'Invalid request'});const result=await env.DB.prepare("UPDATE demo_records SET deleted=1,data_json='{}' WHERE owner_id=? AND id=? AND revision=? AND deleted=0").bind(owner,body.id,body.revision).run();return reply(result.meta.changes?200:409,result.meta.changes?{deleted:true}:{error:'Refresh before deleting'});
  }
  return reply(404,{error:'Unavailable in synthetic demo'});
 }catch{return reply(400,{error:'Demo request failed safely'});}
}
