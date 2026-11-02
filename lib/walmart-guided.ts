import {z} from 'zod';
import {productUrl} from './walmart';
export function nameFromProductLink(value:string):string|null{
 if(!productUrl(value))return null;
 try{const parts=new URL(value).pathname.split('/').filter(Boolean);if(parts.length!==3)return null;const name=decodeURIComponent(parts[1]).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();return name.length>=3&&name.length<=1000&&!/^\d+$/.test(name)?name:null;}catch{return null;}
}
const draftSchema=z.object({listKey:z.string().max(100000),preparedKey:z.string().max(150000),selected:z.record(z.boolean()),quantities:z.record(z.number().int().min(1).max(99))});
export type ShoppingDraft=z.infer<typeof draftSchema>;
export const SHOPPING_DRAFT_KEY='homebase:walmart:shopping-draft:v2';
export function readShoppingDraft(raw:string|null):ShoppingDraft|null{try{return draftSchema.parse(JSON.parse(raw||'null'));}catch{return null;}}
const progressSchema=z.object({key:z.string().max(200000),index:z.number().int().nonnegative(),reviewed:z.array(z.string()).max(500),skipped:z.array(z.string()).max(500)});
export type GuidedProgress=z.infer<typeof progressSchema>;
export const GUIDED_PROGRESS_KEY='homebase:walmart:guided-progress:v1';
export function readGuidedProgress(raw:string|null,key:string,urls:string[]):GuidedProgress{
 const fresh={key,index:0,reviewed:[],skipped:[]};try{const p=progressSchema.parse(JSON.parse(raw||'null'));if(p.key!==key)return fresh;return {...p,index:Math.min(p.index,urls.length),reviewed:p.reviewed.filter(u=>urls.includes(u)),skipped:p.skipped.filter(u=>urls.includes(u)&&!p.reviewed.includes(u))};}catch{return fresh;}
}
export function advanceGuided(p:GuidedProgress,url:string,status:'reviewed'|'skipped',count:number):GuidedProgress{
 return {...p,index:Math.min(p.index+1,count),reviewed:status==='reviewed'?[...new Set([...p.reviewed,url])]:p.reviewed.filter(u=>u!==url),skipped:status==='skipped'?[...new Set([...p.skipped,url])]:p.skipped.filter(u=>u!==url)};
}
