import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemas,consolidate } from '../lib/domain.ts';
const recipe={id:'r1',data:{servings:4,ingredients:[{name:'Chickpeas',quantity:2,unit:'cans',category:'Canned & dry'},{name:'Spinach',quantity:100,unit:'g',category:'Produce'}]}};
test('scales meals, merges matching units, and excludes leftovers',()=>{const items=consolidate([{recipeId:'r1',type:'cook',servings:8},{recipeId:'r1',type:'cook',servings:4},{recipeId:'r1',type:'leftovers',servings:4}],[recipe],[]);assert.equal(items[0].quantity,6);assert.equal(items[1].quantity,300)});
test('pantry exclusion requires matching unit; does not add incompatible units',()=>{const items=consolidate([{recipeId:'r1',type:'cook',servings:4}],[recipe],[{name:'CHICKPEAS',unit:'cans',pantry:true},{name:'Spinach',unit:'cups',pantry:true}]);assert.equal(items.length,1);assert.equal(items[0].unit,'g')});
test('rejects unsafe recipe bounds and invalid timezone',()=>{assert.equal(schemas.recipe.safeParse({title:'',servings:0,minutes:-1}).success,false);assert.equal(schemas.settings.safeParse({title:'Preferences',timezone:'not-a-timezone'}).success,false)});
test('recipe import retains variations, food tags and likes',()=>{const r=schemas.recipe.parse({title:'Soup',servings:4,minutes:30,ingredients:[],instructions:'Simmer.',notes:'Use white beans.',tags:['Vegetarian'],likes:['Adult A']});assert.equal(r.notes,'Use white beans.');assert.deepEqual(r.revisions,[])});
