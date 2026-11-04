import {establishFriendsOwner} from "../lib/friends-access";
import { requireChatGPTUser } from "./chatgpt-auth";
import Homebase from "./homebase";
export const dynamic="force-dynamic";
export default async function Page(){const user=await requireChatGPTUser("/");const friendsEnabled=await establishFriendsOwner(user);return <Homebase friendsEnabled={friendsEnabled}/>;}
