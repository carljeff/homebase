import {foodProfileSchema,type FoodProfile} from "./meal-profile.ts";
export type Row={id:string;kind:string;data:any;version?:number;updatedAt?:string};
export function weekOf(day:string){const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function age(a:string,b:string){return (Date.parse(a+"T12:00:00Z")-Date.parse(b+"T12:00:00Z"))/86400000;}
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const matches=(s:string,term:string)=>norm(s).includes(norm(term));
export function savedMinutes(recipe:any){
 if(!Number.isFinite(recipe.minutes)||recipe.minutes<=0)return null;
 if(!recipe.imported||recipe.customizedFields?.includes("minutes"))return recipe.minutes;
 const text=(recipe.timesText??"").trim();if(!text)return null;
 const total=text.match(/total(?:\s+time)?\s*:?\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)(?:\s*(\d+)\s*(?:minutes?|mins?))?/i);
 if(total)return Number(total[1])*(/hour|hr/i.test(total[2])?60:1)+Number(total[3]??0);
 const single=text.match(/^(?:(?:cook|cooking|prep|preparation)\s*(?:time)?\s*:?\s*)?(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)(?:\s*(\d+)\s*(?:minutes?|mins?))?$/i);
 return single?Number(single[1])*(/hour|hr/i.test(single[2])?60:1)+Number(single[3]??0):null;
}
export function recipeSignals(recipe:any,profile:FoodProfile){
 const ingredients=(recipe.ingredients??[]).map((i:any)=>i.raw??i.name??"");const ingredientText=ingredients.join(" ").toLowerCase();const text=[recipe.title,...(recipe.tags??[]),ingredientText].join(" ").toLowerCase();
 const substitutions:{from:string;to:string;saturatedFatGramsPerServing:number|null}[]=[];let disallowed=false;
 if(profile.avoidBrands.some(brand=>brand.trim()&&matches(recipe.title+" "+ingredientText,brand)))disallowed=true;
 for(const line of ingredients){const lower=line.toLowerCase();if(/\b(vegan|vegetarian|plant[- ]based|meatless)\b/.test(lower))continue;
 for(const [key,pattern,from] of [["ground_beef",/\b(ground|ground up|minced)\s+(lean\s+)?beef\b|\bbeef\s+mince\b/,"Ground beef"],["chicken",/\bchicken\b/,"Chicken"]] as const){if(pattern.test(lower)){const rule=profile.substitutions.find(r=>r.match===key&&r.enabled);if(rule&&!substitutions.some(s=>s.from===from))substitutions.push({from,to:rule.replacement,saturatedFatGramsPerServing:rule.saturatedFatGramsPerServing});else if(!rule&&profile.mostlyVegetarian)disallowed=true;}}
 const remaining=lower.replace(/\b(ground|ground up|minced)\s+(lean\s+)?beef\b|\bbeef\s+mince\b|\bchicken\b/g,"");if(profile.mostlyVegetarian&&/\b(beef|steak|pork|bacon|ham|turkey|lamb|sausage|shrimp|prawns?|salmon|tuna|fish|seafood|anchov\w*|crab|lobster|scallops?)\b/.test(remaining))disallowed=true;
 }
 const protein=/\btofu\b/.test(ingredientText)?"tofu":/\b(lentils?|beans?|chickpeas?|edamame)\b/.test(ingredientText)?"legumes":substitutions.length?"substitute":"other";
 const family=/\b(pasta|penne|spaghetti|lasagna|orzo|macaroni|noodles)\b/.test(text)?"pasta":/\b(soup|chili|stew)\b/.test(text)?"soup":/\b(enchilada|taco|burrito|quesadilla)\b/.test(text)?"mexican":/\b(pancake|breakfast|waffle|french toast|frittata)\b/.test(text)?"breakfast":/\b(rice|bowl|stir fry)\b/.test(text)?"bowl":/\b(casserole|bake|baked)\b/.test(text)?"bake":"other";
 const cuisines=["mexican","italian","indian","thai","cuban","chinese","mediterranean"].filter(c=>text.includes(c));
 const batch=/\b(soup|chili|stew|casserole|bake|baked|make ahead|freezer)\b/.test(text)||(!recipe.servingsEstimated&&recipe.servings>=6);
 const dessert=/\b(cookies?|brownies?|cake|frosting|dessert|smoothie)\b/.test([recipe.title,...(recipe.tags??[])].join(" ").toLowerCase())&&!/\b(pancake|breakfast|dinner|crab cake|potato cake)\b/.test(text);
 const minutes=savedMinutes(recipe);
 const tokens=new Set<string>(ingredients.join(" ").toLowerCase().match(/[a-z]{3,}/g)?.filter((w:string)=>!new Set(["salt","pepper","water","olive","oil","cups","cup","tablespoon","teaspoon","ounces","ounce","fresh","optional","chopped","diced","ground"]).has(w))??[]);
 return {eligible:!disallowed&&!dessert,substitutions,protein,family,cuisines,batch,minutes,tokens,legumes:protein==="legumes"||protein==="tofu",rich:/\b(butter|cream|cheese|coconut oil|coconut milk)\b/.test(ingredientText),text};
}
export function confirmedCooking(rows:Row[]){const cooked:{recipeId:string;date:string}[]=[];for(const r of rows){if(r.kind==="meal"&&r.data.status==="cooked"&&r.data.recipeId)cooked.push({recipeId:r.data.recipeId,date:r.data.cookedDate||r.data.date});if(r.kind==="meal_event"&&r.data.active!==false&&r.data.type==="cooked"&&!r.data.mealId)cooked.push({recipeId:r.data.recipeId,date:r.data.occurredOn});}return [...new Map(cooked.map(r=>[r.recipeId+"|"+r.date,r])).values()];}
export function suggestMeals(rows:Row[],date:string,options:{excludeIds?:string[];seed?:string;limit?:number}={}){
 const settings=rows.find(r=>r.kind==="settings");const profile=foodProfileSchema.parse(settings?.data.foodProfile??{});const week=weekOf(date),day=new Date(date+"T12:00:00Z").getUTCDay();const cooking=confirmedCooking(rows);const events=rows.filter(r=>r.kind==="meal_event"&&r.data.active!==false);const planned=rows.filter(r=>r.kind==="meal"&&weekOf(r.data.date)===week&&!["skipped","replaced"].includes(r.data.status));
 const exclusions=new Set(options.excludeIds??[]);const scoring=rows.filter(r=>r.kind==="recipe"&&!exclusions.has(r.id)).map(r=>{const s=recipeSignals(r.data,profile);if(!s.eligible||planned.some(m=>m.data.recipeId===r.id&&m.data.type==="cook")||events.some(e=>e.data.recipeId===r.id&&e.data.type==="not_this_week"&&e.data.week===week))return null;
 let score=hash((options.seed??date)+r.id)%100/100;const reasons:string[]=[];const warnings:string[]=[];const recent=cooking.filter(c=>c.recipeId===r.id&&c.date<=date).sort((a,b)=>b.date.localeCompare(a.date));const occasional=profile.occasionalMealTerms.some(t=>t.trim()&&matches(r.data.title,t));const cooldown=occasional?profile.occasionalCooldownDays:profile.cooldownDays;
 if(r.data.favorite){score+=16;reasons.push("Marked as a family favorite");}else if(profile.favoriteMealTerms.some(t=>t.trim()&&matches(r.data.title,t))){score+=12;reasons.push("Matches a meal your family enjoys");}
 if(occasional){score-=4;reasons.push("An occasional favorite to keep in the rotation");}
 if(recent.length){const days=age(date,recent[0].date);if(days<cooldown)score-=45*(1-days/cooldown);else{score+=8;reasons.push("No confirmed cook in the last "+cooldown+" days");}score-=Math.min(20,recent.filter(c=>age(date,c.date)<56).length*4);}
 if(profile.busyDays.includes(day)){if(s.minutes&&s.minutes<=profile.quickMinutes){score+=18;reasons.push("Saved time fits a busy evening");}else if(s.batch){score+=5;reasons.push("Could be prepared ahead (recipe-style estimate)");}else if(s.minutes&&s.minutes>profile.quickMinutes)score-=12;}
 if(profile.batchDays.includes(day)&&s.batch){score+=18;reasons.push("Looks suitable for batch cooking and leftovers (estimate)");}
 if(s.protein==="tofu"&&profile.preferredProteins.some(p=>matches(p,"tofu"))){score+=10;reasons.push("Uses a preferred protein: tofu");}
 if(profile.heartPriority&&s.legumes){score+=10;reasons.push("Includes legumes or soy; nutrition has not been calculated");}
 if(profile.heartPriority&&s.rich){score-=5;warnings.push("Contains rich dairy/coconut ingredients; review your usual adjustments");}
 for(const sub of s.substitutions){if(sub.saturatedFatGramsPerServing===null)warnings.push("Substitute saturated fat is unknown; check the product label");else if(sub.saturatedFatGramsPerServing>profile.highSubstituteSatFatGrams){score-=15;warnings.push("Saved substitute label exceeds your saturated-fat preference");}}
 const feedback=events.filter(e=>e.data.recipeId===r.id);score+=Math.min(8,feedback.filter(e=>e.data.type==="positive").length*3);score-=Math.min(18,feedback.filter(e=>e.data.type==="negative"&&age(date,e.data.occurredOn)>=0&&age(date,e.data.occurredOn)<56).length*6);
 score-=Math.min(9,feedback.filter(e=>e.data.type==="recommended"&&age(date,e.data.occurredOn)>=0&&age(date,e.data.occurredOn)<7).length*1.5);
 for(const m of planned){const other=rows.find(r=>r.kind==="recipe"&&r.id===m.data.recipeId);if(other&&recipeSignals(other.data,profile).family===s.family&&s.family!=="other")score-=10;}
 if(!reasons.length)reasons.push("A different option from your private recipe collection");return {id:r.id,title:r.data.title,imageHash:r.data.imageHash??null,minutes:s.minutes,reasons:reasons.slice(0,3),warnings,substitutions:s.substitutions,score,signals:s};
 }).filter(Boolean) as any[];
 const picked:any[]=[];while(picked.length<(options.limit??6)&&scoring.length){let best=-1,bestScore=-Infinity;for(let i=0;i<scoring.length;i++){const c=scoring[i];let score=c.score;let near=false;for(const p of picked){const a=c.signals,b=p.signals;const intersection=[...a.tokens].filter(t=>b.tokens.has(t)).length;const union=new Set([...a.tokens,...b.tokens]).size;const overlap=union?intersection/union:0;if(overlap>.7||norm(c.title)===norm(p.title))near=true;if(a.family===b.family&&a.family!=="other")score-=25;if(a.protein===b.protein&&a.protein!=="other")score-=7;if(a.cuisines.some((x:string)=>b.cuisines.includes(x)))score-=5;}if(!near&&score>bestScore){bestScore=score;best=i;}}if(best<0)break;picked.push(scoring.splice(best,1)[0]);}
 return {suggestions:picked.map(({signals,score,...s})=>s),profile,eligibleRemaining:scoring.length,week,plannedCookNights:planned.filter(m=>m.data.type==="cook").length,plannedOutNights:planned.filter(m=>m.data.type==="out").length};
}
