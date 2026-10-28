import { getChatGPTUser } from "../../../chatgpt-auth";
import { privateImage } from "../../../../lib/cmt-store";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{hash:string}>}){
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin","Content-Security-Policy":"default-src 'none'; sandbox"};
 if(!await getChatGPTUser())return new Response("Sign in required",{status:401,headers});
 const {hash}=await params;const object=await privateImage(hash);if(!object)return new Response("Not found",{status:404,headers});
 return new Response(object.body,{headers:{...headers,"Content-Type":object.httpMetadata?.contentType??"application/octet-stream"}});
}
