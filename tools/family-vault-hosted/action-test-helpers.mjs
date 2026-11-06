import assert from 'node:assert/strict';
import {createCredential,approveMember,answerChallenge} from './vault/sharing.mjs';
export async function enableActionKeys(call,owner,other,password,otherPassword){
 let state=await(await call('/api/state','GET',undefined,owner)).json();
 if(!state.shared){const credential=await createCredential(otherPassword,'other');assert.equal((await call('/api/enroll','POST',credential,other,'other')).status,201);state=await(await call('/api/state','GET',undefined,owner)).json();const p=await approveMember(password,state,state.requests[0],credential.fingerprint);assert.equal((await call('/api/approve','POST',p,owner)).status,200);}
 const credential=await createCredential(password,'synthetic-owner');assert.equal((await call('/api/enroll','POST',credential,owner)).status,201);const second=await(await call('/api/state','GET',undefined,other,'other')).json();const req=second.requests.find(r=>r.credential.memberId==='synthetic-owner');const approval=await approveMember(otherPassword,second,req,credential.fingerprint);assert.equal((await call('/api/approve','POST',approval,other,'other')).status,200);
}
export async function proofFor(call,token,user,password,action,at){
 const state=await(await call('/api/state','GET',undefined,token,user,at)).json();
 const response=await call('/api/action-challenge','POST',action,token,user,at);assert.equal(response.status,200);return answerChallenge(password,state.actionCredential,await response.json());
}
