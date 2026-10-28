import { getChatGPTUser } from "../chatgpt-auth";
import { operate } from "../../lib/operations";
export const dynamic="force-dynamic";
const tools=[{name:"homebase_list",description:"Read the shared household recipes, meal plan, groceries, settings, and projects.",inputSchema:{type:"object",properties:{}}},{name:"homebase_write",description:"Create/update a recipe, meal, grocery, project, date, highlight or settings record. For updates include current id and version from homebase_list. Ask the user to approve the intended changes.",inputSchema:{type:"object",properties:{action:{type:"string",enum:["save","generate_groceries","import_recipes"]},kind:{type:"string",enum:["recipe","meal","grocery","project","date","highlight","settings"]},data:{type:"object"},id:{type:"string"},version:{type:"integer"},start:{type:"string"},end:{type:"string"},recipes:{type:"array",items:{type:"object"}}},required:["action"]}}];
export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});let rpc:any;try{const body=await request.text();if(body.length>200000)throw new Error("Request too large");rpc=JSON.parse(body);let result:any;
 if(rpc.method==="server/discover")result={supportedVersions:["2026-07-28"],capabilities:{tools:{}}};
 else if(rpc.method==="tools/list")result={tools};
 else if(rpc.method==="tools/call"){const name=rpc.params?.name;if(!tools.some(t=>t.name===name))throw new Error("Unknown tool");const args=rpc.params.arguments??{};if(name==="homebase_write"&&!["save","generate_groceries","import_recipes"].includes(args.action))throw new Error("Unsupported action");const value=await operate(name==="homebase_list"?{action:"list"}:args,user.userId);result={content:[{type:"text",text:JSON.stringify(value)}]};}
 else return Response.json({jsonrpc:"2.0",id:rpc.id??null,error:{code:-32601,message:"Method not found"}});
 return Response.json({jsonrpc:"2.0",id:rpc.id??null,result});
 }catch(e){return Response.json({jsonrpc:"2.0",id:rpc?.id??null,result:{isError:true,content:[{type:"text",text:e instanceof Error?e.message:"Request failed"}]}});}}
