"use client";
import {useEffect,useMemo,useState} from "react";

type Grocery={id:string;data:{name:string;quantity:number;unit?:string;checked?:boolean;pantry?:boolean;quantityKnown?:boolean}};
type Preference={url:string;brand:string;size:string;alternative:string;maxPrice:string;allowSubstitutions:boolean};
const KEY="homebase:walmart:preferences:v1";
const validUrl=(value:string)=>{try{const u=new URL(value);return u.protocol==="https:"&&(u.hostname==="walmart.com"||u.hostname.endsWith(".walmart.com"));}catch{return false;}};
const searchUrl=(name:string)=>"https://www.walmart.com/search?q="+encodeURIComponent(name);
export function WalmartHandoff({groceries}:{groceries:Grocery[]}){
 const [prefs,setPrefs]=useState<Record<string,Preference>>({});
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [ready,setReady]=useState(false);
 const [review,setReview]=useState(false);
 const eligible=useMemo(()=>groceries.filter(g=>!g.data.checked&&!g.data.pantry),[groceries]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(KEY)||"{}");if(saved&&typeof saved==="object"&&!Array.isArray(saved))setPrefs(saved);}catch{}setReady(true);},[]);
 const save=(name:string,patch:Partial<Preference>)=>{const key=name.trim().toLowerCase();setPrefs(current=>{const next={...current,[key]:{url:"",brand:"",size:"",alternative:"",maxPrice:"",allowSubstitutions:false,...current[key],...patch}};try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}return next;});};
 const chosen=eligible.filter(g=>selected[g.id]!==false);
 const openProduct=(g:Grocery)=>{const url=prefs[g.data.name.trim().toLowerCase()]?.url;window.open(url&&validUrl(url)?url:searchUrl(g.data.name),"_blank","noopener,noreferrer");};
 const copyList=async()=>{const text=chosen.map(g=>`${quantities[g.id]??g.data.quantity} ${g.data.unit||""} ${g.data.name}`).join("\n");try{await navigator.clipboard.writeText(text);}catch{window.prompt("Copy your shopping list",text);}};
 return <section className="card" aria-label="Walmart shopping handoff" style={{marginBottom:20}}>
  <div className="section-head"><div><h2>Walmart shopping handoff</h2><p className="muted">Free, manual handoff preview. Nothing is added to your cart automatically.</p></div><button className="button" onClick={()=>setReview(v=>!v)}>{review?"Hide review":"Send to Walmart"}</button></div>
  {review&&<div style={{display:"grid",gap:12}}>
   <p className="muted">Review products and quantities. Save exact Walmart product URLs to avoid searching again. Links open Walmart in your own signed-in browser. Cart automation is not enabled.</p>
   {eligible.map(g=>{const key=g.data.name.trim().toLowerCase(),p=prefs[key]||{url:"",brand:"",size:"",alternative:"",maxPrice:"",allowSubstitutions:false};return <div key={g.id} style={{borderTop:"1px solid var(--border, #ddd)",paddingTop:12,display:"grid",gap:7}}>
    <label><input type="checkbox" checked={selected[g.id]!==false} onChange={e=>setSelected(s=>({...s,[g.id]:e.target.checked}))}/> <strong>{g.data.name}</strong></label>
    <label>Quantity <input type="number" min="0" step="any" style={{width:90}} value={quantities[g.id]??g.data.quantity} onChange={e=>setQuantities(q=>({...q,[g.id]:Number(e.target.value)}))}/> {g.data.unit||""}</label>
    <label>Preferred Walmart product URL <input aria-label={g.data.name+" Walmart product URL"} placeholder="https://www.walmart.com/ip/..." style={{width:"100%",maxWidth:560}} value={p.url} onChange={e=>save(g.data.name,{url:e.target.value})}/></label>
    {p.url&&!validUrl(p.url)&&<small role="alert">Use a valid https://www.walmart.com product URL.</small>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     <input aria-label={g.data.name+" preferred brand"} placeholder="Preferred brand" value={p.brand} onChange={e=>save(g.data.name,{brand:e.target.value})}/>
     <input aria-label={g.data.name+" preferred package size"} placeholder="Package size" value={p.size} onChange={e=>save(g.data.name,{size:e.target.value})}/>
     <button className="button" onClick={()=>openProduct(g)}>{p.url&&validUrl(p.url)?"Open saved product":"Search Walmart"}</button>
    </div>
   </div>})}
   {!eligible.length&&<p className="muted">No unchecked groceries to send.</p>}
   <div className="button-row"><button className="button" onClick={copyList} disabled={!chosen.length}>Copy selected list ({chosen.length})</button><a className="button" href="https://www.walmart.com/cart" target="_blank" rel="noopener noreferrer">Review Walmart cart</a></div>
   <small className="muted">Preferences are stored only in this browser for now, not shared across household devices. Prices and stock are not verified. Opening a product does not mark groceries as purchased.</small>
  </div>}
 </section>;
}
