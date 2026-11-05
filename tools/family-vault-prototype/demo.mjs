// One-command local harness of the real Family component; synthetic records only.
import {build} from 'vite';import react from '@vitejs/plugin-react';import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {createPrototype} from './server.mjs';
if(process.env.NODE_ENV==='production')throw Error('Local test harness only');
const originalMode=process.env.NODE_ENV;
const root=fileURLToPath(new URL('.',import.meta.url));
await build({configFile:false,root,plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{outDir:'.demo-build',emptyOutDir:true,rollupOptions:{input:root+'demo.html'}}});
if(originalMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=originalMode;
const parentOrigin='http://127.0.0.1:5179',vault=createPrototype({parentOrigin});
const host=createServer(async(req,res)=>{try{if(req.headers.host!=='127.0.0.1:5179'||req.method!=='GET')throw Error();const path=new URL(req.url,parentOrigin).pathname;if(path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+\.(js|css)$/.test(path))throw Error();const body=await readFile(root+'.demo-build/'+(path==='/'?'demo.html':path.slice(1)));res.writeHead(200,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src http://127.0.0.1:8790; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise((resolve,reject)=>{vault.server.once('error',reject);vault.server.listen(8790,'127.0.0.1',resolve);});
try{await new Promise((resolve,reject)=>{host.once('error',reject);host.listen(5179,'127.0.0.1',resolve);});}catch(error){vault.server.close();throw error;}
if(process.argv.includes('--smoke')){
 for(const url of [parentOrigin,'http://127.0.0.1:8790']){const response=await fetch(url);if(response.status!==200||response.headers.get('cache-control')!=='no-store')throw Error('Harness smoke check failed');}
 process.stdout.write('Local synthetic harness: both origins serve HTTP 200 with no-store.\n');
 await Promise.all([new Promise(resolve=>host.close(resolve)),new Promise(resolve=>vault.server.close(resolve))]);
}else process.stdout.write('\nOpen '+parentOrigin+'\nSynthetic membership code: '+vault.accessCode+'\nChoose a separate TEST passphrase inside the vault. Never use a real password.\nStop with Ctrl-C; temporary encrypted state will be erased.\n');
