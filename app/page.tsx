import { requireChatGPTUser } from "./chatgpt-auth";
import Homebase from "./homebase";
export const dynamic="force-dynamic";
export default async function Page(){await requireChatGPTUser("/");return <Homebase/>;}
