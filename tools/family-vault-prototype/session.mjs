// Drop keys and invalidate in-flight UI operations on lock. JavaScript cannot promise secure erasure.
export class VaultSession{
 constructor(clear,{clock=Date.now,idleMs=120000}={}){this.clear=clear;this.clock=clock;this.idleMs=idleMs;this.epoch=0;this.key=null;this.token=null;this.last=0;}
 begin(){this.lock();this.last=this.clock();return this.epoch;}
 current(epoch){return epoch===this.epoch&&this.clock()-this.last<this.idleMs;}
 touch(){if(this.key&&this.clock()-this.last>=this.idleMs)this.lock();else this.last=this.clock();}
 check(){if((this.key||this.token)&&this.clock()-this.last>=this.idleMs)this.lock();}
 lock(){const token=this.token;this.epoch++;this.key=null;this.token=null;this.last=0;this.clear();return token;}
}
