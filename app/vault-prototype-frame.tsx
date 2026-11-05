"use client";
import {useSyncExternalStore,type ReactNode} from 'react';
const subscribe=()=>()=>{};
const serverSnapshot=()=>false;
const localSnapshot=()=>process.env.NODE_ENV==='development'&&typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname);
export default function VaultPrototypeFrame({profileId,fallback=null}:{profileId:string;fallback?:ReactNode}){
 const local=useSyncExternalStore(subscribe,localSnapshot,serverSnapshot);
 if(!local||!/^([1-5])1111111-1111-4111-a111-111111111111$/.test(profileId))return fallback;
 const profile=profileId;
 return <section className="card"><h2>Synthetic Secure Vault prototype</h2><p>Local test data only. The isolated vault uses fake people and its own membership code and passphrase. No production vault is enabled.</p><iframe key={profile} title="Isolated synthetic family vault" src={`http://127.0.0.1:8790/#${profile}`} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" referrerPolicy="no-referrer" allow="clipboard-write http://127.0.0.1:8790" style={{width:'100%',height:1050,border:'1px solid #cad5c9',borderRadius:12}}/></section>;
}
