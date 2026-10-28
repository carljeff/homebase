import {leftoverOptions,leftoverMeal} from "./leftovers";
import {env} from "cloudflare:workers";
import {z} from "zod";
import {list,save} from "./store";
import {schemas} from "./domain";
import {foodProfileSchema} from "./meal-profile";
import {suggestMeals,recipeSignals,weekOf} from "./meal-suggestions";
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d=>{try{return new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;}catch{return false;}},"Use a real calendar date");
function today(rows:any[]){return new Intl.DateTimeFormat("en-CA",{timeZone:rows.find(r=>r.kind==="settings")?.data.timezone??"America/Indiana/Indianapolis",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
async function stableId(text:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));const h=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export async function mealOperation(input:any,user:string){const rows=await list(),now=new Date().toISOString();const day=today(rows);const db=env.DB;if(!db)throw new Error("Database unavailable");
 if(input.action==="meal_suggestions"){
 const target=date.parse(input.date),requestId=z.string().uuid().parse(input.requestId);const result=suggestMeals(rows,target,{excludeIds:z.array(z.string().max(100)).max(5000).default([]).parse(input.excludeIds),seed:z.string().max(100).default(requestId).parse(input.seed)});
 const writes=[];for(const s of result.suggestions){const id=await stableId(requestId+"/"+s.id);const data=schemas.meal_event.parse({recipeId:s.id,type:"recommended",occurredOn:day,week:weekOf(target)});writes.push(db.prepare("INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,'meal_event',?,1,?,?)").bind(id,JSON.stringify(data),now,user));}if(writes.length)await db.batch(writes);return {...result,leftoverOptions:leftoverOptions(rows,target)};
 }
 if(input.action==="plan_leftovers"){
 const target=date.parse(input.date),requestId=z.string().uuid().parse(input.requestId);const option=leftoverOptions(rows,target).find(m=>m.id===input.sourceMealId);if(!option)throw new Error("That earlier meal is no longer available for leftovers. Refresh the picker.");if(option.version!==input.sourceVersion)throw new Error("Conflict: the earlier meal changed. Refresh the picker.");const source=rows.find(r=>r.kind==="meal"&&r.id===option.id)!;const meal=schemas.meal.parse(leftoverMeal(source,target,now));
 await db.prepare("INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,'meal',?,1,?,?)").bind(requestId,JSON.stringify(meal),now,user).run();return {ok:true,id:requestId};
 }
 if(input.action==="plan_recipe"){
 const target=date.parse(input.date),requestId=z.string().uuid().parse(input.requestId);const recipe=rows.find(r=>r.kind==="recipe"&&r.id===input.recipeId);if(!recipe)throw new Error("Recipe no longer available");const profile=foodProfileSchema.parse(rows.find(r=>r.kind==="settings")?.data.foodProfile??{});const signals=recipeSignals(recipe.data,profile);
 const meal=schemas.meal.parse({date:target,title:recipe.data.title,recipeId:recipe.id,type:"cook",servings:input.servings??recipe.data.servings,substitutions:signals.substitutions,plannedAt:now});const event=schemas.meal_event.parse({recipeId:recipe.id,type:"planned",occurredOn:day,week:weekOf(target),mealId:requestId});
 await db.batch([db.prepare("INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,'meal',?,1,?,?)").bind(requestId,JSON.stringify(meal),now,user),db.prepare("INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,'meal_event',?,1,?,?)").bind(await stableId(requestId+"/planned"),JSON.stringify(event),now,user)]);return {ok:true,id:requestId};
 }
 if(input.action==="meal_feedback"){
 const type=z.enum(["favorite","not_this_week","positive","negative","cooked"]).parse(input.type);const recipe=rows.find(r=>r.kind==="recipe"&&r.id===input.recipeId);if(!recipe)throw new Error("Recipe no longer available");const occurredOn=type==="cooked"?date.parse(input.occurredOn):day;if(type==="cooked"&&occurredOn>day)throw new Error("A confirmed cook date cannot be in the future");
 const requestId=z.string().uuid().parse(input.requestId);if(type==="favorite")await save("recipe",{...recipe.data,favorite:true},user,recipe.id,recipe.version);
 const data=schemas.meal_event.parse({recipeId:recipe.id,type:type==="favorite"?"positive":type,occurredOn,week:weekOf(date.parse(input.date??day)),notes:type==="favorite"?"Marked family favorite":input.notes??""});
 await db.prepare("INSERT OR IGNORE INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,'meal_event',?,1,?,?)").bind(requestId,JSON.stringify(data),now,user).run();return {ok:true};
 }
 throw new Error("Unknown meal action");
}
