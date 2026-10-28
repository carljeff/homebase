import { importCmt } from "./cmt-store";
import { z } from "zod";
import { list,save,remove } from "./store";
import { consolidate,type Kind } from "./domain";
export async function operate(input:any,user:string){
 const op=z.enum(["list","save","delete","generate_groceries","import_recipes"]).parse(input.action);
 if(op==="list")return list();
 if(op==="save")return save(input.kind as Kind,input.data,user,input.id,input.version);
 if(op==="delete"){await remove(z.string().uuid().parse(input.id),z.number().int().positive().parse(input.version));return {ok:true};}
 if(op==="import_recipes"&&input.data?.format==="copymethat")return importCmt(input,user);
 if(op==="import_recipes"){const recipes=z.array(z.unknown()).max(50).parse(input.recipes);const {schemas}=await import("./domain");const valid=recipes.map(r=>schemas.recipe.parse(r));const result=[];for(const r of valid)result.push(await save("recipe",r,user));return result;}
 const start=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(input.start),end=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(input.end);
 const rows=await list(),grocery=rows.filter(r=>r.kind==="grocery");const items=consolidate(rows.filter(r=>r.kind==="meal"&&r.data.date>=start&&r.data.date<=end).map(r=>r.data),rows.filter(r=>r.kind==="recipe"),grocery.map(r=>r.data));
 // Replace only generated, unchecked entries; keep manual items, pantry, staples, and checked history.
 for(const r of grocery)if((r.data.generated||r.data.notes==="From meal plan")&&!r.data.checked&&!r.data.pantry&&!r.data.staple)await remove(r.id,r.version);
 for(const item of items)await save("grocery",item,user);return {count:items.length};
}
