import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {readFileSync,existsSync} from 'node:fs';import ts from 'typescript';import {parseHTML} from 'linkedom';import {createElement,act} from 'react';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const url=new URL(specifier+'.tsx',context.parentURL);if(existsSync(url))return next(url.href,context);}return next(specifier,context);},load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}});
const {document,window}=parseHTML('<html><body><div id="root"></div></body></html>');globalThis.document=document;globalThis.window=window;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client'),{default:Homebase}=await import('../app/homebase.tsx');
const date=new Date().toLocaleDateString('en-CA'),recipeId=crypto.randomUUID();
function recipe(id,instructions){return {id,kind:'recipe',version:1,data:{title:'Synthetic soup',description:'A saved recipe',servings:4,minutes:30,tags:[],ingredients:[{name:'Lentils',quantity:1,unit:'cup'}],instructions,notes:'Recipe memory',likes:[],favorite:false}};}
function meal(title,type,linkedRecipe){return {id:crypto.randomUUID(),kind:'meal',version:4,data:{title,date,type,recipeId:linkedRecipe,servings:6,status:'planned',notes:'Plan-specific memory',substitutions:[{from:'Chicken',to:'Tofu'}]}};}
const cook=meal('Planned soup','cook',recipeId),leftovers=meal('Soup leftovers','leftovers',recipeId),custom=meal('Custom dinner','out',''),missing=meal('Missing recipe meal','cook',crypto.randomUUID());
const rows=[recipe(crypto.randomUUID(),'Wrong same-title recipe'),recipe(recipeId,'Correct instructions: simmer the lentils.'),cook,leftovers,custom,missing];
async function fixture(t,extra=[]){
 let currentRows=structuredClone([...rows,...extra]);const requests=[];globalThis.fetch=async(url,options)=>{if(options?.method==='POST'){const body=JSON.parse(options.body);requests.push(body);if(body.action==='meal_suggestions')return {ok:true,json:async()=>({suggestions:[],leftoverOptions:[],plannedCookNights:1,profile:{substantialMealsMin:3,substantialMealsMax:4,mealsOutPerWeek:1,busyDays:[]}})};if(body.action==='link_meal_recipe'){currentRows=currentRows.map(r=>r.id===body.mealId?{...r,version:r.version+1,data:{...r.data,recipeId:body.recipeId}}:r);return {ok:true,json:async()=>currentRows.find(r=>r.id===body.mealId)};}throw Error('Unexpected write during navigation');}return {ok:true,json:async()=>currentRows};};
 const host=document.getElementById('root'),root=createRoot(host);t.after(async()=>{await act(async()=>root.unmount());});await act(async()=>root.render(createElement(Homebase,{friendsEnabled:true})));
 const click=async text=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,text);await act(async()=>button.click());};
 const calendar=async title=>{const button=[...host.querySelectorAll('button.meal')].find(b=>b.querySelector('b').textContent===title);assert.ok(button,title);await act(async()=>button.click());};
 const closeRecipe=async()=>{await act(async()=>host.querySelector('[aria-label="Close recipe"]').click());};
 return {host,requests,click,calendar,closeRecipe,getRows:()=>currentRows};
}
test('dashboard meal click opens the exact linked recipe, with context and separate meal options',async t=>{
 const {host,requests,click,calendar}=await fixture(t);await calendar(cook.data.title);
 const dialog=host.querySelector('[role="dialog"]');assert.equal(dialog.getAttribute('aria-label'),'Synthetic soup');assert.ok(dialog.textContent.includes('Correct instructions: simmer the lentils.'));assert.ok(!dialog.textContent.includes('Wrong same-title recipe'));assert.ok(dialog.textContent.includes('Lentils'));assert.ok(dialog.textContent.includes('Plan-specific memory'));assert.ok(dialog.textContent.includes('Chicken → Tofu'));assert.ok(dialog.textContent.includes('6 servings'));assert.equal(requests.length,0);
 await click('Meal options');assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'),'Edit meal');assert.equal(host.querySelector('[aria-label="Close recipe"]'),null);assert.ok(host.querySelector('[role="dialog"]').textContent.includes('Browse recipes to replace'));assert.equal(requests.length,0);
});
test('Kitchen week opens recipes for cook nights and linked leftovers, preserving custom/missing fallbacks',async t=>{
 const {host,requests,click,calendar,closeRecipe}=await fixture(t);await click('Kitchen');
 for(const meal of [cook,leftovers]){await calendar(meal.data.title);assert.ok(host.querySelector('.cooking').textContent.includes('Correct instructions'));if(meal===leftovers)assert.ok(host.querySelector('.planning-banner').textContent.includes('Leftovers'));await closeRecipe();}
 await calendar(custom.data.title);assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'),'Edit meal');await click('Cancel');
 await calendar(missing.data.title);assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'),'Match a saved recipe');assert.equal(host.querySelector('.cooking'),null);await click('Cancel');assert.equal(requests.length,0);
});
test('closing calendar recipes clears meal context before opening the cookbook, and empty slots still show ideas',async t=>{
 const {host,requests,click,calendar}=await fixture(t);await calendar(cook.data.title);
 const escape=new window.Event('keydown',{bubbles:true});Object.defineProperty(escape,'key',{value:'Escape'});await act(async()=>document.dispatchEvent(escape));assert.equal(host.querySelector('[role="dialog"]'),null);
 await click('Kitchen');await click('Recipes');await act(async()=>host.querySelector('.recipe-card').click());assert.equal(host.querySelector('.cooking .planning-banner'),null);assert.ok(!host.querySelector('.cooking').textContent.includes('Meal options'));
 await act(async()=>host.querySelector('[aria-label="Close recipe"]').click());await click('Week');
 await act(async()=>host.querySelector('.add-meal').click());assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'),'Meal ideas');assert.equal(requests.length,1);assert.equal(requests[0].action,'meal_suggestions');
});

test('unlinked shorthand offers a preview and links only after confirmation, then opens directly',async t=>{
 const saved=recipe(crypto.randomUUID(),'Simmer the taco soup.');saved.data.title='Chicken Taco Soup';
 const unlinked=meal('Taco Soup','cook','');const before=structuredClone(unlinked);
 const {host,requests,calendar,closeRecipe,getRows}=await fixture(t,[saved,unlinked]);
 await calendar(unlinked.data.title);assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'),'Match a saved recipe');
 const first=host.querySelector('.recipe-match-candidate');assert.equal(first.querySelector('h3').textContent,'Chicken Taco Soup');assert.ok(first.textContent.includes('Simmer the taco soup.'));assert.equal(requests.length,0);
 await act(async()=>first.querySelector('button').click());
 assert.equal(requests.length,1);assert.equal(requests[0].action,'link_meal_recipe');assert.equal(requests[0].mealId,unlinked.id);assert.equal(requests[0].recipeId,saved.id);
 const linked=getRows().find(r=>r.id===unlinked.id);assert.deepEqual(linked.data,{...before.data,recipeId:saved.id});assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'),'Chicken Taco Soup');
 await closeRecipe();await calendar(unlinked.data.title);assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'),'Chicken Taco Soup');assert.equal(requests.length,1);
});

test('matching keeps its opening version so background refresh cannot silently approve a changed meal',async t=>{
 const {default:Matcher}=await import('../app/meal-recipe-matcher.tsx');const host=document.getElementById('root'),root=createRoot(host),calls=[];
 t.after(async()=>{await act(async()=>root.unmount());});const original=meal('Synthetic soup','cook','');
 const props={meal:original,rows,action:async input=>{calls.push(input);return false;},busy:false,onClose:()=>{},onLinked:()=>{},onBrowse:()=>{}};
 await act(async()=>root.render(createElement(Matcher,props)));
 await act(async()=>root.render(createElement(Matcher,{...props,meal:{...original,version:5,data:{...original.data,notes:'Changed elsewhere'}},error:'Conflict: refresh the meal'})));
 await act(async()=>host.querySelector('.recipe-match-candidate button').click());assert.equal(calls[0].version,4);assert.equal(host.querySelector('[role="alert"]').textContent,'Conflict: refresh the meal');
});
