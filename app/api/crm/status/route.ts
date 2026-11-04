import {establishFriendsOwner} from "../../../../lib/friends-access";
import {getChatGPTUser} from '../../../chatgpt-auth';
import {crmStatus} from '../../../../lib/crm-store';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required'},{status:401});if(!await establishFriendsOwner(user))return Response.json({error:'Friends access denied'},{status:403,headers:{'Cache-Control':'no-store'}});try{return Response.json(await crmStatus(user.userId),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'CRM storage is not configured'},{status:503});}}
