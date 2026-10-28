import { getChatGPTUser } from "../../chatgpt-auth";
import { operate } from "../../../lib/operations";
export const dynamic="force-dynamic";
const response=(data:any,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){const user=await getChatGPTUser();if(!user)return response({error:"Sign in required"},401);return response(await operate({action:"list"},user.userId));}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return response({error:"Sign in required"},401);
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return response({error:"Origin not allowed"},403);
 if(!request.headers.get("content-type")?.includes("application/json"))return response({error:"JSON required"},415);
 const body=await request.text();if(body.length>12000000)return response({error:"Request too large"},413);
 try{return response(await operate(JSON.parse(body),user.userId));}catch(e){const message=e instanceof Error?e.message:"Request failed";return response({error:message},message.startsWith("Conflict")?409:400);}
}
