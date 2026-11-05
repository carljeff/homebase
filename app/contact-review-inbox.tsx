"use client";
import {useEffect,useState} from 'react';
import {normalizePersonName} from '../lib/friend-memory';
import type {RecordItem} from '../lib/domain';
type Candidate={deviceId:string;candidateId:string;version:number;status:'pending'|'approved';contactId:string|null;name:string;directOut:number;lastOutgoing:string;existingContactId:string|null};
export default function ContactReviewInbox({rows,onRefresh}:{rows:RecordItem[];onRefresh?:()=>Promise<void>}){
 const [items,setItems]=useState<Candidate[]>([]),[lastSync,setLastSync]=useState<string|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false);
 async function refresh(){const r=await fetch('/api/crm/review',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json() as {candidates:Candidate[];lastSync:string|null};if(!Array.isArray(data.candidates))throw Error();setItems(data.candidates);setLastSync(data.lastSync);}
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch('/api/crm/review',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json() as {candidates:Candidate[];lastSync:string|null};if(!Array.isArray(data.candidates))throw Error();if(active){setItems(data.candidates);setLastSync(data.lastSync);setError('');}}catch{if(active)setError('Contact review is not ready. Complete the Mini setup first.');}}void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);return()=>{active=false;clearInterval(timer);};},[]);
 async function decide(item:Candidate,choice:{action:'approve'|'ignore';contactId?:string|null;friendVersion?:number;allowDuplicate?:boolean}){setWorking(true);setError('');try{const response=await fetch('/api/crm/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:item.deviceId,candidateId:item.candidateId,version:item.version,...choice,...(choice.action==='approve'?{confirmMetadata:true}:{})})});const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error??'Could not save approval');await refresh();await onRefresh?.();}catch(e){setError(e instanceof Error?e.message:'Could not update contact review');}finally{setWorking(false);}}
 const pending=items.filter(c=>c.status==='pending').length;
 return <details className="card contact-review-inbox"><summary>New people from messages{pending?` · ${pending} to review`:''}</summary>
 <p className="muted">People in your Mac Contacts whom you sent a direct message to in the last 90 days. Incoming-only senders and group-only activity are excluded.</p>
 {error&&<p role="status">{error}</p>}
 {lastSync?<p className="muted">Last review sync: {new Date(lastSync).toLocaleString()}</p>:<p className="muted">One-time Mini update and a local dry run are required before new people can appear here.</p>}
 {!items.length&&lastSync&&<p className="muted">No new people to review.</p>}
 {items.map(item=>item.status==='approved'?<div className="contact-review-person" key={item.candidateId}><h3>{item.name}</h3><p className="muted">Approved. Waiting for the Mini to apply the private mapping and acknowledge it.</p></div>:<ReviewPerson key={item.candidateId} item={item} friends={rows.filter(r=>r.kind==='friend')} working={working} decide={choice=>decide(item,choice)}/>)}
 <button className="button" disabled={working} onClick={()=>{setError('');refresh().catch(()=>setError('Could not refresh contact review'));}}>Refresh new people</button>
 </details>;
}
function ReviewPerson({item,friends,working,decide}:{item:Candidate;friends:RecordItem[];working:boolean;decide:(choice:{action:'approve'|'ignore';contactId?:string|null;friendVersion?:number;allowDuplicate?:boolean})=>Promise<void>}){
 const possible=friends.filter(f=>normalizePersonName(f.data.name)===normalizePersonName(item.name));
 const [target,setTarget]=useState(item.existingContactId??(possible.length===1?possible[0].id:'')),[different,setDifferent]=useState(false);
 const selected=friends.find(f=>f.id===target);
 return <article className="contact-review-person"><h3>{item.name}</h3><p className="muted">{item.directOut} outgoing direct {item.directOut===1?'message':'messages'} · last {new Date(item.lastOutgoing).toLocaleDateString()}</p>
 <label className="field">Add or link<select value={target} disabled={working||!!item.existingContactId} onChange={e=>{setTarget(e.target.value);setDifferent(false);}}><option value="">Create a new friend</option>{friends.map(friend=><option key={friend.id} value={friend.id}>{friend.data.name}</option>)}</select></label>
 {!target&&possible.length>0&&<label className="subtask"><input type="checkbox" checked={different} onChange={e=>setDifferent(e.target.checked)}/>This is a different person with the same name</label>}
 <div className="button-row"><button className="button primary" disabled={working||!target&&possible.length>0&&!different} onClick={()=>decide({action:'approve',contactId:target||null,friendVersion:selected?.version,allowDuplicate:different})}>{target?'Link & enable messaging':'Add & track messaging'}</button><button className="button" disabled={working} onClick={()=>decide({action:'ignore'})}>Ignore</button></div>
 </article>;
}
