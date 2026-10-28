import { env } from "cloudflare:workers";
import { schemas, type Kind, type RecordItem } from "./domain";
function db(){if(!env.DB)throw new Error("Database unavailable");return env.DB;}
export async function list(){const r=await db().prepare("SELECT * FROM records ORDER BY updated_at DESC").all<any>();return r.results.map(r=>({id:r.id,kind:r.kind,data:JSON.parse(r.data),version:r.version,updatedAt:r.updated_at})) as RecordItem[];}
export async function save(kind:Kind,data:unknown,user:string,id?:string,version?:number){
 if(!Object.hasOwn(schemas,kind))throw new Error("Invalid record kind");const parsed=schemas[kind].parse(data);const now=new Date().toISOString();
 if(id&&kind==="recipe"){const prior=await db().prepare("SELECT data FROM records WHERE id=? AND kind=? AND version=?").bind(id,kind,version).first<any>();if(!prior)throw new Error("Conflict: refresh before editing again");const old=JSON.parse(prior.data);const {revisions=[],...recipe}=old;(parsed as any).revisions=[...revisions,{savedAt:now,recipe}].slice(-25);}
 if(!id&&kind==="recipe")(parsed as any).revisions=[];
 if(id){if(!Number.isInteger(version))throw new Error("Version required");const result=await db().prepare("UPDATE records SET data=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND kind=? AND version=?").bind(JSON.stringify(parsed),now,user,id,kind,version).run();if(!result.meta.changes)throw new Error("Conflict: refresh before editing again");}
 else {id=crypto.randomUUID();await db().prepare("INSERT INTO records (id,kind,data,version,updated_at,updated_by) VALUES (?,?,?,1,?,?)").bind(id,kind,JSON.stringify(parsed),now,user).run();}
 return {id,kind,data:parsed,version:version?version+1:1,updatedAt:now};
}
export async function remove(id:string,version:number){const r=await db().prepare("DELETE FROM records WHERE id=? AND version=?").bind(id,version).run();if(!r.meta.changes)throw new Error("Conflict: refresh before deleting");}
