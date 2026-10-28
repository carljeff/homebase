import {familySchema,wishlistSchema} from "./family.ts";
import { foodProfileSchema } from "./meal-profile.ts";
import { z } from "zod";
const short=z.string().trim().min(1).max(1000), note=z.string().max(150000).default("");
const revision=z.object({savedAt:z.string(),recipe:z.record(z.unknown())});
const ingredient=z.object({name:short,quantity:z.number().nonnegative().max(10000),unit:z.string().max(40).default(""),category:z.string().max(80).default("Other"),raw:z.string().max(10000).optional(),quantityKnown:z.boolean().optional()});
export const schemas={
 family:familySchema,
 wishlist:wishlistSchema,
 recipe:z.object({title:short,description:note,favorite:z.boolean().default(false),servings:z.number().int().min(1).max(100),minutes:z.number().int().min(0).max(2880),ingredients:z.array(ingredient).max(1000),instructions:note,tags:z.array(z.string().max(1000)).max(200).default([]),notes:note,likes:z.array(z.string().max(80)).max(20).default([]),revisions:z.array(revision).max(25).default([])}),
 meal:z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),title:short,recipeId:z.string().max(100).default(""),type:z.enum(["cook","leftovers","flex","out"]),status:z.enum(["planned","cooked","skipped","replaced"]).default("planned"),cookedDate:z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),substitutions:z.array(z.object({from:z.string().max(100),to:z.string().max(200),saturatedFatGramsPerServing:z.number().nullable().optional()})).max(10).default([]),previousRecipeIds:z.array(z.string().max(100)).max(50).default([]),plannedAt:z.string().max(80).default(""),sourceMealId:z.string().max(100).default(""),sourceMealDate:z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),notes:note,servings:z.number().min(1).max(100).default(4)}),
 grocery:z.object({name:short,quantity:z.number().nonnegative().max(100000),unit:z.string().max(40).default(""),category:z.string().max(80).default("Other"),notes:note,checked:z.boolean().default(false),staple:z.boolean().default(false),pantry:z.boolean().default(false),quantityKnown:z.boolean().default(true),generated:z.boolean().default(false)}),
 project:z.object({title:short,type:z.enum(["project","task"]),priority:z.enum(["low","medium","high"]),due:z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),reminder:z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),notes:note,completed:z.boolean().default(false),subtasks:z.array(z.object({title:short,done:z.boolean()})).max(100).default([])}),
 meal_event:z.object({recipeId:z.string().min(1).max(100),type:z.enum(["recommended","planned","cooked","skipped","replaced","positive","negative","not_this_week"]),occurredOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),week:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),mealId:z.string().max(100).default(""),notes:note,active:z.boolean().default(true)}),
 settings:z.object({foodProfile:foodProfileSchema.optional(),title:short,notes:note,timezone:short.refine(v=>{try{new Intl.DateTimeFormat("en-US",{timeZone:v});return true;}catch{return false;}},"Use a valid IANA timezone").default("America/Indiana/Indianapolis"),panels:z.array(z.enum(["dinner","week","groceries","projects","dates","highlights"])).default(["dinner","week","groceries","projects","dates","highlights"])}),
 date:z.object({title:short,date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),notes:note}),
 highlight:z.object({title:short,notes:note})
};
export type Kind=keyof typeof schemas;
export type RecordItem={id:string;kind:Kind;data:any;version:number;updatedAt:string};
export function consolidate(meals:any[], recipes:any[], pantry:any[]) {
 const groups=new Map<string,any>();
 for(const meal of meals){if(meal.type!=="cook"||["skipped","replaced"].includes(meal.status))continue;const recipe=recipes.find(r=>r.id===meal.recipeId)?.data;if(!recipe)continue;
 for(const original of recipe.ingredients){const sub=(meal.substitutions??[]).find((s:any)=>s.from==="Ground beef"?/\b(ground|minced)\s+(lean\s+)?beef\b|\bbeef\s+mince\b/i.test(original.raw??original.name):s.from==="Chicken"?/\bchicken\b/i.test(original.raw??original.name):false);const i=sub?{...original,name:sub.to,raw:undefined}:original;const key=i.name.trim().toLowerCase()+"|"+i.unit.trim().toLowerCase();if(pantry.some(p=>p.pantry&&p.name.trim().toLowerCase()===i.name.trim().toLowerCase()&&p.unit.trim().toLowerCase()===i.unit.trim().toLowerCase()))continue;
 const prior=groups.get(key);const q=i.quantityKnown===false?0:i.quantity*meal.servings/recipe.servings;if(prior)prior.quantity+=q;else groups.set(key,{...i,quantity:q,notes:i.quantityKnown===false?"Confirm quantity: "+(i.raw??i.name):"From meal plan",quantityKnown:i.quantityKnown!==false,generated:true,checked:false,staple:false,pantry:false});}}
 return [...groups.values()].map(i=>({...i,quantity:Math.round(i.quantity*100)/100}));
}
