import {z} from 'zod';
import {productUrl,preferenceKey,selectedGroceries,validPackages,type Grocery} from './walmart.ts';
const productLink=z.string().max(2000).refine(v=>productUrl(v)!==null,'Use an exact HTTPS Walmart product link').transform(v=>productUrl(v)!);
export const walmartProductSchema=z.object({
 itemName:z.string().trim().min(1).max(1000),productName:z.string().trim().min(1).max(1000),url:productLink,
 brand:z.string().max(200).default(''),size:z.string().max(200).default(''),defaultPackages:z.number().int().min(1).max(99).default(1),
 alternativeName:z.string().max(1000).default(''),alternativeUrl:z.union([z.literal(''),productLink]).default(''),
 maxPrice:z.number().positive().max(10000).nullable().default(null),allowSubstitutions:z.boolean().default(false),
 saturatedFat:z.number().nonnegative().max(100).nullable().default(null),notes:z.string().max(4000).default('')
});
export type WalmartProduct=z.infer<typeof walmartProductSchema>;
export type ProductRow={id:string;version:number;data:WalmartProduct};
export type ShoppingItem={url:string;name:string;quantity:number;sourceNames:string[];size:string;maxPrice:number|null;notes:string};
export function shoppingReview(groceries:Grocery[],selected:Record<string,boolean>,quantities:Record<string,number>,products:ProductRow[]){
 const ready:ShoppingItem[]=[],attention:{id:string;name:string;reason:string}[]=[];
 const groups=new Map<string,ShoppingItem>();
 for(const g of selectedGroceries(groceries,selected)){
  const product=products.find(p=>preferenceKey(p.data.itemName)===preferenceKey(g.data.name))?.data;
  if(!product||!productUrl(product.url)){attention.push({id:g.id,name:g.data.name,reason:'Choose and save a product'});continue;}
  const quantity=quantities[g.id];
  if(!validPackages(quantity)){attention.push({id:g.id,name:g.data.name,reason:'Review package count (1–99)'});continue;}
  const url=productUrl(product.url)!;const prior=groups.get(url);
  // Never silently add two rows that target the same cart product.
  if(prior){attention.push({id:g.id,name:g.data.name,reason:'Same product already selected; combine the package count in the first row and exclude this row'});continue;}
  const entry={url,name:product.productName,quantity,sourceNames:[g.data.name],size:product.size,maxPrice:product.maxPrice,notes:product.notes};groups.set(url,entry);ready.push(entry);
 }
 return {ready,attention};
}
