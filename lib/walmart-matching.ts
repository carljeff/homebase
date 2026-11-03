import type {Grocery} from './walmart';
import type {WalmartProduct,ProductRow} from './walmart-catalog';
export const conversionUnits=['fl oz','cup','tbsp','tsp','ml','l','g','kg','oz','lb','each'] as const;
export type ConversionUnit=typeof conversionUnits[number];
const units:Record<string,{dimension:string;factor:number}>={
 'fl oz':{dimension:'volume',factor:29.5735295625},cup:{dimension:'volume',factor:236.5882365},tbsp:{dimension:'volume',factor:14.78676478125},tsp:{dimension:'volume',factor:4.92892159375},ml:{dimension:'volume',factor:1},l:{dimension:'volume',factor:1000},
 g:{dimension:'mass',factor:1},kg:{dimension:'mass',factor:1000},oz:{dimension:'mass',factor:28.349523125},lb:{dimension:'mass',factor:453.59237},each:{dimension:'count',factor:1}
};
function unit(value:string){const key=value.toLowerCase().trim().replace(/\./g,'').replace(/\s+/g,' ');const aliases:Record<string,string>={'cups':'cup','tablespoon':'tbsp','tablespoons':'tbsp','teaspoon':'tsp','teaspoons':'tsp','fluid ounce':'fl oz','fluid ounces':'fl oz','fl ounces':'fl oz','floz':'fl oz','grams':'g','gram':'g','kilogram':'kg','kilograms':'kg','ounce':'oz','ounces':'oz','pound':'lb','pounds':'lb','lbs':'lb','milliliter':'ml','milliliters':'ml','liters':'l','liter':'l','count':'each','item':'each','items':'each'};return units[aliases[key]||key];}
export function packageSuggestion(g:Grocery,product:WalmartProduct):{quantity:number;reason:string}|null{
 if(g.data.quantityKnown===false||!Number.isFinite(g.data.quantity)||g.data.quantity<=0||!product.packageAmount||!product.packageUnit)return null;
 const from=unit(g.data.unit||''),to=unit(product.packageUnit);if(!from||!to||from.dimension!==to.dimension)return null;
 const ratio=g.data.quantity*from.factor/(product.packageAmount*to.factor);const quantity=Math.ceil(ratio-1e-9);if(quantity<1||quantity>99)return null;
 return {quantity,reason:`${g.data.quantity} ${g.data.unit} needed ÷ ${product.packageAmount} ${product.packageUnit} per package; rounded up`};
}
function words(value:string){return [...new Set(value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/almondmilk/g,'almond milk').replace(/gluten[- ]free/g,'glutenfree').replace(/dairy[- ]free/g,'dairyfree').replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w&&!['the','a','an','of','fresh'].includes(w)).map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w))];}
function near(a:string,b:string){if(a===b)return true;if(Math.min(a.length,b.length)<5||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(a.length-i)+(b.length-j)<=1;}
export function suggestedProducts(name:string,products:ProductRow[]){
 const q=words(name);if(!q.length)return [];
 const candidates=products.map(row=>{const key=words(row.data.itemName),all=words(row.data.itemName+' '+row.data.productName);
  for(const qualifier of ['unsweetened','glutenfree','dairyfree','vegan'])if(q.includes(qualifier)&&!all.includes(qualifier))return null;
  const bases=['almond','oat','soy','coconut','cashew','peanut'];const queryBase=bases.find(b=>q.includes(b)),candidateBase=bases.find(b=>all.includes(b));if(queryBase&&candidateBase&&queryBase!==candidateBase)return null;
  const used=new Set<number>();let count=0;for(const word of q){const index=key.findIndex((w,i)=>!used.has(i)&&near(word,w));if(index>=0){used.add(index);count++;}}
  const score=2*count/(q.length+key.length);if(score<0.55||count<2&&!(q.length===1&&q[0].length>=5&&count===1))return null;
  return {row,score};
 }).filter((v):v is {row:ProductRow;score:number}=>v!==null).sort((a,b)=>b.score-a.score||a.row.data.itemName.localeCompare(b.row.data.itemName));
 const seen=new Set<string>();return candidates.filter(c=>{if(seen.has(c.row.data.url))return false;seen.add(c.row.data.url);return true;}).slice(0,3);
}
