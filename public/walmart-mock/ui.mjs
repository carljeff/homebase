import {SupervisedRunner} from './runner.mjs';
const $=id=>document.getElementById(id);let items=[],index=0;
let ledger={};try{ledger=JSON.parse(localStorage.getItem('homebase-mock-ledger')||'{}');}catch{/* Empty rehearsal ledger. */}
const runner=new SupervisedRunner(item=>new Promise((resolve,reject)=>{
 const frame=$('product');const timeout=setTimeout(()=>reject(Error('Mock page load timeout')),5000);
 frame.onload=()=>{clearTimeout(timeout);resolve({url:frame.contentWindow.location.href,document:frame.contentDocument});};
 frame.src='./product.html?id='+encodeURIComponent(new URL(item.url).pathname.split('/').pop())+'&name='+encodeURIComponent(item.name);
}),ledger,next=>localStorage.setItem('homebase-mock-ledger',JSON.stringify(next)),{origin:location.origin,path:new URL('./product.html',import.meta.url).pathname});
function render(message){$('status').textContent=message;$('item').textContent=items[index]?`${index+1}/${items.length}: ${items[index].name} — ${items[index].quantity} packages`:'Batch finished';$('next').disabled=runner.state!=='ready'||runner.busy||!items[index];$('results').textContent=JSON.stringify(runner.results,null,2);}
$('file').onchange=async e=>{if(runner.busy||runner.state==='stopped')return;try{const batch=JSON.parse(await e.target.files[0].text());if(batch.version!==1||batch.mode!=='mock-only'||!Array.isArray(batch.items)||batch.items.length>200)throw Error('Invalid mock batch');items=batch.items;index=0;runner.pause();render('Review the first item, then Resume.');}catch(e){render(String(e));}};
$('pause').onclick=()=>{runner.pause();render('Paused');};$('resume').onclick=()=>{runner.resume();render('Ready: approve one item at a time');};$('stop').onclick=()=>{runner.stop();render('Stopped. Reload to begin a new rehearsal.');};
$('next').onclick=async()=>{const promise=runner.next(items[index],true);render('Opening mock product…');const status=await promise;if(status!=='paused'){index++;runner.pause();}render(status+'. Review the visible page. Resume for the next item.');};

$('sample').onclick=async()=>{if(runner.busy||runner.state==='stopped')return;try{const response=await fetch('./example.json');if(!response.ok)throw Error('Sample unavailable');const batch=await response.json();items=batch.items;index=0;runner.pause();render('Sample loaded. Click Resume, then approve the first mock item.');}catch(e){render(String(e));}};
$('reset').onclick=()=>{if(!runner.busy&&confirm('Clear mock rehearsal history only? This does not affect groceries or Walmart.')){localStorage.removeItem('homebase-mock-ledger');location.reload();}};
