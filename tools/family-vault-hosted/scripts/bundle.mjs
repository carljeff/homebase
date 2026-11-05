import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const names={'/':['index.html','text/html; charset=utf-8'],'/client.mjs':['client.mjs','text/javascript'],'/crypto.mjs':['crypto.mjs','text/javascript'],'/session.mjs':['session.mjs','text/javascript'],'/sharing.mjs':['sharing.mjs','text/javascript'],'/share-validation.mjs':['share-validation.mjs','text/javascript'],'/style.css':['style.css','text/css']},assets={};
for(const [url,[name,type]]of Object.entries(names))assets[url]={body:await readFile('vault/'+name,'utf8'),type};
const sharedValidation=(await readFile('vault/share-validation.mjs','utf8')).replace("import {exact,unb64,uuid,ITERATIONS} from './crypto.mjs';",'').replaceAll('export ','');
const validation=(await readFile('vault/validation.mjs','utf8')).replaceAll('export ',''),handler=(await readFile('worker/handler.mjs','utf8')).replace("import {validConfig,validEnvelope,exact,uuid} from '../vault/validation.mjs';",'').replace("import {validCredential,validPackage,publicFingerprint} from '../vault/share-validation.mjs';",'').replaceAll('export ','');
await writeFile('worker/index.js',validation+'\n'+sharedValidation+'\n'+handler+'\nconst assets='+JSON.stringify(assets)+';\nexport default {fetch:(request,env)=>handle(request,env,assets)};\n');
