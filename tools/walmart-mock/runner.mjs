// Deliberately mock-only. This module has no network or Walmart permissions.
export class SupervisedRunner {
 constructor(load,ledger={},save=()=>{}) {this.load=load;this.ledger=ledger;this.save=save;this.state='paused';this.results=[];this.busy=false;}
 pause(){if(this.state!=='stopped')this.state='paused';}
 resume(){if(this.state!=='stopped')this.state='ready';}
 stop(){this.state='stopped';}
 async next(item,approved=false){
  if(this.busy||this.state!=='ready')return 'paused';
  if(!approved)return 'confirmation_required';
  let url;try{url=new URL(item.url);}catch{return 'invalid';}
  if(url.protocol!=='https:'||url.hostname!=='www.walmart.com'||!/^\/ip\/(?:[^/]+\/)?\d+$/.test(url.pathname)||url.search||url.hash||url.username||url.password||url.port||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99)return 'invalid';
  const key=url.pathname.split('/').pop();if(this.ledger[key])return 'duplicate_blocked';
  this.busy=true;
  try{
   const page=await this.load(item);
   if(this.state!=='ready')return 'paused';
   const location=new URL(page.url);
   if(location.origin!=='http://127.0.0.1:8765'||location.pathname!=='/product.html')throw Error('Live pages are disabled');
   const doc=page.document;
   if(doc.querySelector('[data-challenge]'))return 'needs_manual_review';
   if(doc.querySelector('[data-product-id]')?.getAttribute('data-product-id')!==url.pathname.split('/').pop())return 'product_mismatch';
   const button=doc.querySelector('[data-mock-add]');
   if(!button||button.disabled)return 'unavailable';
   // Persist before clicking: interrupted/uncertain attempts cannot silently retry.
   this.ledger[key]='uncertain';this.save(this.ledger);
   const quantity=doc.querySelector('[data-mock-quantity]');if(!quantity)throw Error('Missing quantity control');
   quantity.value=String(item.quantity);button.click();
   const receipt=doc.querySelector('[data-mock-receipt]');
   const status=receipt?.getAttribute('data-quantity')===String(item.quantity)?'mock_confirmed':'uncertain';
   this.ledger[key]=status;this.save(this.ledger);this.results.push({name:item.name,quantity:item.quantity,status});return status;
  }catch(e){this.results.push({name:item.name,status:'error',message:String(e)});return 'error';}finally{this.busy=false;}
 }
}
