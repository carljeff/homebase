import {test} from 'node:test';import assert from 'node:assert/strict';
import {matchMealRecipes,normalizeRecipeTitle,uniqueKnownRecipe,hasSpecificMealTitle} from '../lib/recipe-matching.ts';
import type {RecordItem} from '../lib/domain.ts';
const recipe=(id:string,title:string,ingredients:string[]=[])=>({id,kind:'recipe',version:1,updatedAt:'',data:{title,ingredients:ingredients.map(name=>({name}))}} as RecordItem);
const meal=(title:string,recipeId:string)=>({id:crypto.randomUUID(),kind:'meal',version:1,updatedAt:'',data:{title,recipeId}} as RecordItem);
test('shorthand, side notes, plurals, pasta names and typos suggest saved recipes',()=>{
 const rows=[recipe('soup','Chicken Taco Soup'),recipe('pasta','Broccoli Garlic Pasta',['broccoli','shell pasta']),recipe('salad','Broccoli Salad'),recipe('cake','Upside Down Cake'),recipe('potato','Crockpot Potato Soup')];
 assert.equal(matchMealRecipes('Taco Soup',rows)[0].recipe.id,'soup');assert.equal(matchMealRecipes('taco suop',rows)[0].recipe.id,'soup');
 assert.equal(matchMealRecipes('Shells & Broccoli + Side',rows)[0].recipe.id,'pasta');
 assert.equal(matchMealRecipes('potato soup',rows)[0].recipe.id,'potato');
 assert.equal(normalizeRecipeTitle('  Shells & Broccoli + Side '),'shells and broccoli');
 assert.equal(hasSpecificMealTitle('Leftovers'),false);assert.equal(hasSpecificMealTitle('Soup leftovers'),true);
});
test('fuzzy or modified recipe bases never become automatic links',()=>{
 const rows=[recipe('cauli','Cauliflower Pizza'),recipe('soup','Chicken Taco Soup')];assert.equal(matchMealRecipes('Homemade Pizza',rows)[0].recipe.id,'cauli');
 assert.equal(uniqueKnownRecipe('Homemade Pizza',rows),null);assert.equal(uniqueKnownRecipe('Taco Soup',rows),null);
 assert.equal(uniqueKnownRecipe('Chicken Taco Soup',rows)?.id,'soup');
});
test('duplicate names and conflicting learned aliases require review; stable ties do not guess',()=>{
 const rows=[recipe('a','Taco Soup'),recipe('b','Taco Soup')];assert.ok(matchMealRecipes('Taco Soup',rows).every(m=>m.ambiguous));assert.equal(uniqueKnownRecipe('Taco Soup',rows),null);
 const learned=[recipe('a','Chicken Taco Soup'),recipe('b','Vegetarian Taco Soup'),meal('Taco night','a'),meal('Taco night','b')];assert.equal(uniqueKnownRecipe('Taco night',learned),null);
 const chosen=[recipe('a','Chicken Taco Soup'),meal('Taco Soup','a')];assert.equal(uniqueKnownRecipe('Taco Soup',chosen)?.id,'a');
 assert.equal(matchMealRecipes('Taco Soup',chosen)[0].reason,'Previously linked to this meal name');
});
test('empty/unrelated/generic titles do not select recipes and matching does not mutate records',()=>{
 const rows=[recipe('a','Chicken Taco Soup',['beans','corn']),meal('Unlinked','')],before=JSON.stringify(rows);
 for(const q of ['', 'Leftovers', 'sprocket assembly'])assert.equal(matchMealRecipes(q,rows).length,0);
 assert.ok(matchMealRecipes('beans corn',rows).some(m=>m.recipe.id==='a'));assert.equal(JSON.stringify(rows),before);
});
