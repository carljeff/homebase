import {handleContactRequest} from '../../../../lib/contact-import';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{return await handleContactRequest(request);}catch{return Response.json({error:'Contact request unavailable; retry the same saved plan'},{status:503,headers:{'Cache-Control':'no-store'}});}}
