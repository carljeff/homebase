import {enableActionKeys,proofFor} from './action-test-helpers.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VaultSession} from './vault/session.mjs';
import {fixture,request} from './test-fixture.mjs';
import {handle,profiles,securityHeaders} from './worker/handler.mjs';
import {createVault,encryptRecord} from './vault/crypto.mjs';
import {createCredential,approveMember} from './vault/sharing.mjs';

test('local idle and absolute lifetimes lock even during activity and cannot be revived by touch',()=>{
 let now=1000;const revoked=[];const s=new VaultSession(token=>{if(token)revoked.push(token);},{clock:()=>now});
 let epoch=s.begin();s.key={};s.token='absolute';
 for(let i=0;i<9;i++){now+=60000;s.touch();assert.ok(s.current(epoch));}
 now+=60000;s.touch();assert.equal(s.key,null);assert.deepEqual(revoked,['absolute']);assert.equal(s.current(epoch),false);s.touch();assert.equal(s.started,null);
 epoch=s.begin();s.token='idle';now+=120000;s.check();assert.equal(s.current(epoch),false);assert.deepEqual(revoked,['absolute','idle']);
 epoch=s.begin();s.token='clock';now-=1;s.touch();assert.equal(s.current(epoch),false);assert.equal(s.token,null);
});
test('locking invalidates a pending unlock before it has a key or token',()=>{
 let now=0;const s=new VaultSession(()=>{},{clock:()=>now});const epoch=s.begin();now=120000;s.check();assert.equal(s.current(epoch),false);assert.equal(s.started,null);
});
test('delete, approval and rejection recheck revoked sessions at the database write',async t=>{
 for(const action of ['delete','approve','reject'])await t.test(action,async()=>{
  const f=fixture();t.after(()=>f.db.close());const call=(p,m,b,token,u)=>handle(request(p,m,b,token,u),f.env,{});
  const token=(await(await call('/api/login','POST',{})).json()).token,vault=await createVault('synthetic hardening passphrase');await call('/api/setup','POST',vault.config,token);
  const r=await encryptRecord(vault.key,{vaultId:vault.config.vaultId,profileId:profiles[0],id:crypto.randomUUID(),revision:1},{title:'DEMO: Guard',category:'Custom',value:'DEMO: GUARD',expires:'',notes:'DEMO: ',location:'DEMO: '});await call('/api/records','PUT',r,token);
  const second=(await(await call('/api/login','POST',{},null,'other')).json()).token,c=await createCredential('second hardening passphrase','other');await call('/api/enroll','POST',c,second,'other');
  const state=await(await call('/api/state','GET',undefined,token)).json(),req=state.requests[0],approval=await approveMember('synthetic hardening passphrase',state,req,c.fingerprint);
  let proof;if(action==='delete'){await call('/api/approve','POST',approval,token);await enableActionKeys(call,token,second,'synthetic hardening passphrase','second hardening passphrase');proof=await proofFor(call,token,'synthetic-owner','synthetic hardening passphrase',{action:'delete',requestId:r.id,revision:1});}const original=f.env.DB.prepare;let triggered=false;
  f.env.DB.prepare=sql=>{const stmt=original(sql),bind=stmt.bind;stmt.bind=(...args)=>{const bound=bind(...args),run=bound.run;bound.run=async()=>{const target=action==='delete'?sql.startsWith('UPDATE demo_records SET deleted'):action==='approve'?sql.startsWith('UPDATE demo_members SET status'):sql.startsWith('DELETE FROM demo_members');if(target){triggered=true;f.db.prepare('DELETE FROM demo_sessions').run();}return run();};return bound;};return stmt;};
  await call(action==='delete'?'/api/records':action==='approve'?'/api/approve':'/api/reject',action==='delete'?'DELETE':'POST',action==='delete'?{id:r.id,revision:1,proof}:action==='approve'?approval:{requestId:req.requestId},token);
  assert.ok(triggered);assert.equal(f.db.prepare('SELECT deleted FROM demo_records').get().deleted,0);if(action!=='delete')assert.equal(f.db.prepare('SELECT status FROM demo_members').get().status,'pending');
 });
});
test('responses explicitly prohibit framing and cross-origin resource use',()=>{
 assert.equal(securityHeaders['X-Frame-Options'],'DENY');assert.equal(securityHeaders['Cross-Origin-Resource-Policy'],'same-origin');assert.match(securityHeaders['Content-Security-Policy'],/frame-ancestors 'none'/);
});
