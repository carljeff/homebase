export type Grocery={id:string;data:{name:string;quantity:number;unit?:string;checked?:boolean;pantry?:boolean;quantityKnown?:boolean}};
export type Preference={url:string;brand:string;size:string;alternative:string;maxPrice:string;allowSubstitutions:boolean};
export const preferenceKey=(name:string)=>name.trim().toLowerCase().replace(/\s+/g,' ');
export const emptyPreference=():Preference=>({url:'',brand:'',size:'',alternative:'',maxPrice:'',allowSubstitutions:false});
export function productUrl(value:string):string|null {
 try {const u=new URL(value);if(u.protocol!=='https:'||!['walmart.com','www.walmart.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/ip\/(?:[^/]+\/)?\d+\/?$/.test(u.pathname))return null;return 'https://www.walmart.com/ip/'+u.pathname.replace(/\/$/,'').split('/').pop();}catch{return null;}
}
export const searchUrl=(name:string)=>'https://www.walmart.com/search?q='+encodeURIComponent(name);
export function readPreferences(raw:string|null):Record<string,Preference>{
 try {const parsed:unknown=JSON.parse(raw||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};const result:Record<string,Preference>=Object.create(null);for(const [key,value] of Object.entries(parsed)){if(!value||typeof value!=='object'||Array.isArray(value))continue;const p=value as Record<string,unknown>;const entry=emptyPreference();for(const field of ['url','brand','size','alternative','maxPrice'] as const)entry[field]=typeof p[field]==='string'?p[field]:'';entry.allowSubstitutions=p.allowSubstitutions===true;result[preferenceKey(key)]=entry;}return result;}catch{return {};}
}
export const selectedGroceries=(rows:Grocery[],selected:Record<string,boolean>)=>rows.filter(g=>!g.data.checked&&!g.data.pantry&&selected[g.id]!==false);
export const validPackages=(q:number)=>Number.isInteger(q)&&q>=1&&q<=99;
export function prepareHandoff(rows:Grocery[],selected:Record<string,boolean>,quantities:Record<string,number>,prefs:Record<string,Preference>){
 const seen=new Set<string>();return {version:1,mode:'mock-only',items:selectedGroceries(rows,selected).map(g=>{const p=prefs[preferenceKey(g.data.name)],url=productUrl(p?.url||''),quantity=quantities[g.id];if(!url)throw Error('Save an exact product URL for '+g.data.name);if(!validPackages(quantity))throw Error('Review package count (1–99) for '+g.data.name);if(seen.has(url))throw Error('Duplicate product: combine package counts before exporting');seen.add(url);return {id:g.id,name:g.data.name,url,quantity,allowSubstitutions:p?.allowSubstitutions===true};})};
}
