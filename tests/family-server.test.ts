// Run with the same node --experimental-strip-types --test command as other suites.
import {test} from 'node:test';
import assert from 'node:assert/strict';
await import('./server-env.mjs');
const {operate:operateImpl}=await import('../lib/operations');
const operate:(...args:Parameters<typeof operateImpl>)=>Promise<any>=operateImpl;
const giver='test-giver',recipient='test-recipient';
test('private family setup is persistent and idempotent without overwriting settings or profile edits',async()=>{
 const settings=await operate({action:'save',kind:'settings',data:{title:'Synthetic settings'}},giver);
 const payload={action:'save',kind:'settings',data:{familyOperation:{action:'ensure_profiles',profiles:[{name:'Synthetic parent',role:'parent'},{name:'Synthetic child',role:'child'}]}}};
 const initial:any=await operate(payload,giver);assert.equal(initial.profiles.length,2);
 const p:any=(await operate({action:'list'},giver)).find((r:any)=>r.kind==='family'&&r.data.role==='child');
 await operate({action:'save',kind:'family',id:p.id,version:p.version,data:{...p.data,interests:'Synthetic interest'}},giver);
 const repeat:any=await operate(payload,giver);assert.ok(repeat.profiles.every((p:any)=>p.existing));
 const rows=await operate({action:'list'},recipient);assert.equal(rows.filter((r:any)=>r.kind==='family').length,2);assert.equal(rows.find((r:any)=>r.id===p.id).data.interests,'Synthetic interest');assert.equal(rows.find((r:any)=>r.id===settings.id).version,1);
 await assert.rejects(operate({action:'save',kind:'family',data:{name:' SYNTHETIC CHILD ',role:'child'}},giver),/already exists/);
 await assert.rejects(operate({action:'delete',id:p.id,version:2},giver),/retained/);
});
test('API and connector shared dispatcher protects surprise reads, forged edits and direct deletes',async()=>{
 const profile:any=(await operate({action:'list'},giver)).find((r:any)=>r.kind==='family');
 const secret:any=await operate({action:'save',kind:'wishlist',data:{profileId:profile.id,title:'Synthetic secret gift',notes:'Private test note',purchased:true,creatorId:recipient}},giver);
 assert.equal(secret.data.creatorId,giver);
 const before=await operate({action:'list'},recipient);assert.ok(!before.some((r:any)=>r.id===secret.id));
 await assert.rejects(operate({action:'save',kind:'wishlist',id:secret.id,version:1,data:{...secret.data,creatorId:recipient,surprise:false}},recipient),/unavailable/);
 await assert.rejects(operate({action:'delete',id:secret.id,version:1},recipient),/unavailable/);
 assert.ok((await operate({action:'list'},giver)).some((r:any)=>r.id===secret.id));
 const shared:any=await operate({action:'save',kind:'wishlist',data:{profileId:profile.id,title:'Synthetic shared idea',surprise:false}},giver);
 assert.ok((await operate({action:'list'},recipient)).some((r:any)=>r.id===shared.id));
 const updated:any=await operate({action:'save',kind:'wishlist',id:shared.id,version:1,data:{...shared.data,purchased:true,creatorId:recipient}},recipient);assert.equal(updated.data.creatorId,giver);
 await assert.rejects(operate({action:'save',kind:'wishlist',id:shared.id,version:1,data:shared.data},giver),/Conflict/);
 await operate({action:'delete',id:secret.id,version:1},giver);
 assert.ok(!(await operate({action:'list'},giver)).some((r:any)=>r.id===secret.id));
});
