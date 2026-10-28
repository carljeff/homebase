/** Phase 1 only. Vault storage and retrieval are deliberately not implemented. */
export const ordinaryKinds=['recipe','meal','grocery','project','date','highlight','settings','meal_event','family','wishlist'] as const;
const reserved=/^(vault.*|secretvalue|secretfields|ciphertext|encryptedvalue|encrypteddata|encryptionkey|passportnumber|knowntravelernumber|driverslicensenumber|insurance(memberid|groupnumber|policynumber)|socialsecuritynumber|ssn|recoverycodes)$/i;
function reservedKey(key:string){return reserved.test(key.replace(/[^a-z0-9]/gi,''));}
export function assertOrdinaryInput(input:unknown):void{
 function inspect(value:unknown,depth=0){
  if(depth>100)throw new Error('Request structure too deep');
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){if(reservedKey(key))throw new Error('Secure storage is not enabled. Vault fields are not accepted by Homebase.');inspect(child,depth+1);}
 }
 if(input&&typeof input==='object'){
  const p=input as any;
  if(typeof p.kind==='string'&&!ordinaryKinds.includes(p.kind))throw new Error('Record kind is not supported');
  if(typeof p.action==='string'&&/^vault/i.test(p.action))throw new Error('Secure storage is not enabled');
 }
 inspect(input);
}
// Defense in depth for legacy/foreign rows with unsupported embedded properties.
// This is structural exclusion, not a detector for identifiers pasted into ordinary prose.
export function withoutVaultFields(value:any,depth=0):any{
 if(depth>100)return null;
 if(Array.isArray(value))return value.map(v=>withoutVaultFields(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!reservedKey(k)).map(([k,v])=>[k,withoutVaultFields(v,depth+1)]));
 return value;
}
