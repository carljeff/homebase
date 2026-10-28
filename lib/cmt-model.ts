import { z } from "zod";
export const cmtSourceSchema=z.object({
 provider:z.literal("copymethat"),importKey:z.string().min(1).max(2000),identityQuality:z.enum(["provider-id","source-url","source-url-title","title-fallback"]),
 title:z.string().min(1).max(1000),description:z.string().max(50000),sourceUrl:z.string().max(4000),
 ingredients:z.array(z.string().max(10000)).max(1000),ingredientSections:z.array(z.object({text:z.string().max(10000),kind:z.string().max(80)})).max(1200),
 instructions:z.string().max(150000),instructionSections:z.array(z.object({text:z.string().max(20000),kind:z.string().max(80)})).max(1200),
 servingsText:z.string().max(2000),timesText:z.string().max(10000),tags:z.array(z.string().max(1000)).max(200),sourceNotes:z.string().max(50000),
 extraText:z.string().max(20000),rawHtml:z.string().max(400000),imageHash:z.string().regex(/^[a-f0-9]{64}$/).nullable(),imageType:z.enum(["image/jpeg","image/png","image/gif","image/webp"]).nullable()
});
export type CmtSource=z.infer<typeof cmtSourceSchema>;
export function canonical(value:any):string{if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";return JSON.stringify(value);}
export async function sha256(value:string|Uint8Array){const bytes=typeof value==="string"?new TextEncoder().encode(value):value;const hash=await crypto.subtle.digest("SHA-256",bytes as BufferSource);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");}
export function safeUrl(value:string){try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.href:"";}catch{return "";}}
export function imageType(bytes:Uint8Array):CmtSource["imageType"]{if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";if(bytes.slice(0,8).join(",")==="137,80,78,71,13,10,26,10")return "image/png";const s=new TextDecoder().decode(bytes.slice(0,12));if(s.startsWith("GIF87a")||s.startsWith("GIF89a"))return "image/gif";if(s.startsWith("RIFF")&&s.slice(8)==="WEBP")return "image/webp";return null;}
export function importedBase(source:CmtSource){
 const servingMatch=source.servingsText.match(/(?:servings?|serves?|yield)?\s*:?\s*(\d+(?:\.\d+)?)/i);const n=servingMatch?Number(servingMatch[1]):0;
 const time=source.timesText.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)/ig);const minutes=time?.reduce((sum,t)=>sum+parseFloat(t)*( /hour|hr/i.test(t)?60:1),0)??0;
 return {title:source.title,description:source.description,servings:n>0&&n<=100?n:4,servingsText:source.servingsText,servingsEstimated:!(n>0&&n<=100),minutes:Math.min(minutes,2880),timesText:source.timesText,
 ingredients:source.ingredients.map(raw=>parseIngredient(raw)),instructions:source.instructions,tags:source.tags,sourceNotes:source.sourceNotes,sourceUrl:safeUrl(source.sourceUrl),notes:"",likes:[],favorite:false,revisions:[],imageHash:source.imageHash};
}
const fractions:Record<string,number>={"¼":.25,"½":.5,"¾":.75,"⅓":1/3,"⅔":2/3,"⅛":.125,"⅜":.375,"⅝":.625,"⅞":.875};
export function parseIngredient(raw:string){
 const normalized=raw.replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g,"$1 $2");const m=normalized.match(/^\s*((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?(?:\s+[¼½¾⅓⅔⅛⅜⅝⅞])?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(.*)$/);
 if(!m||/^\s*[-–]/.test(m[2]))return {name:raw,quantity:1,unit:"",category:"Other",raw,quantityKnown:false};
 const quantity=m[1].trim().split(/\s+/).reduce((s,t)=>s+(fractions[t]??(t.includes("/")?Number(t.split("/")[0])/Number(t.split("/")[1]):Number(t))),0);
 const u=m[2].match(/^(cups?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|cans?|packages?|cloves?|heads?|bunches?)\b\.?\s*(.*)$/i);
 return {name:(u?u[2]:m[2]).trim()||raw,quantity:Number.isFinite(quantity)?quantity:1,unit:u?u[1]:"",category:"Other",raw,quantityKnown:Number.isFinite(quantity)};
}
export function effective(source:CmtSource,overrides:Record<string,any>){return {...importedBase(source),...overrides,...(overrides.servings!==undefined?{servingsEstimated:false,servingsText:overrides.servings+" servings (household)"}:{}),...(overrides.minutes!==undefined?{timesText:overrides.minutes+" minutes (household)"}:{}),imported:true,customizedFields:Object.keys(overrides),importKey:source.importKey,identityQuality:source.identityQuality,importSource:{...source,rawHtml:undefined}};}
export function householdOverrides(source:CmtSource,edited:Record<string,any>,previous:Record<string,any>={}){
 const base=importedBase(source),next:Record<string,any>={};
 for(const key of Object.keys(base)){if(["imageHash","sourceUrl","sourceNotes","servingsText","timesText","servingsEstimated","revisions"].includes(key))continue;const val=edited[key]??(base as any)[key];if(canonical(val)!==canonical((base as any)[key]))next[key]=val;}
 if(previous.revisions)next.revisions=previous.revisions;return next;
}
export function conflicts(oldSource:CmtSource,newSource:CmtSource,overrides:Record<string,any>){const old=importedBase(oldSource),next=importedBase(newSource);return Object.keys(overrides).filter(k=>k in next&&!["notes","favorite","likes","revisions"].includes(k)&&canonical((old as any)[k])!==canonical((next as any)[k]));}
