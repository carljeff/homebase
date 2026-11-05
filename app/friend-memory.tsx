"use client";
import {useState} from 'react';
import {friendSchema,type FriendData,type ContactMessaging} from '../lib/friends';
import {householdToday,possibleDuplicate,connectedSinceMeeting,upcomingDates,type ReconnectSuggestion} from '../lib/friend-memory';
import type {RecordItem} from '../lib/domain';
type Action=(input:unknown,message?:string)=>Promise<boolean>;
export function QuickAddPerson({rows,action,busy,onClose,onExisting}:{rows:RecordItem[];action:Action;busy:boolean;onClose:()=>void;onExisting:(friend:RecordItem)=>void}){
 const [requestId]=useState(()=>crypto.randomUUID());
 const [data,setData]=useState({name:'',meetingPlace:'',metOn:householdToday() as string|null,howWeMet:'',notes:'',phone:'',email:'',tags:[] as string[]});
 const [allowDuplicate,setAllowDuplicate]=useState(false);
 const duplicates=data.name.trim()?rows.filter(r=>r.kind==='friend'&&possibleDuplicate(data,r.data)):[];
 function field(key:'meetingPlace'|'howWeMet'|'notes'|'phone'|'email',label:string,type='text'){return <label className="field">{label}<input type={type} maxLength={key==='phone'?40:key==='email'?254:1000} value={data[key]} onInput={e=>{setData({...data,[key]:e.currentTarget.value});setAllowDuplicate(false);}}/></label>;}
 return <form className="card family-form friend-quick-add" aria-label="Quick add person" onSubmit={async e=>{e.preventDefault();if(await action({action:'friend_quick_add',requestId,data,allowDuplicate},'Person added'))onClose();}}>
 <h3>Add someone</h3><label className="field">Name<input autoFocus required maxLength={100} value={data.name} onInput={e=>{setData({...data,name:e.currentTarget.value});setAllowDuplicate(false);}}/></label>
 {duplicates.length>0&&<div className="friend-duplicates" role="status"><p>A possible match already exists.</p>{duplicates.slice(0,5).map(friend=><button type="button" className="button" key={friend.id} onClick={()=>onExisting(friend)}>Open {friend.data.name}</button>)}<label className="subtask"><input type="checkbox" checked={allowDuplicate} onChange={e=>setAllowDuplicate(e.target.checked)}/>This is a different person</label></div>}
 <details><summary>Meeting details (optional)</summary><div className="friend-field-grid">{field('meetingPlace','Where we met')}<label className="field">When we met<input type="date" value={data.metOn??''} onChange={e=>setData({...data,metOn:e.target.value||null})}/></label>{field('howWeMet','How we met / introduced by')}{field('notes','A quick memory')}{field('phone','Phone','tel')}{field('email','Email','email')}<TagsInput value={data.tags} onChange={tags=>setData({...data,tags})}/></div><p className="muted">Contact details stay in your private Homebase records. Mac matching is managed separately.</p></details>
 <div className="button-row"><button className="button primary" disabled={busy||duplicates.length>0&&!allowDuplicate}>Add person</button><button type="button" className="button" onClick={onClose}>Cancel</button></div></form>;
}
export function RelationshipFields({data,onChange}:{data:FriendData;onChange:(data:FriendData)=>void}){
 const field=(key:'meetingPlace'|'howWeMet'|'mutualConnections'|'interests'|'occupation'|'children'|'commonGround'|'phone'|'email',label:string)=><label className="field">{label}<input maxLength={key==='phone'?40:key==='email'?254:1000} type={key==='email'?'email':key==='phone'?'tel':'text'} value={data[key]} onChange={e=>onChange({...data,[key]:e.target.value})}/></label>;
 const date=(key:'metOn'|'lastInPerson'|'manualLastContact'|'followUpOn',label:string)=><label className="field">{label}<input type="date" value={data[key]??''} max={key==='lastInPerson'||key==='manualLastContact'?householdToday():undefined} onChange={e=>onChange({...data,[key]:e.target.value||null})}/></label>;
 return <details className="friend-context-editor"><summary>Relationship & personal details</summary><div className="friend-field-grid">
 {field('meetingPlace','Where we met')}{date('metOn','When we met')}{field('howWeMet','How we know each other')}{field('mutualConnections','Mutual connections')}
 <TagsInput value={data.tags} onChange={tags=>onChange({...data,tags})}/>
 {field('interests','Interests & hobbies')}{field('occupation','Occupation / background')}{field('children','Children & relevant details')}{field('commonGround','Things in common')}{field('phone','Phone')}{field('email','Email')}
 {date('lastInPerson','Last seen in person')}{date('manualLastContact','Last other personal interaction')}{date('followUpOn','Follow up on (optional)')}
 </div><label className="subtask"><input type="checkbox" checked={data.stayConnected} onChange={e=>onChange({...data,stayConnected:e.target.checked})}/>Include in Stay Connected suggestions</label>
 <details><summary>Important dates</summary>{data.importantDates.map((event,index)=><div className="friend-date-editor" key={event.id}><label className="field">Occasion<input required maxLength={100} value={event.label} onChange={e=>onChange({...data,importantDates:data.importantDates.map((d,i)=>i===index?{...d,label:e.target.value}:d)})}/></label><label className="field">Date<input required type="date" value={event.date} onChange={e=>onChange({...data,importantDates:data.importantDates.map((d,i)=>i===index?{...d,date:e.target.value}:d)})}/></label><label className="subtask"><input type="checkbox" checked={event.annual} onChange={e=>onChange({...data,importantDates:data.importantDates.map((d,i)=>i===index?{...d,annual:e.target.checked}:d)})}/>Every year</label><button className="button" type="button" onClick={()=>onChange({...data,importantDates:data.importantDates.filter((_,i)=>i!==index)})}>Remove date</button></div>)}<button type="button" className="button" disabled={data.importantDates.length>=30} onClick={()=>onChange({...data,importantDates:[...data.importantDates,{id:crypto.randomUUID(),label:'',date:householdToday(),annual:false}]})}>Add important date</button></details>
 </details>;
}
export function MemoryDetails({friend,action,busy,now}:{friend:RecordItem;action:Action;busy:boolean;now:Date}){
 const data=friendSchema.parse(friend.data);
 const [editing,setEditing]=useState<{id:string;date:string;text:string;edit:boolean}|null>(null);
 const [query,setQuery]=useState('');
 const notes=[...data.relationshipNotes].filter(n=>n.text.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
 const entries=[['Where we met',data.meetingPlace],['When we met',data.metOn],['How we know each other',data.howWeMet],['Mutual connections',data.mutualConnections],['Tags',data.tags.join(', ')],['Interests',data.interests],['Occupation',data.occupation],['Children',data.children],['In common',data.commonGround],['Phone',data.phone],['Email',data.email],['Last seen in person',data.lastInPerson],['Last other interaction',data.manualLastContact],['Follow up on',data.followUpOn]].filter(([,value])=>!!value);
 return <>
 <section className="friend-memory-details">
 {entries.length>0&&<dl className="friend-context-list">{entries.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
 <button className="button" disabled={busy} onClick={()=>action({action:'friend_saw_today',id:friend.id,version:friend.version},'In-person date saved')}>Saw them today</button>
 {data.importantDates.length>0&&<details><summary>Important dates</summary>{data.importantDates.map(event=><p key={event.id}>{event.label} · {event.date}{event.annual?' · yearly':''}</p>)}</details>}
 <div className="friend-notes-heading"><h4>Conversation notes</h4><button className="button" disabled={busy} onClick={()=>setEditing({id:crypto.randomUUID(),date:householdToday(now),text:'',edit:false})}>Add note</button></div>
 {editing&&<form className="friend-note-form" aria-label="Relationship note" onSubmit={async e=>{e.preventDefault();if(await action({action:'friend_note_save',id:friend.id,version:friend.version,note:{id:editing.id,date:editing.date,text:editing.text},edit:editing.edit},'Note saved'))setEditing(null);}}><label className="field">Note date<input required type="date" value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})}/></label><label className="field">Memory or next conversation topic<textarea autoFocus required maxLength={4000} rows={3} value={editing.text} onInput={e=>setEditing({...editing,text:e.currentTarget.value})}/></label><div className="button-row"><button className="button primary" disabled={busy}>Save note</button><button type="button" className="button" onClick={()=>setEditing(null)}>Cancel</button></div></form>}
 {data.relationshipNotes.length>3&&<label className="field">Search this person’s notes<input type="search" value={query} onInput={e=>setQuery(e.currentTarget.value)}/></label>}
 {notes.map(note=><article className="friend-note" key={note.id}><time dateTime={note.date}>{note.date}</time><p className="preline">{note.text}</p><details><summary>Note options</summary><p className="muted">Created {new Date(note.createdAt).toLocaleString()} · updated {new Date(note.updatedAt).toLocaleString()}</p><div className="button-row"><button className="button" disabled={busy} onClick={()=>setEditing({...note,edit:true})}>Edit note</button><button className="button" disabled={busy} onClick={()=>{if(confirm('Delete this relationship note?'))void action({action:'friend_note_delete',id:friend.id,version:friend.version,noteId:note.id},'Note deleted');}}>Delete note</button></div></details></article>)}
 {!data.relationshipNotes.length&&<p className="muted">A detail to remember, or something to ask about next time.</p>}
 </section></>;
}
export function ConnectionSuggestions({items,action,busy,onOpen}:{items:{friend:RecordItem;suggestion:ReconnectSuggestion}[];action:Action;busy:boolean;onOpen:(friend:RecordItem)=>void}){
 return <div className="friend-suggestions">{items.length?items.slice(0,3).map(({friend,suggestion})=><article className="card" key={friend.id+suggestion.key}><h3>{friend.data.name}</h3><p>{suggestion.reason}</p><div className="button-row"><button className="button" onClick={()=>onOpen(friend)}>View person</button><button className="button" disabled={busy} onClick={()=>action({action:'friend_suggestion',id:friend.id,version:friend.version,key:suggestion.key,disposition:'snoozed',days:7},'Snoozed for a week')}>Snooze a week</button><button className="button" disabled={busy} onClick={()=>action({action:'friend_suggestion',id:friend.id,version:friend.version,key:suggestion.key,disposition:'dismissed'},'Suggestion dismissed')}>Dismiss</button></div></article>):<p className="muted">Nothing to follow up on right now. Enable suggestions or set a reminder interval in a person’s details.</p>}</div>;
}

function TagsInput({value,onChange}:{value:string[];onChange:(tags:string[])=>void}){
 const [text,setText]=useState(value.join(', '));return <label className="field">Category or tags<input maxLength={500} value={text} onInput={e=>{setText(e.currentTarget.value);onChange([...new Set(e.currentTarget.value.split(',').map(t=>t.trim()).filter(Boolean))]);}}/></label>;
}
export function PersonViewPreview({friend,activity,recent,dates,now}:{friend:RecordItem;activity?:ContactMessaging;recent:boolean;dates:boolean;now:Date}){
 const data=friendSchema.parse(friend.data);return <> {recent&&<div className="friend-meeting-preview">{data.meetingPlace&&<p>{data.meetingPlace}</p>}{data.metOn&&<p>Met {data.metOn}</p>}{(data.notes||data.relationshipNotes.at(-1)?.text)&&<p>{(data.notes||data.relationshipNotes.at(-1)!.text).slice(0,140)}</p>}<small>{connectedSinceMeeting(data,activity)?'Later direct or in-person contact recorded':'No later personal contact recorded'}</small></div>}
 {dates&&<div className="friend-date-preview">{upcomingDates(data,now).map(event=><p key={event.key}>{event.label} · {event.date}</p>)}</div>}
</>;
}
