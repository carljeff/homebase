"use client";
import {useEffect,useState} from 'react';
import {GUIDED_PROGRESS_KEY,readGuidedProgress,advanceGuided,type GuidedProgress} from '../lib/walmart-guided';
import type {ShoppingItem} from '../lib/walmart-catalog';
export function GuidedWalmartShopping({items,tripKey}:{items:ShoppingItem[];tripKey:string}){
 const key=JSON.stringify([tripKey,items]);
 const [progress,setProgress]=useState<GuidedProgress|null>(null),[notice,setNotice]=useState(''),[opened,setOpened]=useState(false);
 useEffect(()=>{let saved=null;try{saved=localStorage.getItem(GUIDED_PROGRESS_KEY);}catch{/* Continue without persistence. */}
 // Browser-only progress is restored after hydration.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 setProgress(readGuidedProgress(saved,key,items.map(p=>p.url)));setOpened(false);
 },[key,items]);
 const current=progress?.key===key?progress:null;
 function update(next:GuidedProgress){setProgress(next);setOpened(false);try{localStorage.setItem(GUIDED_PROGRESS_KEY,JSON.stringify(next));}catch{setNotice('Progress could not be saved on this device. Keep this page open.');}}
 if(!current)return <p role="status">Loading your shopping place…</p>;
 const item=items[current.index];
 return <section className="walmart-queue" aria-label="Guided Walmart shopping"><h3>Shop one item at a time</h3><p>{current.reviewed.length} reviewed · {current.skipped.length} skipped · {items.length} total</p><p className="muted">Add products in Walmart yourself. Reviewed here never means purchased or confirmed in your cart. Your place is saved on this device.</p>
 {item?<article className="walmart-item"><span>Item {current.index+1} of {items.length}</span><h3>{item.name}</h3><strong>{item.quantity} package{item.quantity===1?'':'s'}{item.size?' · '+item.size:''}</strong>{item.maxPrice!==null&&<p>Your limit: ${item.maxPrice.toFixed(2)} per package; verify in Walmart.</p>}{item.notes&&<p>{item.notes}</p>}
 <a className="button primary" href={item.url} target="_blank" rel="noopener noreferrer" onClick={()=>setOpened(true)}>Open in Walmart</a>{opened&&<small>Link opened. Check the product, store, price and package count in Walmart.</small>}
 <div className="button-row"><button className="button primary" onClick={()=>update(advanceGuided(current,item.url,'reviewed',items.length))}>Reviewed → Next</button><button className="button" onClick={()=>update(advanceGuided(current,item.url,'skipped',items.length))}>Skip for now</button></div></article>:<><h3>End of your shopping list</h3><p>{current.skipped.length?'Some items were skipped. You can revisit them before reviewing your cart.':'All items have been reviewed. Check your cart in Walmart before checkout.'}</p>{current.skipped.length>0&&<button className="button" onClick={()=>{const index=items.findIndex(p=>current.skipped.includes(p.url));update({...current,index:Math.max(0,index)});}}>Return to first skipped item</button>}</>}
 <div className="button-row"><button className="button" disabled={current.index===0} onClick={()=>update({...current,index:Math.max(0,current.index-1)})}>Previous item</button><a className="button" href="https://www.walmart.com/cart" target="_blank" rel="noopener noreferrer">Review Walmart cart</a></div><p role="status">{notice}</p>
 </section>;
}
