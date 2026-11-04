import {establishFriendsOwner} from "../../../../lib/friends-access";
import {getChatGPTUser} from '../../../chatgpt-auth';
import {importMessagingSnapshot} from '../../../../lib/crm-store';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required'},{status:401,headers});
 if(!await establishFriendsOwner(user))return Response.json({error:'Friends access denied'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origin not allowed'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'JSON required'},{status:415,headers});
 if(Number(request.headers.get('content-length')||0)>1000000)return Response.json({error:'File exceeds 1 MB'},{status:413,headers});
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'File required'},{status:400,headers});
 let size=0;const chunks:Uint8Array[]=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();return Response.json({error:'File exceeds 1 MB'},{status:413,headers});}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 try{return Response.json(await importMessagingSnapshot(user.userId,JSON.parse(new TextDecoder().decode(bytes))),{headers});}
 catch{return Response.json({error:'Import rejected. Check that the file is a fresh metadata export, all contacts are opted in, and its device ID matches your active collector. Revoked or other-account collectors cannot be imported.'},{status:400,headers});}
}
