"use client";
import {useState} from 'react';
import {matchMealRecipes,recipeLinkSubstitutions} from '../lib/recipe-matching';
import type {RecordItem} from '../lib/domain';
export default function MealRecipeMatcher({meal,rows,action,busy,error,onClose,onLinked,onBrowse}:{meal:RecordItem;rows:RecordItem[];action:(input:unknown,message?:string)=>Promise<boolean>;busy:boolean;error?:string;onClose:()=>void;onLinked:(recipe:RecordItem)=>void;onBrowse:()=>void}){
 const [target]=useState({id:meal.id,version:meal.version,title:meal.data.title as string});
 const [query,setQuery]=useState(target.title);
 const matches=matchMealRecipes(query,rows);
 return <div className="overlay" onClick={()=>{if(!busy)onClose();}}><section className="modal recipe-matcher" role="dialog" aria-modal="true" aria-label="Match a saved recipe" onClick={e=>e.stopPropagation()}>
 <div className="section-head"><div><span className="eyebrow">YOUR SAVED RECIPES</span><h2>Match “{target.title}”</h2></div><button aria-label="Close recipe matching" disabled={busy} onClick={onClose}>✕</button></div>
 {error&&<div className="alert" role="alert">{error}</div>}
 <label className="field">Search by meal name or ingredient<input type="search" autoFocus maxLength={200} value={query} onInput={e=>setQuery(e.currentTarget.value)}/></label>
 <p className="muted">Review a match before linking. Your meal’s name, date and servings stay as planned.</p>
 {matches.length>0?matches.map(match=><article className="recipe-match-candidate" key={match.recipe.id}>
 <h3>{match.recipe.data.title}</h3><p className="muted">{match.reason}{match.ambiguous?' · Multiple possible matches':''}</p>{recipeLinkSubstitutions(meal.data.substitutions??[],match.recipe,rows).map(sub=><p className="substitution-note" key={sub.from}>{sub.from} → {sub.to}</p>)}
 <details><summary>Preview ingredients & instructions</summary>{match.recipe.data.description&&<p>{match.recipe.data.description}</p>}<ul>{match.recipe.data.ingredients.map((ingredient:{raw?:string;name:string;quantity?:number;unit?:string},i:number)=><li key={i}>{ingredient.raw??[ingredient.quantity,ingredient.unit,ingredient.name].filter(v=>v!==undefined&&v!=='').join(' ')}</li>)}</ul><p className="preline">{match.recipe.data.instructions}</p></details>
 <button className="button primary" disabled={busy} onClick={async()=>{if(await action({action:'link_meal_recipe',mealId:target.id,version:target.version,recipeId:match.recipe.id},'Recipe linked to the plan'))onLinked(match.recipe);}}>Use this recipe</button>
 </article>):<p className="empty-small">No close matches. Try fewer words or browse your recipe library.</p>}
 <div className="card-footer"><button className="button" disabled={busy} onClick={onBrowse}>Browse all recipes</button><button className="button" disabled={busy} onClick={onClose}>Cancel</button></div>
 </section></div>;
}
