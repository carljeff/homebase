import {productUrl} from './walmart';
let shoppingTab:Window|null=null;
let openedBefore=false;
export type WalmartTabResult='opened'|'reused'|'blocked'|'unavailable'|'invalid';
function allowed(value:string){try{const u=new URL(value);return !u.username&&!u.password&&!u.port&&u.protocol==='https:'&&u.hostname==='www.walmart.com'&&(!!productUrl(value)||u.pathname==='/cart'||u.pathname==='/search');}catch{return false;}}
/** Keep a caller-side reference while denying Walmart a reference back to Homebase. */
export function openWalmartTab(url:string,startNew=false):WalmartTabResult{
 if(!allowed(url))return 'invalid';
 if(!startNew&&shoppingTab){try{if(shoppingTab.closed)return 'unavailable';shoppingTab.location.href=url;try{shoppingTab.focus();}catch{/* Focus is optional on mobile. */}return 'reused';}catch{return 'unavailable';}}
 if(!startNew&&openedBefore)return 'unavailable';
 const tab=window.open('about:blank','_blank');if(!tab)return 'blocked';
 try{tab.opener=null;tab.location.href=url;shoppingTab=tab;openedBefore=true;return 'opened';}catch{try{tab.close();}catch{/* No external page is loaded on failure. */}return 'blocked';}
}
