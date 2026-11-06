// Synthetic runtime benchmark only; does not measure Safari or password entropy.
import {wrappingKey} from '../vault/crypto.mjs';
const times=[];
for(let i=0;i<7;i++){const start=performance.now();await wrappingKey('synthetic benchmark passphrase',crypto.getRandomValues(new Uint8Array(16)));times.push(performance.now()-start);}
times.sort((a,b)=>a-b);
process.stdout.write(JSON.stringify({runtime:process.version,algorithm:'PBKDF2-HMAC-SHA256',iterations:600000,samples:times.length,medianMs:Math.round(times[3]),maxMs:Math.round(times[6]),scope:'this Node host only; not a Safari benchmark'})+'\n');
