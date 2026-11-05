import {env} from 'cloudflare:workers';
export class FriendsAccessError extends Error {constructor(){super('Friends access is restricted to its owner');}}
function configuredEmail(){const value=(env as unknown as Record<string,unknown>).FRIENDS_OWNER_EMAIL;return typeof value==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())?value.trim().toLowerCase():null;}
async function emailDigest(){const email=configuredEmail();if(!email)return null;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function isFriendsOwner(user:string|undefined|null){if(!user)return false;const digest=await emailDigest();if(!digest)return false;const policy=await env.DB!.prepare('SELECT owner_id,email_digest FROM friends_access WHERE slot=1').first<{owner_id:string;email_digest:string}>();return !!policy&&policy.owner_id===user&&policy.email_digest===digest;}
export async function assertFriendsOwner(user:string|undefined|null){if(!await isFriendsOwner(user))throw new FriendsAccessError();}
// Enrollment is limited to the configured Site owner's verified platform email.
// After binding, the stable Site visitor ID is authoritative; never let another ID claim it.
export async function establishFriendsOwner(user:{userId:string;email:string}){
 if(await isFriendsOwner(user.userId))return true;
 const email=configuredEmail();if(!email||typeof user.email!=='string'||user.email.trim().toLowerCase()!==email)return false;
 await env.DB!.prepare('INSERT OR IGNORE INTO friends_access (slot,owner_id,email_digest,created_at) VALUES (1,?,?,?)').bind(user.userId,await emailDigest(),new Date().toISOString()).run();
 return isFriendsOwner(user.userId);
}
