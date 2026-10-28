// Test-only in-memory D1 adapter. Never imported by application code.
import {registerHooks} from 'node:module';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
function statement(sql,args=[]){return {bind(...values){return statement(sql,values)},async all(){return {results:sqlite.prepare(sql).all(...args)}},async first(){return sqlite.prepare(sql).get(...args)??null},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}};}
globalThis.__homebaseTestEnv={DB:{prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
registerHooks({resolve(specifier,context,nextResolve){if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env = globalThis.__homebaseTestEnv;',shortCircuit:true};if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')&&!specifier.endsWith('.ts')&&!specifier.endsWith('.mjs')){const u=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(u)))return nextResolve(u.href,context);}return nextResolve(specifier,context);}});
