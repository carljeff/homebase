import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {assertFriendsOwner} from './friends-access';
import {friendSchema,type FriendData} from './friends';
import {calendarDate,householdToday,matchesPerson,possibleDuplicate} from './friend-memory';
import {save,list} from './store';
const idSchema=z.string().uuid(),versionSchema=z.number().int().positive();
const editable=friendSchema.omit({createdAt:true,relationshipNotes:true,suggestionState:true}).partial().strict();
const quickSchema=friendSchema.pick({name:true,meetingPlace:true,metOn:true,howWeMet:true,notes:true,phone:true,email:true,tags:true}).strict();
export async function friendRecord(id:string,user:string){
 await assertFriendsOwner(user);
 const row=await env.DB!.prepare("SELECT * FROM records WHERE id=? AND kind='friend'").bind(idSchema.parse(id)).first<{id:string;data:string;version:number;updated_at:string}>();
 if(!row)throw new Error('Contact not found');
 return {id:row.id,kind:'friend' as const,data:JSON.parse(row.data) as FriendData,version:row.version,updatedAt:row.updated_at};
}
async function duplicateCheck(data:FriendData,user:string,allowDuplicate=false){
 if(!allowDuplicate&&(await list(user)).some(r=>r.kind==='friend'&&possibleDuplicate(data,r.data)))throw new Error('Possible duplicate: search existing contacts first, or explicitly confirm a different person.');
}
export async function saveFriend(input:{id?:string;version?:number;data:unknown;allowDuplicate?:boolean},user:string,now=new Date()){
 await assertFriendsOwner(user);
 const prior=input.id?await friendRecord(input.id,user):null;
 if(prior&&input.version!==prior.version)throw new Error('Conflict: refresh before editing again');
 const raw=z.record(z.unknown()).parse(input.data);
 // Existing callers can continue sending a full record. Omitted fields survive edits.
 if(prior){for(const field of ['relationshipNotes','suggestionState'] as const)if(raw[field]!==undefined&&JSON.stringify(raw[field])!==JSON.stringify(prior.data[field]??[]))throw new Error('Use the explicit dated-note or suggestion action.');}
 else if((Array.isArray(raw.relationshipNotes)&&raw.relationshipNotes.length)||(Array.isArray(raw.suggestionState)&&raw.suggestionState.length))throw new Error('Create the contact first, then add dated notes.');
 const data=friendSchema.parse({...prior?.data,...raw,createdAt:prior?prior.data.createdAt??null:now.toISOString(),relationshipNotes:prior?.data.relationshipNotes??[],suggestionState:prior?.data.suggestionState??[]});
 if(data.lastInPerson&&data.lastInPerson>householdToday(now)||data.manualLastContact&&data.manualLastContact>householdToday(now))throw new Error('An interaction cannot be in the future');
 if(!prior)await duplicateCheck(data,user,z.boolean().parse(input.allowDuplicate??false));
 return save('friend',data,user,input.id,input.version);
}
export async function friendOperation(input:Record<string,unknown>,user:string,now=new Date()){
 await assertFriendsOwner(user);const action=z.string().parse(input.action),today=householdToday(now);
 if(action==='friend_search'){
  const query=z.string().max(500).parse(input.query??'');
  return (await list(user)).filter(r=>r.kind==='friend'&&matchesPerson(r.data,query));
 }
 if(action==='friend_quick_add'){
  const id=idSchema.parse(input.requestId),data=quickSchema.parse(input.data),raw=z.record(z.unknown()).parse(input.data);
  const normalized=friendSchema.parse({...data,metOn:Object.hasOwn(raw,'metOn')?data.metOn:today,createdAt:now.toISOString()});
  const already=await env.DB!.prepare('SELECT kind FROM records WHERE id=?').bind(id).first<{kind:string}>();
  if(already){if(already.kind!=='friend')throw new Error('Conflict: capture ID is already in use');const existing=await friendRecord(id,user);if(Object.keys(data).filter(k=>k!=='metOn'||Object.hasOwn(raw,'metOn')).some(k=>JSON.stringify(existing.data[k as keyof FriendData])!==JSON.stringify(normalized[k as keyof FriendData])))throw new Error('Conflict: this capture was already saved; refresh and review it');return existing;}
  await duplicateCheck(normalized,user,z.boolean().parse(input.allowDuplicate??false));
  await env.DB!.prepare("INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,'friend',?,1,?,?)").bind(id,JSON.stringify(normalized),now.toISOString(),user).run();
  const saved=await friendRecord(id,user);if(Object.keys(data).filter(k=>k!=='metOn'||Object.hasOwn(raw,'metOn')).some(k=>JSON.stringify(saved.data[k as keyof FriendData])!==JSON.stringify(normalized[k as keyof FriendData])))throw new Error('Conflict: capture ID is already in use');return saved;
 }
 const row=await friendRecord(idSchema.parse(input.id),user),version=versionSchema.parse(input.version);
 const data=friendSchema.parse(row.data);
 const persist=(next:FriendData)=>save('friend',next,user,row.id,version);
 if(action==='friend_update'){
  const patch=editable.parse(input.patch);if(patch.lastInPerson&&patch.lastInPerson>today||patch.manualLastContact&&patch.manualLastContact>today)throw new Error('An interaction cannot be in the future');
  return persist({...data,...patch});
 }
 if(action==='friend_saw_today')return persist({...data,lastInPerson:today});
 if(action==='friend_note_save'){
  const note=z.object({id:idSchema,text:z.string().trim().min(1).max(4000),date:calendarDate}).strict().parse(input.note);
  const previous=data.relationshipNotes.find(n=>n.id===note.id);
  if(input.edit===true&&!previous)throw new Error('Note not found');
  if(previous&&previous.text===note.text&&previous.date===note.date)return row;
  if(previous&&input.edit!==true)throw new Error('Conflict: this note already exists; edit it explicitly');
  const saved={...note,createdAt:previous?.createdAt??now.toISOString(),updatedAt:now.toISOString()};
  return persist({...data,relationshipNotes:[...data.relationshipNotes.filter(n=>n.id!==note.id),saved]});
 }
 if(action==='friend_note_delete'){
  const id=idSchema.parse(input.noteId);if(!data.relationshipNotes.some(n=>n.id===id))return row;
  return persist({...data,relationshipNotes:data.relationshipNotes.filter(n=>n.id!==id)});
 }
 if(action==='friend_suggestion'){
  const key=z.string().min(1).max(240).parse(input.key),disposition=z.enum(['dismissed','snoozed']).parse(input.disposition);
  const days=z.union([z.literal(7),z.literal(30)]).parse(input.days??7);
  const until=disposition==='snoozed'?new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10):null;
  return persist({...data,suggestionState:[...data.suggestionState.filter(s=>s.key!==key&&(s.disposition==='dismissed'||!!s.until&&s.until>today)),{key,disposition,until,updatedAt:now.toISOString()}]});
 }
 throw new Error('Unsupported Friends action');
}
