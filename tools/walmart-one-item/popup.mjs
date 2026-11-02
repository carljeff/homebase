import {almondMilkAction} from './adapter.mjs';
const $=id=>document.getElementById(id);let selected=null,busy=false;
function render(){ $('recover').disabled=busy||!selected||!$('absent').checked; $('approve').disabled=busy||!selected?.canAdd||!$('consent').checked; }
$('version').textContent='Helper version '+chrome.runtime.getManifest().version;
$('absent').onchange=render;
$('consent').onchange=render;
$('inspect').onclick=async()=>{
 selected=null;$('consent').checked=false;$('absent').checked=false;busy=true;render();
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error('Choose your Walmart product tab.');
 const result=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:almondMilkAction,args:['inspect']}))?.[0]?.result;
 if(!result?.snapshot)throw Error(result?.reason||'Could not identify this product.');
 selected={tabId:tab.id,snapshot:result.snapshot,canAdd:result.status==='ready'};$('product').textContent=result.snapshot.title+' — ONE package';$('status').textContent=selected.canAdd?'Review the Walmart page, then check the approval box.':result.reason+' You can still unlock a prior attempt after confirming the item is absent.';
 }catch(e){$('product').textContent='';$('status').textContent=e.message;}finally{busy=false;render();}
};
$('approve').onclick=async()=>{
 if(busy||!selected?.canAdd||!$('consent').checked)return;busy=true;render();$('inspect').disabled=true;
 try{const result=await chrome.runtime.sendMessage({type:'approve-one',...selected,approved:true});$('status').textContent=result?.status==='click_sent_verify_manually'?'Add click sent. Open Walmart’s cart and confirm the exact product and quantity. No checkout was attempted.':result?.reason||'Outcome uncertain. Check your Walmart cart manually; do not retry.';
 }catch(e){$('status').textContent='Outcome uncertain: '+e.message+' Check Walmart manually.';}
 finally{selected=null;busy=false;render();$('inspect').disabled=false;}
};

$('recover').onclick=async()=>{
 if(busy||!selected||!$('absent').checked)return;
 busy=true;render();$('inspect').disabled=true;
 try{const result=await chrome.runtime.sendMessage({type:'recover-one',...selected,approved:true,confirmedAbsent:true});$('status').textContent=result?.reason||'Could not unlock. No add was requested.';}
 catch(e){$('status').textContent=e.message;}
 finally{selected=null;$('consent').checked=false;$('absent').checked=false;busy=false;$('inspect').disabled=false;render();}
};
