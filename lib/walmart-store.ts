import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {walmartProductSchema} from './walmart-catalog';
import {preferenceKey} from './walmart';
export async function saveWalmartProduct(input:{data:unknown;id?:string;version?:number},user:string){
 const data=walmartProductSchema.parse(input.data);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(preferenceKey(data.itemName)));
 const id='walmart-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 if(input.id&&input.id!==id)throw Error('Keep the grocery name unchanged when editing its saved product');
 if(!env.DB)throw Error('Database unavailable');const now=new Date().toISOString();
 if(input.id){const version=z.number().int().positive().parse(input.version);const result=await env.DB.prepare('UPDATE records SET data=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND kind=? AND version=?').bind(JSON.stringify(data),now,user,id,'walmart_product',version).run();if(!result.meta.changes)throw Error('Conflict: refresh before editing this saved product again');return {id,kind:'walmart_product',data,version:version+1,updatedAt:now};}
 const result=await env.DB.prepare('INSERT INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,?,?,1,?,?) ON CONFLICT(id) DO NOTHING').bind(id,'walmart_product',JSON.stringify(data),now,user).run();
 if(!result.meta.changes)throw Error('Conflict: a product is already saved for this grocery; refresh before editing');return {id,kind:'walmart_product',data,version:1,updatedAt:now};
}
