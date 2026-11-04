import {ingestMessaging} from '../../../../lib/crm-store';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{return await ingestMessaging(request);}catch{return Response.json({error:'Collector temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
