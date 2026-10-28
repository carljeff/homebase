import {env} from 'cloudflare:workers';
import {familySchema,giftForSave,canReadGift} from './family';
import {list,save} from './store';
import {z} from 'zod';
export async function familySave(kind:string,data:any,user:string,id?:string,version?:number){
 const rows=await list();const prior=id?rows.find(r=>r.id===id&&r.kind===kind):undefined;
 if(id&&!prior)throw new Error('Record unavailable');
 if(kind==='wishlist'){
  const parsed=giftForSave(data,user,prior?.data);
  if(!rows.some(r=>r.kind==='family'&&r.id===parsed.profileId))throw new Error('Choose an existing family profile');
  if(prior&&prior.data.profileId!==parsed.profileId)throw new Error('Gift recipient cannot be changed');
  return save('wishlist',parsed,user,id,version);
 }
 const parsed=familySchema.parse(data);
 if(rows.some(r=>r.kind==='family'&&r.id!==id&&r.data.name.trim().toLowerCase()===parsed.name.toLowerCase()))throw new Error('A profile with that name already exists');
 if(id)return save('family',parsed,user,id,version);
 // A name-derived ID makes repeated initializations/concurrent creates idempotent.
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('family:'+parsed.name.toLowerCase())))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const profileId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32),now=new Date().toISOString();
 const result=await env.DB!.prepare('INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,?,?,1,?,?)').bind(profileId,'family',JSON.stringify(parsed),now,user).run();
 if(!result.meta.changes)throw new Error('A profile with that name already exists');
 return {id:profileId,kind:'family',data:parsed,version:1,updatedAt:now};
}
export function assertFamilyDelete(row:any,user:string){if(row?.kind==='family')throw new Error('Profiles are retained to preserve linked wishlists. Edit the profile instead.');if(row?.kind==='wishlist'&&!canReadGift(row.data,user))throw new Error('Record unavailable');}
export async function ensureProfiles(input:any,user:string){const profiles=z.array(familySchema).min(1).max(20).parse(input.profiles);const added=[];for(const profile of profiles){const rows=await list();const found=rows.find(r=>r.kind==='family'&&r.data.name.trim().toLowerCase()===profile.name.toLowerCase());if(found){added.push({id:found.id,name:found.data.name,existing:true});continue;}const r=await familySave('family',profile,user);added.push({id:r.id,name:profile.name,existing:false});}return {profiles:added};}
