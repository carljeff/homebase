import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){if(url.endsWith('/app/chatgpt-auth.ts'))return {format:'module',source:'export async function getChatGPTUser(){return globalThis.__recipeVisitor;} export async function requireChatGPTUser(){return globalThis.__recipeVisitor;}',shortCircuit:true};return next(url,context);}});
const {POST}=await import('../app/mcp/route.ts');const {list}=await import('../lib/store.ts');
async function call(name,args){const r=await POST(new Request('https://homebase.example/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,method:'tools/call',params:{name,arguments:args}})}));return r.json();}
const result=rpc=>JSON.parse(rpc.result.content[0].text);
test('connector matches handwriting titles without writes and can explicitly link or plan the chosen recipe',async()=>{
 globalThis.__recipeVisitor={userId:'recipe-visitor',email:'synthetic@example.test'};
 const recipe=result(await call('homebase_write',{action:'save',kind:'recipe',data:{title:'Synthetic Chicken Taco Soup',servings:4,minutes:30,ingredients:[],instructions:'Synthetic instructions'}}));
 const before=JSON.stringify(await list());const matches=result(await call('homebase_match_recipes',{title:'Synthetic Taco Soup'}));assert.equal(matches[0].recipeId,recipe.id);assert.equal(JSON.stringify(await list()),before);
 let meal=result(await call('homebase_write',{action:'save',kind:'meal',data:{title:'Synthetic Taco Soup',date:'2026-11-06',type:'cook'}}));assert.equal(meal.data.recipeId,'');
 meal=result(await call('homebase_write',{action:'link_meal_recipe',mealId:meal.id,version:meal.version,recipeId:matches[0].recipeId}));assert.equal(meal.data.recipeId,recipe.id);
 const id=crypto.randomUUID();assert.equal(result(await call('homebase_write',{action:'plan_recipe',requestId:id,date:'2026-11-07',recipeId:recipe.id})).id,id);
 globalThis.__recipeVisitor=null;assert.equal((await POST(new Request('https://homebase.example/mcp',{method:'POST',body:'{}'}))).status,401);
});
