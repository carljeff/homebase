import {assertOrdinaryInput} from "./vault-boundary";
import {familySave,assertFamilyDelete,ensureProfiles} from "./family-store";
import {visibleFamilyRows} from "./family";
import { mealOperation } from "./meal-operations";
import { importCmt } from "./cmt-store";
import { z } from "zod";
import { list,save,remove } from "./store";
import { consolidate,type Kind } from "./domain";
export async function operate(input:any,user:string){
 assertOrdinaryInput(input);
 if(input.action==="ensure_family"||(input.action==="save"&&input.kind==="settings"&&input.data?.familyOperation?.action==="ensure_profiles"))return ensureProfiles(input.profiles?input:input.data.familyOperation,user);
 if(["meal_suggestions","plan_recipe","plan_leftovers","meal_feedback"].includes(input.action))return mealOperation(input,user);
 const op=z.enum(["list","save","delete","generate_groceries","import_recipes"]).parse(input.action);
 if(op==="list")return visibleFamilyRows(await list(),user);
 if(op==="save"){if(["family","wishlist"].includes(input.kind))return familySave(input.kind,input.data,user,input.id,input.version);if(input.kind==="meal"&&input.data?.status==="cooked"){const d=input.data.cookedDate||input.data.date;const settings=(await list()).find(r=>r.kind==="settings");const today=new Intl.DateTimeFormat("en-CA",{timeZone:settings?.data.timezone??"America/Indiana/Indianapolis",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());if(d>today)throw new Error("Confirmed cooking cannot be in the future");}return save(input.kind as Kind,input.data,user,input.id,input.version);}
 if(op==="delete"){const row=(await list()).find(r=>r.id===input.id);assertFamilyDelete(row,user);await remove(z.string().uuid().parse(input.id),z.number().int().positive().parse(input.version));return {ok:true};}
 if(op==="import_recipes"&&input.data?.format==="copymethat")return importCmt(input,user);
 if(op==="import_recipes"){const recipes=z.array(z.unknown()).max(50).parse(input.recipes);const {schemas}=await import("./domain");const valid=recipes.map(r=>schemas.recipe.parse(r));const result=[];for(const r of valid)result.push(await save("recipe",r,user));return result;}
 const start=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(input.start),end=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(input.end);
 const rows=await list(),grocery=rows.filter(r=>r.kind==="grocery");const items=consolidate(rows.filter(r=>r.kind==="meal"&&r.data.date>=start&&r.data.date<=end).map(r=>r.data),rows.filter(r=>r.kind==="recipe"),grocery.map(r=>r.data));
 // Replace only generated, unchecked entries; keep manual items, pantry, staples, and checked history.
 for(const r of grocery)if((r.data.generated||r.data.notes==="From meal plan")&&!r.data.checked&&!r.data.pantry&&!r.data.staple)await remove(r.id,r.version);
 for(const item of items)await save("grocery",item,user);return {count:items.length};
}
