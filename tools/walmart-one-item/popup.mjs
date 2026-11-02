import {almondMilkAction} from './adapter.mjs';
const $=id=>document.getElementById(id);let selected=null,busy=false;
function render(){ $('recover').disabled=busy||!selected; $('approve').disabled=busy||!selected||!$('consent').checked; }
$('consent').onchange=render;
$('inspect').onclick=async()=>{
 selected=null;$('consent').checked=false;busy=true;render();
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error('Choose your Walmart product tab.');
 const result=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:almondMilkAction,args:['inspect']}))?.[0]?.result;
 if(result?.status!=='ready')throw Error(result?.reason||'Could not inspect this page.');
 selected={tabId:tab.id,snapshot:result.snapshot};$('product').textContent=result.snapshot.title+' — ONE package';$('status').textContent='Review the Walmart page, then check the approval box.';
 }catch(e){$('product').textContent='';$('status').textContent=e.message;}finally{busy=false;render();}
};
$('approve').onclick=async()=>{
 if(busy||!selected||!$('consent').checked)return;busy=true;render();$('inspect').disabled=true;
 try{const result=await chrome.runtime.sendMessage({type:'approve-one',...selected,approved:true});$('status').textContent=result?.status==='click_sent_verify_manually'?'Add click sent. Open Walmart’s cart and confirm the exact product and quantity. No checkout was attempted.':result?.reason||'Outcome uncertain. Check your Walmart cart manually; do not retry.';
 }catch(e){$('status').textContent='Outcome uncertain: '+e.message+' Check Walmart manually.';}
 finally{selected=null;busy=false;render();$('inspect').disabled=false;}
};

$('recover').onclick=async()=>{
 if(busy||!selected)return;
 if(!confirm('Refresh your Walmart cart first and confirm this EXACT product is absent. Unlock a new attempt? This button does not add anything.'))return;
 busy=true;render();$('inspect').disabled=true;
 try{const result=await chrome.runtime.sendMessage({type:'recover-one',...selected,approved:true,confirmedAbsent:true});$('status').textContent=result?.reason||'Could not unlock. No add was requested.';}
 catch(e){$('status').textContent=e.message;}
 finally{selected=null;$('consent').checked=false;busy=false;$('inspect').disabled=false;render();}
};
