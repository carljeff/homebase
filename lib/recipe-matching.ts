import {foodProfileSchema} from "./meal-profile";
import {recipeSignals} from "./meal-suggestions";
import type {RecordItem} from './domain';
const boring=new Set(['a','an','the','and','with','for','of','in','on','to','easy','quick','best','homemade','simple','recipe','recipes','leftover','leftovers','side']);
const aliases:Record<string,string>={mac:'pasta',chkn:'chicken',chix:'chicken',veggie:'vegetable',veggies:'vegetable',shell:'pasta',shells:'pasta',penne:'pasta',ziti:'pasta',macaroni:'pasta',spaghetti:'pasta',rotini:'pasta',noodles:'pasta',chilli:'chili',garbanzo:'chickpea',garbanzos:'chickpea',aubergine:'eggplant',courgette:'zucchini'};
export function normalizeRecipeTitle(value:string){return value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s*\+\s*side\b.*$/,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function words(value:string){return [...new Set(normalizeRecipeTitle(value).split(' ').filter(w=>w&&!boring.has(w)).map(w=>aliases[w]??(w.endsWith('ies')?w.slice(0,-3)+'y':w.length>4&&w.endsWith('es')&&/(potatoes|tomatoes)$/.test(w)?w.slice(0,-2):w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w)))];}
function distance(a:string,b:string){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}return row[b.length];}
function similar(a:string,b:string){if(a===b)return 1;if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>2)return 0;const d=distance(a,b);return d<=(Math.max(a.length,b.length)>=8?2:1)?1-d/Math.max(a.length,b.length):0;}
function family(tokens:string[]){for(const [kind,terms] of [['soup',['soup','stew','chowder']],['salad',['salad','slaw']],['pizza',['pizza']],['pasta',['pasta']],['dessert',['cake','cookie','brownie','pie']],['bread',['bread','muffin']],['casserole',['casserole','bake']]] as const)if(tokens.some(t=>(terms as readonly string[]).includes(t)))return kind;return null;}
export type RecipeMatch={recipe:RecordItem;score:number;reason:string;kind:'exact'|'learned'|'similar';ambiguous:boolean};
export function matchMealRecipes(title:string,rows:RecordItem[],limit=6):RecipeMatch[]{
 const canonical=normalizeRecipeTitle(title),query=words(title);if(!query.length)return [];
 const recipes=rows.filter(r=>r.kind==='recipe');
 const learnedIds=new Set(rows.filter(m=>m.kind==='meal'&&m.data.recipeId&&normalizeRecipeTitle(m.data.title)===canonical&&recipes.some(r=>r.id===m.data.recipeId)).map(m=>m.data.recipeId));
 const candidates:RecipeMatch[]=[];
 for(const recipe of recipes){
  const saved=normalizeRecipeTitle(recipe.data.title),tokens=words(recipe.data.title),kind=learnedIds.has(recipe.id)?'learned':saved===canonical?'exact':'similar';
  let score:number,reason:string;
  if(kind!=='similar'){score=kind==='learned'?1.1:1;reason=kind==='learned'?'Previously linked to this meal name':'Exact saved title';}
  else{
   const titleCoverage=query.reduce((n,q)=>n+Math.max(0,...tokens.map(t=>similar(q,t))),0)/query.length;
   const titlePrecision=tokens.length?tokens.reduce((n,t)=>n+Math.max(0,...query.map(q=>similar(t,q))),0)/tokens.length:0;
   const ingredientText=(recipe.data.ingredients??[]).map((i:{name?:string;raw?:string})=>i.name||i.raw||'').join(' ');
   const ingredientTokens=words(ingredientText);
   const ingredientCoverage=query.filter(q=>ingredientTokens.includes(q)).length/query.length;
   const textScore=1-distance(canonical.slice(0,150),saved.slice(0,150))/Math.max(canonical.length,saved.length,1);
   score=.58*titleCoverage+.2*titlePrecision+.12*Math.max(0,textScore)+.1*ingredientCoverage;
   if(ingredientCoverage>=.75)score=Math.max(score,.36*ingredientCoverage);
   const qFamily=family(query),rFamily=family(tokens);if(qFamily&&rFamily&&qFamily!==rFamily)score*=.3;
   if(score<.32||titleCoverage===0&&textScore<.65&&ingredientCoverage<.75)continue;
   reason=titleCoverage>=.95?'Similar saved title':titleCoverage>=.5?'Similar words or spelling':'Matching ingredients';
  }
  candidates.push({recipe,score,reason,kind,ambiguous:false});
 }
 candidates.sort((a,b)=>b.score-a.score||a.recipe.data.title.localeCompare(b.recipe.data.title)||a.recipe.id.localeCompare(b.recipe.id));
 const strong=candidates.filter(c=>c.kind!=='similar');const ambiguous=strong.length>1||candidates.length>1&&candidates[0].score-candidates[1].score<.08;
 return candidates.slice(0,Math.max(1,Math.min(limit,20))).map(c=>({...c,ambiguous}));
}
/** Only exact titles or previously confirmed shorthand can be linked without a fuzzy choice. */
export function uniqueKnownRecipe(title:string,rows:RecordItem[]){const matches=matchMealRecipes(title,rows,20).filter(m=>m.kind!=='similar');return matches.length===1?matches[0].recipe:null;}
export function hasSpecificMealTitle(title:string){return words(title).length>0;}

export type RecipeSubstitution={from:string;to:string;saturatedFatGramsPerServing?:number|null};
export function recipeLinkSubstitutions(current:RecipeSubstitution[],recipe:RecordItem,rows:RecordItem[]){
 const profile=foodProfileSchema.parse(rows.find(r=>r.kind==='settings')?.data.foodProfile??{});
 const suggested=recipeSignals(recipe.data,profile).substitutions;
 return [...current,...suggested.filter(s=>!current.some(c=>c.from.toLowerCase()===s.from.toLowerCase()))];
}
