"use client";
import {useEffect,useState} from 'react';
import type {RecordItem} from '../lib/domain';
import {messagingSnapshotSchema} from '../lib/friends';
import {dashboardFriendReminders,type DashboardSource} from '../lib/friend-dashboard';
export default function FriendDashboard({rows,onOpen,action,busy}:{rows:RecordItem[];onOpen:(id?:string)=>void;action:(input:unknown,message?:string)=>Promise<boolean>;busy:boolean}){
 const [sources,setSources]=useState<DashboardSource[]>([]),[now,setNow]=useState(()=>new Date());
 useEffect(()=>{let active=true;async function refresh(){try{const response=await fetch('/api/crm/status',{cache:'no-store'});if(!response.ok)throw Error();const value:unknown=await response.json();if(!Array.isArray(value))throw Error();const next:DashboardSource[]=value.flatMap(item=>{const parsed=messagingSnapshotSchema.safeParse(item?.snapshot);return item?.enabled===true&&typeof item.lastSuccess==='string'&&parsed.success?[{enabled:true,lastSuccess:item.lastSuccess,snapshot:parsed.data}]:[];});if(active){setSources(next);setNow(new Date());}}catch{if(active){setSources([]);setNow(new Date());}}}void refresh();const timer=setInterval(()=>{setNow(new Date());if(document.visibilityState==='visible')void refresh();},60000);return()=>{active=false;clearInterval(timer);};},[]);
 const items=dashboardFriendReminders(rows,sources,now);
 if(!items.length)return null;
 return <section className="card dashboard-friends" aria-label="Private friend reminders"><div className="section-head"><div><h2>Stay connected <span className="count">{items.length}</span></h2><span className="muted">Private to you</span></div><button className="text-link" onClick={()=>onOpen()}>View friends ↗</button></div>
 {items.slice(0,4).map(({friend,suggestion,note})=><article className="dashboard-friend-row" key={friend.id}><button className="row-title" onClick={()=>onOpen(friend.id)}><strong>{friend.data.name}</strong><small>{suggestion.reason}</small>{suggestion.kind==='follow-up'&&note&&<small>{note.slice(0,140)}{note.length>140?'…':''}</small>}</button><button className="button" disabled={busy} aria-label={`Snooze ${friend.data.name} for a week`} onClick={()=>action({action:'friend_suggestion',id:friend.id,version:friend.version,key:suggestion.key,disposition:'snoozed',days:7},'Snoozed for a week')}>Snooze</button></article>)}
 </section>;
}
