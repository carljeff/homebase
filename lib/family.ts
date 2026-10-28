import {z} from 'zod';
const text=z.string().trim().max(2000).default('');
export const familyDay=z.string().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'Use a valid date').default('');
export const safeLink=z.string().max(2000).refine(v=>{if(!v)return true;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}},'Use an https link').default('');
export const familySchema=z.object({name:z.string().trim().min(1).max(100),role:z.enum(['parent','child','other']),avatar:z.string().max(16).default(''),birthday:familyDay,interests:text,favorites:text,clothingSizes:text,shoeSize:text,notes:z.string().max(20000).default(''),amazonWishlistUrl:safeLink,dates:z.array(z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(200),date:familyDay.refine(Boolean,'Choose a date'),annual:z.boolean().default(false),reminder:familyDay,notes:text})).max(100).default([])});
export const wishlistSchema=z.object({profileId:z.string().uuid(),title:z.string().trim().min(1).max(300),url:safeLink,notes:z.string().max(10000).default(''),priority:z.enum(['low','medium','high']).default('medium'),purchased:z.boolean().default(false),surprise:z.boolean().default(true),creatorId:z.string().min(1).max(300),source:z.enum(['manual','amazon']).default('manual'),externalId:z.string().max(300).default('')});
// Surprise gifts are author-only, including before purchase. Never trust a client-supplied author.
export function canReadGift(data:any,user:string){return data.surprise===false||data.creatorId===user;}
export function visibleFamilyRows<T extends {kind:string;data:any}>(rows:T[],user:string){return rows.filter(r=>r.kind!=='wishlist'||canReadGift(r.data,user));}
export function giftForSave(data:any,user:string,prior?:any){if(prior&&!canReadGift(prior,user))throw new Error('Record unavailable');return wishlistSchema.parse({...data,creatorId:prior?.creatorId??user});}
export function familyUpcoming(rows:any[],today:string){
 const results:any[]=[];const year=Number(today.slice(0,4));
 function next(date:string,annual:boolean){if(!annual)return date;for(let y=year;y<=year+4;y++){const d=y+date.slice(4);if(d>=today&&familyDay.safeParse(d).success)return d;}return '';}
 for(const r of rows.filter(r=>r.kind==='family')){
  if(r.data.birthday){const date=next(r.data.birthday,true);if(date)results.push({id:r.id+'-birthday',profileId:r.id,title:r.data.name+' · Birthday',date});}
  for(const d of r.data.dates??[]){const date=next(d.date,d.annual);if(date>=today)results.push({id:d.id,profileId:r.id,title:r.data.name+' · '+d.title,date,reminder:d.reminder&&d.annual?new Date(Date.parse(d.reminder+'T12:00:00Z')+Date.parse(date+'T12:00:00Z')-Date.parse(d.date+'T12:00:00Z')).toISOString().slice(0,10):d.reminder});}
 }
 return results.filter(r=>r.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
}
