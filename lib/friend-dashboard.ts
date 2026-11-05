import type {RecordItem} from './domain';
import {communicationMetrics,contactRecency,type MessagingSnapshot} from './friends';
import {householdToday,reconnectSuggestions,type ReconnectSuggestion} from './friend-memory';
export type DashboardSource={enabled:boolean;lastSuccess:string|null;snapshot:MessagingSnapshot|null};
export function dashboardFriendReminders(rows:RecordItem[],sources:DashboardSource[],now=new Date()){
 const source=sources.find(s=>s.enabled&&s.snapshot),snapshot=source?.snapshot;
 const reliable=!!snapshot&&!!source?.lastSuccess&&Number.isFinite(Date.parse(source.lastSuccess))&&now.getTime()-Date.parse(source.lastSuccess)<=86400000&&now.getTime()-Date.parse(snapshot.generatedAt)<=86400000&&!snapshot.quality.partial;
 const today=householdToday(now);
 return rows.filter(r=>r.kind==='friend').flatMap(friend=>{
  const activity=friend.data.trackMessaging?snapshot?.contacts.find(c=>c.contactId===friend.id):undefined;
  const followUp=reconnectSuggestions(friend.data,activity,now,reliable).find(s=>s.kind==='follow-up');
  // An explicit follow-up date owns the timing, including its existing snooze/dismissal.
  if(friend.data.followUpOn&&!followUp)return [];
  const last=activity?communicationMetrics(activity,now).lastInteraction:null;
  const recency=contactRecency(last,now);
  const manual=[friend.data.lastInPerson,friend.data.manualLastContact].filter((v):v is string=>!!v&&v<=today).sort().pop();
  // A recent manual meeting/contact prevents an obsolete texting gap from prompting outreach.
  const manualRecent=manual&&Date.parse(today+'T00:00:00Z')-Date.parse(manual+'T00:00:00Z')<=30*86400000;
  const key='dashboard-contact:'+last;
  const hidden=friend.data.suggestionState?.some((s:{key:string;disposition:string;until:string|null})=>s.key===key&&(s.disposition==='dismissed'||!!s.until&&s.until>today));
  const quiet:ReconnectSuggestion|undefined=reliable&&activity&&recency.tone==='distant'&&!manualRecent&&!hidden?{key,kind:'outreach',reason:`Last recorded contact · ${recency.label.toLowerCase()} (direct or group).`}:undefined;
  const suggestion=followUp??quiet;if(!suggestion)return [];
  const note=friend.data.notes||[...(friend.data.relationshipNotes??[])].sort((a:{date:string},b:{date:string})=>b.date.localeCompare(a.date))[0]?.text||'';
  return [{friend,suggestion,lastContact:last,days:recency.days,note}];
 }).sort((a,b)=>Number(b.suggestion.kind==='follow-up')-Number(a.suggestion.kind==='follow-up')||(a.suggestion.kind==='follow-up'&&b.suggestion.kind==='follow-up'?(a.friend.data.followUpOn??'').localeCompare(b.friend.data.followUpOn??''):0)||(b.days??0)-(a.days??0)||a.friend.data.name.localeCompare(b.friend.data.name));
}
