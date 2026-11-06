// Drop keys and invalidate in-flight UI operations on lock. JavaScript cannot promise secure erasure.
export class VaultSession{
 constructor(clear,{clock=Date.now,idleMs=120000,lifetimeMs=600000}={}){this.clear=clear;this.clock=clock;this.idleMs=idleMs;this.lifetimeMs=lifetimeMs;this.epoch=0;this.key=null;this.token=null;this.last=0;this.started=null;}
 begin(){this.lock();this.started=this.last=this.clock();return this.epoch;}
 expired(){const now=this.clock();return this.started===null||now<this.last||now<this.started||now-this.last>=this.idleMs||now-this.started>=this.lifetimeMs;}
 current(epoch){return epoch===this.epoch&&!this.expired();}
 touch(){if(this.started===null)return;if(this.expired())this.lock();else this.last=this.clock();}
 check(){if(this.started!==null&&this.expired())this.lock();}
 lock(){const token=this.token;this.epoch++;this.key=null;this.token=null;this.last=0;this.started=null;this.clear(token);return token;}
}
