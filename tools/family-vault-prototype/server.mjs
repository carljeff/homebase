// Local synthetic-only ciphertext transport. Never deploy; no Homebase bindings or credentials.
import {createServer} from 'node:http';import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {validConfig,validEnvelope,exact,uuid} from './crypto.mjs';
export const ALLOWED_PROFILES=Array.from({length:5},(_,i)=>`${i+1}1111111-1111-4111-a111-111111111111`);
const idle=120000;
const equal=(a,b)=>{const digest=v=>createHash('sha256').update(v).digest();return timingSafeEqual(digest(a),digest(b));};
export function createPrototype({parentOrigin='http://127.0.0.1:5173',port=8790,accessCode=randomBytes(24).toString('base64url'),clock=Date.now}={}){
 const parent=new URL(parentOrigin);if(parent.protocol!=='http:'||!['localhost','127.0.0.1'].includes(parent.hostname)||parent.origin!==parentOrigin||process.env.NODE_ENV==='production')throw Error('Local synthetic prototype only');
 let server;let config=null;const records=new Map(),deleted=new Set(),sessions=new Map(),attempts=[];
 const headers={'Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':`default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors ${parentOrigin}`};
 async function handle(req,res){const reply=(status,data)=>{res.writeHead(status,{...headers,'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try{
   const activePort=port||server.address()?.port,origin=`http://127.0.0.1:${activePort}`;
   if(req.headers.host!==`127.0.0.1:${activePort}`||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return reply(403,{error:'Local prototype only'});
   const url=new URL(req.url,origin);if(url.search)return reply(400,{error:'Invalid request'});
   const assets=new Map([['/',['index.html','text/html']],['/client.mjs',['client.mjs','text/javascript']],['/crypto.mjs',['crypto.mjs','text/javascript']],['/session.mjs',['session.mjs','text/javascript']],['/style.css',['style.css','text/css']]]);
   if(req.method==='GET'&&assets.has(url.pathname)){const [name,type]=assets.get(url.pathname);res.writeHead(200,{...headers,'Content-Type':type});return res.end(await readFile(new URL(name,import.meta.url)));}
   if(!url.pathname.startsWith('/api/'))return reply(404,{error:'Not found'});
   if(req.headers.origin!==origin&&!(req.method==='GET'&&!req.headers.origin&&req.headers['sec-fetch-site']==='same-origin'))return reply(403,{error:'Origin rejected'});
   if(!['POST','GET','PUT','DELETE'].includes(req.method))return reply(405,{error:'Method rejected'});
   let body=null;if(req.method!=='GET'){if(req.headers['content-type']!=='application/json'||req.headers['content-encoding'])return reply(415,{error:'JSON required'});let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>24000)return reply(413,{error:'Request too large'});chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(400,{error:'Invalid request'});}}
   if(url.pathname==='/api/login'&&req.method==='POST'){while(attempts.length&&attempts[0]<clock()-60000)attempts.shift();if(attempts.length>=5)return reply(429,{error:'Try again later'});attempts.push(clock());for(const [id,last]of sessions)if(clock()-last>=idle)sessions.delete(id);if(!exact(body,'code')||typeof body.code!=='string'||body.code.length>100||!equal(body.code,accessCode))return reply(403,{error:'Not a prototype member'});const token=randomBytes(32).toString('base64url');sessions.set(token,clock());return reply(200,{token,memberId:'demo-member-a',profiles:ALLOWED_PROFILES});}
   const token=(req.headers.authorization??'').replace(/^Bearer /,'');if(!sessions.has(token)||clock()-sessions.get(token)>=idle){sessions.delete(token);return reply(401,{error:'Unlock session expired'});}sessions.set(token,clock());
   if(url.pathname==='/api/lock'&&req.method==='POST'){sessions.delete(token);return reply(200,{locked:true});}
   if(url.pathname==='/api/state'&&req.method==='GET')return reply(200,{config,records:[...records.values()]});
   if(url.pathname==='/api/setup'&&req.method==='POST'){if(config)return reply(409,{error:'Already initialized'});if(!validConfig(body))return reply(400,{error:'Encrypted envelope required'});config=structuredClone(body);return reply(201,{created:true});}
   if(url.pathname==='/api/records'&&req.method==='PUT'){if(!config||!validEnvelope(body)||body.vaultId!==config.vaultId||!ALLOWED_PROFILES.includes(body.profileId))return reply(400,{error:'Encrypted envelope required'});const prior=records.get(body.id);if(deleted.has(body.id)||(prior?prior.revision+1:1)!==body.revision||prior&&prior.profileId!==body.profileId)return reply(409,{error:'Refresh before editing'});if(!prior&&records.size>=50)return reply(409,{error:'Prototype record limit'});records.set(body.id,structuredClone(body));return reply(200,{saved:true});}
   if(url.pathname==='/api/records'&&req.method==='DELETE'){if(!exact(body,'id revision')||!uuid.test(body.id)||records.get(body.id)?.revision!==body.revision)return reply(409,{error:'Refresh before deleting'});records.delete(body.id);deleted.add(body.id);return reply(200,{deleted:true});}
   return reply(404,{error:'Not available in prototype'});
  }catch{reply(400,{error:'Prototype request failed'});}
 }
 server=createServer(handle);return {server,accessCode,inspect:()=>({config:structuredClone(config),records:[...records.values()].map(r=>structuredClone(r))})};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const options={parentOrigin:process.argv[2]??'http://127.0.0.1:5173'};const app=createPrototype(options);app.server.listen(8790,'127.0.0.1',()=>{process.stdout.write('Synthetic-only vault at http://127.0.0.1:8790\nOne-time local membership code (not a vault passphrase): '+app.accessCode+'\nState is memory-only; stopping this process erases it.\n');});}
