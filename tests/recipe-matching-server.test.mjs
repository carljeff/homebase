import {test} from 'node:test';import assert from 'node:assert/strict';
import {operate} from '../lib/operations.ts';import {list} from '../lib/store.ts';import {foodProfileSchema} from '../lib/meal-profile.ts';
const user='recipe-matching-user';
const create=(kind,data)=>operate({action:'save',kind,data},user);
async function fixture(title){const recipe=await create('recipe',{title,servings:4,minutes:30,ingredients:[{name:'Chicken',quantity:1,unit:'lb'}],instructions:'Synthetic recipe',tags:[]});return recipe;}
test('read-only matching and explicit linking preserve plan details, grocery state and recipes',async()=>{
 const recipe=await fixture('Synthetic Chicken Taco Soup');
 let meal=await create('meal',{title:'Synthetic Taco Soup + Side',date:'2026-11-05',type:'cook',servings:6,notes:'Handwritten meal note',substitutions:[{from:'Chicken',to:'Tofu'}],status:'planned'});
 const grocery=await create('grocery',{name:'Unchanged item',quantity:1}),before=JSON.stringify(await list(user));
 const matches=await operate({action:'match_meal_recipes',title:'Synthetic Taco Soup'},user);assert.ok(matches.some(m=>m.recipeId===recipe.id));assert.equal(JSON.stringify(await list(user)),before);
 const original=structuredClone(meal.data);meal=await operate({action:'link_meal_recipe',mealId:meal.id,version:meal.version,recipeId:recipe.id},user);
 assert.deepEqual(meal.data,{...original,recipeId:recipe.id});assert.equal(meal.version,2);
 const retry=await operate({action:'link_meal_recipe',mealId:meal.id,version:1,recipeId:recipe.id},user);assert.equal(retry.version,2);
 const rows=await list(user);assert.deepEqual(rows.find(r=>r.id===recipe.id),recipe);assert.deepEqual(rows.find(r=>r.id===grocery.id),grocery);
});
test('new meals auto-link only unique exact/confirmed titles and keep household substitutions',async()=>{
 const settings=await create('settings',{title:'Synthetic preferences',foodProfile:foodProfileSchema.parse({substitutions:[{match:'chicken',enabled:true,replacement:'Tofu'}]})});assert.ok(settings.id);
 const recipe=await fixture('Exact Synthetic Chicken Soup');
 const exact=await create('meal',{title:recipe.data.title,date:'2026-11-05',type:'cook',servings:5});assert.equal(exact.data.recipeId,recipe.id);assert.ok(exact.data.substitutions.some(s=>s.to==='Tofu'));
 const fuzzy=await create('meal',{title:'Exact Synthetic Soup',date:'2026-11-06',type:'cook'});assert.equal(fuzzy.data.recipeId,'');
 const linked=await operate({action:'link_meal_recipe',mealId:fuzzy.id,version:fuzzy.version,recipeId:recipe.id},user);
 const learned=await create('meal',{title:fuzzy.data.title,date:'2026-11-07',type:'cook'});assert.equal(learned.data.recipeId,recipe.id);
 const cleared=await operate({action:'save',kind:'meal',id:linked.id,version:linked.version,data:{...linked.data,recipeId:''}},user);assert.equal(cleared.data.recipeId,'');
 const out=await create('meal',{title:recipe.data.title,date:'2026-11-05',type:'out'});assert.equal(out.data.recipeId,'');
});
test('linking rejects stale edits, unavailable recipes and replacing an existing valid choice',async()=>{
 const a=await fixture('Choice Synthetic A'),b=await fixture('Choice Synthetic B');let meal=await create('meal',{title:'Unlinked custom words',date:'2026-11-05',type:'cook'});
 await assert.rejects(operate({action:'link_meal_recipe',mealId:meal.id,version:9,recipeId:a.id},user),/Conflict/);
 await assert.rejects(operate({action:'link_meal_recipe',mealId:meal.id,version:meal.version,recipeId:crypto.randomUUID()},user),/no longer available/);
 meal=await operate({action:'link_meal_recipe',mealId:meal.id,version:meal.version,recipeId:a.id},user);
 await assert.rejects(operate({action:'link_meal_recipe',mealId:meal.id,version:meal.version,recipeId:b.id},user),/already has a recipe/);
 const broken=await create('meal',{title:'Broken link fixture',date:'2026-11-05',type:'cook',recipeId:'archived-missing'});
 const repaired=await operate({action:'link_meal_recipe',mealId:broken.id,version:broken.version,recipeId:a.id},user);assert.equal(repaired.data.recipeId,a.id);assert.ok(repaired.data.previousRecipeIds.includes('archived-missing'));
});
