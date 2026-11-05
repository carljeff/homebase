import {isFriendsOwner,assertFriendsOwner} from "./friends-access";
import {ordinaryKinds,assertOrdinaryInput,withoutVaultFields} from "./vault-boundary";
import { listImported,saveImported,archiveImported } from "./cmt-store";
import { env } from "cloudflare:workers";
import { schemas, type Kind, type RecordItem } from "./domain";
const kindsSql=ordinaryKinds.map(()=>"?").join(",");
function db(){if(!env.DB)throw new Error("Database unavailable");return env.DB;}
export async function list(user?:string){const kinds=await isFriendsOwner(user)?ordinaryKinds:ordinaryKinds.filter(k=>k!=="friend");const r=await db().prepare(`SELECT * FROM records WHERE kind IN (${kinds.map(()=>"?").join(",")}) ORDER BY updated_at DESC`).bind(...kinds).all<any>();return [...await listImported(),...r.results.map(r=>({id:r.id,kind:r.kind,data:withoutVaultFields(JSON.parse(r.data)),version:r.version,updatedAt:r.updated_at}))] as RecordItem[];}
export async function save(kind:Kind,data:unknown,user:string,id?:string,version?:number){
 if(kind==="friend")await assertFriendsOwner(user);
 assertOrdinaryInput({kind,data});
 if(!Object.hasOwn(schemas,kind))throw new Error("Invalid record kind");const parsed=schemas[kind].parse(data);const now=new Date().toISOString();
 if(id&&kind==="recipe"){const imported=await saveImported(id,parsed,user,version!);if(imported)return imported;const prior=await db().prepare("SELECT data FROM records WHERE id=? AND kind=? AND version=?").bind(id,kind,version).first<any>();if(!prior)throw new Error("Conflict: refresh before editing again");const old=JSON.parse(prior.data);const {revisions=[],...recipe}=old;(parsed as any).revisions=[...revisions,{savedAt:now,recipe}].slice(-25);}
 if(!id&&kind==="recipe")(parsed as any).revisions=[];
 if(id){if(!Number.isInteger(version))throw new Error("Version required");const result=await db().prepare("UPDATE records SET data=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND kind=? AND version=?").bind(JSON.stringify(parsed),now,user,id,kind,version).run();if(!result.meta.changes)throw new Error("Conflict: refresh before editing again");}
 else {id=crypto.randomUUID();await db().prepare("INSERT INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,?,?,1,?,?)").bind(id,kind,JSON.stringify(parsed),now,user).run();}
 return {id,kind,data:parsed,version:version?version+1:1,updatedAt:now};
}
export async function remove(id:string,version:number,user?:string){const target=await db().prepare("SELECT kind FROM records WHERE id=?").bind(id).first<{kind:string}>();if(target?.kind==="friend")await assertFriendsOwner(user);if(await archiveImported(id,version))return;const r=await db().prepare(`DELETE FROM records WHERE id=? AND version=? AND kind IN (${kindsSql})`).bind(id,version,...ordinaryKinds).run();if(!r.meta.changes)throw new Error("Conflict: refresh before deleting");}
