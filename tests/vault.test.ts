import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertOrdinaryInput,withoutVaultFields,ordinaryKinds} from '../lib/vault-boundary.ts';
await import('./server-env.mjs');
const {operate:op}=await import('../lib/operations');
const {env}=await import('cloudflare:workers');
const operate:(...args:Parameters<typeof op>)=>Promise<any>=op;
test('vault categories and secret payloads are rejected before any ordinary operation',()=>{
 for(const input of [{action:'save',kind:'vault',data:{}},{action:'vault_unlock'},{action:'save',kind:'family',data:{name:'Synthetic person',vault:{number:'SYNTHETIC-ONLY'}}},{action:'save',kind:'settings',data:{nested:[{secretValue:'SYNTHETIC-ONLY'}]}},{action:'save',kind:'family',data:{passport_number:'SYNTHETIC-ONLY'}}])assert.throws(()=>assertOrdinaryInput(input),e=>e instanceof Error&&!e.message.includes('SYNTHETIC-ONLY'));
 assert.doesNotThrow(()=>assertOrdinaryInput({action:'save',kind:'family',data:{name:'Synthetic person',notes:'Ordinary household note'}}));
 assert.ok(!ordinaryKinds.some(k=>/vault/i.test(k)));
});
test('defensive public serialization removes nested reserved fields without changing household content',()=>{assert.deepEqual(withoutVaultFields({name:'Synthetic person',vaultRecords:[{value:'SYNTHETIC-ONLY'}],dates:[{title:'Synthetic event',vaultSecret:'SYNTHETIC-ONLY'}]}),{name:'Synthetic person',dates:[{title:'Synthetic event'}]})});
test('ordinary API/MCP dispatcher cannot read, update, or delete foreign vault records by ID',async()=>{
 const vaultId='22222222-2222-4222-a222-222222222222';
 await env.DB!.prepare('INSERT INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,?,?,1,?,?)').bind(vaultId,'vault',JSON.stringify({secretValue:'SYNTHETIC-ONLY'}),'2026-10-28T00:00:00Z','synthetic-adult').run();
 for(const user of ['synthetic-adult','synthetic-child','synthetic-other']){
  const rows=await operate({action:'list'},user);assert.ok(!rows.some((r:any)=>r.id===vaultId));assert.ok(!JSON.stringify(rows).includes('SYNTHETIC-ONLY'));
  await assert.rejects(operate({action:'save',kind:'vault',id:vaultId,version:1,data:{secretValue:'SYNTHETIC-EDIT'}},user));
  await assert.rejects(operate({action:'save',kind:'highlight',id:vaultId,version:1,data:{title:'Synthetic overwrite'}},user));
  await assert.rejects(operate({action:'delete',id:vaultId,version:1},user));
 }
 const stored=await env.DB!.prepare('SELECT data,version FROM records WHERE id=?').bind(vaultId).first<any>();assert.equal(stored.version,1);assert.equal(JSON.parse(stored.data).secretValue,'SYNTHETIC-ONLY');
});
test('profile edits reject attached vault fields, and legacy nested vault data never leaves ordinary lists',async()=>{
 const p=await operate({action:'save',kind:'family',data:{name:'Synthetic vault-boundary profile',role:'other'}},'synthetic-adult');
 await assert.rejects(operate({action:'save',kind:'family',id:p.id,version:1,data:{...p.data,vault:{secretValue:'SYNTHETIC-ONLY'}}},'synthetic-adult'));
 await env.DB!.prepare('UPDATE records SET data=? WHERE id=?').bind(JSON.stringify({...p.data,vault:{secretValue:'SYNTHETIC-ONLY'}}),p.id).run();
 const listed=(await operate({action:'list'},'synthetic-adult')).find((r:any)=>r.id===p.id);assert.equal(listed.data.name,p.data.name);assert.equal(listed.data.vault,undefined);
});
