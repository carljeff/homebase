import {almondMilkAction} from './adapter.mjs';
let busy=false;
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(sender.id!==chrome.runtime.id||message?.type!=='approve-one')return false;
 if(busy){sendResponse({status:'blocked',reason:'Another approved action is in progress.'});return false;}
 busy=true;
 (async()=>{
  const {tabId,snapshot,approved}=message;
  if(approved!==true||!snapshot||snapshot.quantity!==1||!/^\d+$/.test(snapshot.id)||snapshot.url!=='https://www.walmart.com/ip/'+snapshot.id)throw Error('Invalid approval.');
  const tab=await chrome.tabs.get(tabId);
  if(!tab.active)throw Error('Keep the selected Walmart tab active.');
  const key='attempt:'+snapshot.id;
  if((await chrome.storage.local.get(key))[key])throw Error('This product already has an attempted action. Check your cart manually; automatic retry is disabled.');
  // Persist before injection. Even browser/service-worker interruption blocks replay.
  await chrome.storage.local.set({[key]:{status:'uncertain',at:new Date().toISOString()}});
  const results=await chrome.scripting.executeScript({target:{tabId},func:almondMilkAction,args:['add',snapshot]});
  const result=results?.[0]?.result||{status:'uncertain',reason:'No result returned. Check Walmart manually.'};
  await chrome.storage.local.set({[key]:{status:result.status,at:new Date().toISOString()}});
  return result;
 })().then(sendResponse,error=>sendResponse({status:'uncertain',reason:error.message})).finally(()=>{busy=false;});
 return true;
});
