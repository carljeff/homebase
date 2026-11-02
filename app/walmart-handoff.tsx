"use client";
import {useEffect,useMemo,useState} from "react";

import {type Grocery,type Preference,preferenceKey,emptyPreference,productUrl,searchUrl,readPreferences,selectedGroceries,prepareHandoff} from "../lib/walmart";
const KEY="homebase:walmart:preferences:v1";
const validUrl=(value:string)=>Boolean(productUrl(value));
export function WalmartHandoff({groceries}:{groceries:Grocery[]}){
 const [prefs,setPrefs]=useState<Record<string,Preference>>({});
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [review,setReview]=useState(false);
 const eligible=useMemo(()=>groceries.filter(g=>!g.data.checked&&!g.data.pantry),[groceries]);
 useEffect(()=>{
 // Browser storage is loaded after hydration; no household records are changed.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 try{const saved=JSON.parse(localStorage.getItem(KEY)||"{}");setPrefs(readPreferences(JSON.stringify(saved)));}catch{}},[]);
 const save=(name:string,patch:Partial<Preference>)=>{const key=preferenceKey(name);setPrefs(current=>{const next={...current,[key]:{...(current[key]??emptyPreference()),...patch}};try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}return next;});};
 const chosen=selectedGroceries(groceries,selected);
 const [notice,setNotice]=useState("");
 const exportMock=()=>{try{const batch=prepareHandoff(groceries,selected,quantities,prefs);const url=URL.createObjectURL(new Blob([JSON.stringify(batch,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="homebase-walmart-mock.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice("Mock batch exported. No cart changes.");}catch(e){setNotice(e instanceof Error?e.message:"Export failed");}};
 const openProduct=(g:Grocery)=>{const url=prefs[preferenceKey(g.data.name)]?.url;window.open(productUrl(url||"")||searchUrl(g.data.name),"_blank","noopener,noreferrer");};
 const copyList=async()=>{const text=chosen.map(g=>`${g.data.quantityKnown===false?"review":g.data.quantity} ${g.data.unit||""} ${g.data.name}`).join("\n");try{await navigator.clipboard.writeText(text);}catch{window.prompt("Copy your shopping list",text);}};
 return <section className="card" aria-label="Walmart shopping handoff" style={{marginBottom:20}}>
  <div className="section-head"><div><h2>Walmart shopping handoff</h2><p className="muted">Free, manual handoff preview. Nothing is added to your cart automatically.</p></div><button className="button" onClick={()=>setReview(v=>!v)}>{review?"Hide review":"Send to Walmart"}</button></div>
  {review&&<div style={{display:"grid",gap:12}}>
   <p className="muted">Review products and quantities. Save exact Walmart product URLs to avoid searching again. Links open Walmart in your own signed-in browser. Cart automation is not enabled.</p>
   {eligible.map(g=>{const key=preferenceKey(g.data.name),p=prefs[key]||emptyPreference();return <div key={g.id} style={{borderTop:"1px solid var(--border, #ddd)",paddingTop:12,display:"grid",gap:7}}>
    <label><input type="checkbox" checked={selected[g.id]!==false} onChange={e=>setSelected(s=>({...s,[g.id]:e.target.checked}))}/> <strong>{g.data.name}</strong></label>
    <label>Walmart packages (review separately from recipe units) <input type="number" min="1" max="99" step="1" style={{width:90}} value={quantities[g.id]??""} onChange={e=>setQuantities(q=>({...q,[g.id]:Number(e.target.value)}))}/> <small>Grocery need: {g.data.quantityKnown===false?"needs review":g.data.quantity} {g.data.unit||""}</small></label>
    <label>Preferred Walmart product URL <input aria-label={g.data.name+" Walmart product URL"} placeholder="https://www.walmart.com/ip/..." style={{width:"100%",maxWidth:560}} value={p.url} onChange={e=>save(g.data.name,{url:e.target.value})}/></label>
    {p.url&&!validUrl(p.url)&&<small role="alert">Use a valid https://www.walmart.com product URL.</small>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     <input aria-label={g.data.name+" preferred brand"} placeholder="Preferred brand" value={p.brand} onChange={e=>save(g.data.name,{brand:e.target.value})}/>
     <input aria-label={g.data.name+" preferred package size"} placeholder="Package size" value={p.size} onChange={e=>save(g.data.name,{size:e.target.value})}/>
     <button className="button" onClick={()=>openProduct(g)}>{p.url&&validUrl(p.url)?"Open saved product":"Search Walmart"}</button>
    </div>
   </div>})}
   {!eligible.length&&<p className="muted">No unchecked groceries to send.</p>}
   <p role="status">{notice}</p><div className="button-row"><button className="button" onClick={exportMock} disabled={!chosen.length}>Export supervised mock batch</button><button className="button" onClick={copyList} disabled={!chosen.length}>Copy selected list ({chosen.length})</button><a className="button" href="https://www.walmart.com/cart" target="_blank" rel="noopener noreferrer">Review Walmart cart</a></div>
   <small className="muted">Preferences are stored only in this browser for now, not shared across household devices. Prices and stock are not verified. Opening a product does not mark groceries as purchased.</small>
  </div>}
 </section>;
}
