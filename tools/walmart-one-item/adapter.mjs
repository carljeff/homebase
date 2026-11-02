// Self-contained because Chrome serializes this function into the active tab.
// No network calls, account access, checkout, stealth, or challenge bypass.
export function almondMilkAction(action='inspect',expected=null){
 let snapshot=null;
 const fail=reason=>({status:'blocked',reason,...(snapshot?{snapshot}:{})});
 if(window.top!==window)return fail('Use the main Walmart product page.');
 const url=new URL(location.href);
 if(url.protocol!=='https:'||!['walmart.com','www.walmart.com'].includes(url.hostname)||url.username||url.password||url.port)return fail('Open an HTTPS Walmart product page.');
 const match=url.pathname.match(/^\/ip\/(?:[^/]+\/)?(\d+)\/?$/);
 if(!match)return fail('Choose the exact almond milk product first. Search and cart pages are not supported.');
 const visible=el=>{const style=getComputedStyle(el);return !el.hidden&&el.getAttribute('aria-hidden')!=='true'&&style.display!=='none'&&style.visibility!=='hidden'&&el.getClientRects().length>0;};
 const text=el=>(el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim();
 if(/verify you are human|are you a robot|robot or human|unusual activity|press and hold/i.test(document.body?.textContent||'')||[...document.querySelectorAll('iframe')].some(el=>/captcha|challenge/i.test(el.getAttribute('src')||'')))return fail('Walmart verification requires your attention. This helper will not bypass it.');
 const titles=[...document.querySelectorAll('h1')].filter(visible);
 if(titles.length!==1||!/\balmond\s*milk\b/i.test(text(titles[0])))return fail('Could not identify one almond milk product heading.');
 const title=text(titles[0]);
 snapshot={id:match[1],title,url:'https://www.walmart.com/ip/'+match[1],quantity:1};
 if(action==='identify')return {status:'ready',snapshot};
 // Quantity controls mean the product may already be in the cart. Fail closed.
 if([...document.querySelectorAll('button,input,select')].filter(visible).some(el=>/increase quantity|decrease quantity|remove from cart|quantity in cart/i.test(text(el))))return fail('A cart quantity control is visible. Review the cart manually first.');
 const quantities=[...document.querySelectorAll('input,select')].filter(el=>visible(el)&&(el.getAttribute('type')==='number'||/quantity|qty|number of/i.test(el.getAttribute('aria-label')||'')));
 if(quantities.some(el=>Number(el.value)!==1))return fail('Set the product package quantity to exactly one on Walmart first.');
 // Only consider unobstructed buttons actually in the user's viewport.
 const inView=el=>{const r=el.getBoundingClientRect();const width=window.innerWidth,height=window.innerHeight;if(r.width<=0||r.height<=0||r.bottom<=0||r.right<=0||r.top>=height||r.left>=width)return false;const x=(Math.max(0,r.left)+Math.min(width,r.right))/2,y=(Math.max(0,r.top)+Math.min(height,r.bottom))/2;const hit=document.elementFromPoint(x,y);return Boolean(hit&&(hit===el||el.contains(hit)));};
 const addButton=el=>{
  const label=(el.textContent||'').replace(/\s+/g,' ').trim(),aria=(el.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
  // Walmart may append the product name to its accessible label.
  const detailed=aria.match(/^add to cart\s*[-–—:,]\s*(.+)$/i);
  if(detailed&&detailed[1].toLowerCase()!==title.toLowerCase())return false;
  return /^add to cart$/i.test(label)||/^add to cart$/i.test(aria);
 };
 const buttons=[...document.querySelectorAll('button')].filter(el=>visible(el)&&inView(el)&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&addButton(el));
 if(buttons.length!==1)return fail(buttons.length?'Multiple Add to cart buttons are in view. Scroll until only the main product button is visible, then inspect again. Nothing was clicked.':'No supported Add to cart button is in view. Keep the main product button visible and inspect again. Nothing was clicked.');
 if(action==='inspect')return {status:'ready',snapshot};
 if(action!=='add'||!expected||expected.id!==snapshot.id||expected.title!==snapshot.title||expected.url!==snapshot.url||expected.quantity!==1)return fail('Product changed. Inspect and review it again.');
 buttons[0].click();
 // A click is not evidence of a cart write. Never report success automatically.
 return {status:'click_sent_verify_manually',snapshot};
}
