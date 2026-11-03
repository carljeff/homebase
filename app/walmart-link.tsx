"use client";
import {useState,type ReactNode} from 'react';
import {openWalmartTab,type WalmartTabResult} from '../lib/walmart-tab';
export function WalmartLink({href,children,className,onOpened}:{href:string;children:ReactNode;className?:string;onOpened?:()=>void}){
 const [result,setResult]=useState<WalmartTabResult|null>(null);
 function open(startNew=false){const next=openWalmartTab(href,startNew);setResult(next);if(next==='opened'||next==='reused')onOpened?.();}
 const failed=result==='blocked'||result==='unavailable';
 return <><a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();open();}}>{children}</a>
 {failed&&<span role="status" className="muted">{result==='blocked'?'Your browser blocked the shopping tab.':'Your browser lost access to the shopping tab, or it was closed.'} <button type="button" className="text-link" onClick={()=>open(true)}>Open a new Walmart tab</button> or <a href={href}>open here instead</a>. Homebase can resume your saved shopping trip when you return.</span>}
 {result==='invalid'&&<span role="alert">This Walmart link is not supported.</span>}</>;
}
