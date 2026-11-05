import {validConfig,validEnvelope,exact,uuid} from '../vault/validation.mjs';
export const profiles=Array.from({length:5},(_,i)=>`${i+1}1111111-1111-4111-a111-111111111111`);
const expectedOrigin='https://homebase-vault-demo.carl-jeff.chatgpt.site';
const idle=120000,lifetime=600000;
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const token=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const securityHeaders={'Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"};
export async function handle(request,env,assets,now=Date.now()){
 const reply=(status,data)=>Response.json(data,{status,headers:securityHeaders});
 try{
  const url=new URL(request.url);if(url.origin!==expectedOrigin||url.search)return reply(400,{error:'Invalid demo request'});
  const user=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
  // Dispatch owns sign-in and the owner-private audience. Service bypass alone is not a visitor identity.
  if(!user||!email||user.length>300)return reply(401,{error:'Sign in to this private demo'});
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
   await env.DB.prepare('DELETE FROM demo_sessions WHERE owner_id=? AND (last_seen<=? OR expires_at<=?)').bind(user,now-idle,now).run();
   const active=await env.DB.prepare('SELECT count(*) count FROM demo_sessions WHERE owner_id=?').bind(user).first();if(active.count>=10)return reply(429,{error:'Wait for older test sessions to expire'});
   const value=token();await env.DB.prepare('INSERT INTO demo_sessions(token_digest,owner_id,last_seen,expires_at) VALUES (?,?,?,?)').bind(await digest(value),user,now,now+lifetime).run();return reply(200,{token:value,memberId:'demo-member-a',profiles});
  }
  const value=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!value)return reply(401,{error:'Unlock session expired'});const hash=await digest(value);
  const session=await env.DB.prepare('UPDATE demo_sessions SET last_seen=? WHERE token_digest=? AND owner_id=? AND last_seen>? AND expires_at>?').bind(now,hash,user,now-idle,now).run();if(!session.meta.changes)return reply(401,{error:'Unlock session expired'});
  if(url.pathname==='/api/lock'&&request.method==='POST'){if(!exact(body,''))return reply(400,{error:'Invalid request'});await env.DB.prepare('DELETE FROM demo_sessions WHERE token_digest=? AND owner_id=?').bind(hash,user).run();return reply(200,{locked:true});}
  if(url.pathname==='/api/reset'&&request.method==='POST'){
   if(!exact(body,'confirm')||body.confirm!=='ERASE DEMO')return reply(400,{error:'Explicit demo reset required'});
   await env.DB.batch([env.DB.prepare('DELETE FROM demo_records WHERE owner_id=?').bind(user),env.DB.prepare('DELETE FROM demo_vaults WHERE owner_id=?').bind(user),env.DB.prepare('DELETE FROM demo_sessions WHERE owner_id=?').bind(user)]);return reply(200,{reset:true});
  }
  const stored=await env.DB.prepare('SELECT config_json FROM demo_vaults WHERE owner_id=?').bind(user).first();const config=stored?JSON.parse(stored.config_json):null;
  if(url.pathname==='/api/state'&&request.method==='GET'){const rows=await env.DB.prepare('SELECT data_json FROM demo_records WHERE owner_id=? AND deleted=0').bind(user).all();return reply(200,{config,records:rows.results.map(r=>JSON.parse(r.data_json))});}
  if(url.pathname==='/api/setup'&&request.method==='POST'){if(!validConfig(body))return reply(400,{error:'Encrypted envelope required'});const result=await env.DB.prepare('INSERT OR IGNORE INTO demo_vaults(owner_id,config_json) SELECT ?,? WHERE EXISTS (SELECT 1 FROM demo_sessions WHERE token_digest=? AND owner_id=? AND expires_at>?)').bind(user,JSON.stringify(body),hash,user,now).run();return reply(result.meta.changes?201:409,result.meta.changes?{created:true}:{error:'Already initialized'});}
  if(url.pathname==='/api/records'&&request.method==='PUT'){
   if(!config||!validEnvelope(body)||body.vaultId!==config.vaultId||!profiles.includes(body.profileId))return reply(400,{error:'Encrypted envelope required'});
   const existing=await env.DB.prepare('SELECT id FROM demo_records WHERE owner_id=? AND id=?').bind(user,body.id).first();if(!existing){const count=await env.DB.prepare('SELECT count(*) count FROM demo_records WHERE owner_id=?').bind(user).first();if(count.count>=100)return reply(409,{error:'Reset demo to clear the 100-record limit'});}
   if(!existing&&body.revision!==1)return reply(409,{error:'Refresh before editing'});
   const result=await env.DB.prepare('INSERT INTO demo_records(owner_id,id,profile_id,revision,data_json,deleted) SELECT ?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM demo_vaults WHERE owner_id=? AND config_json=?) AND EXISTS (SELECT 1 FROM demo_sessions WHERE token_digest=? AND owner_id=? AND expires_at>?) ON CONFLICT(owner_id,id) DO UPDATE SET revision=excluded.revision,data_json=excluded.data_json WHERE demo_records.deleted=0 AND demo_records.profile_id=excluded.profile_id AND demo_records.revision+1=excluded.revision').bind(user,body.id,body.profileId,body.revision,JSON.stringify(body),user,stored.config_json,hash,user,now).run();return reply(result.meta.changes?200:409,result.meta.changes?{saved:true}:{error:'Refresh before editing'});
  }
  if(url.pathname==='/api/records'&&request.method==='DELETE'){
   if(!exact(body,'id revision')||!uuid.test(body.id)||!Number.isSafeInteger(body.revision))return reply(400,{error:'Invalid request'});const result=await env.DB.prepare("UPDATE demo_records SET deleted=1,data_json='{}' WHERE owner_id=? AND id=? AND revision=? AND deleted=0").bind(user,body.id,body.revision).run();return reply(result.meta.changes?200:409,result.meta.changes?{deleted:true}:{error:'Refresh before deleting'});
  }
  return reply(404,{error:'Unavailable in synthetic demo'});
 }catch{return reply(400,{error:'Demo request failed safely'});}
}
