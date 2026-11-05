import {communicationMetrics,upcomingBirthday,type ContactMessaging} from './friends';
import type {MemoryData} from './friend-memory-schema';
export {calendarDate,relationshipNoteSchema,importantDateSchema,relationshipFields} from './friend-memory-schema';
export type {MemoryData} from './friend-memory-schema';
export function householdToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Indiana/Indianapolis',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}-${parts.find(p=>p.type==='day')!.value}`;
}
export function dateGap(from:string,to:string){return Math.floor((Date.parse(to+'T00:00:00Z')-Date.parse(from.slice(0,10)+'T00:00:00Z'))/86400000);}
export function normalizePersonName(value:string){return value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
export function normalizedPhone(value:string){const digits=value.replace(/\D/g,'');return digits.length===10?'1'+digits:digits;}
export function possibleDuplicate(a:MemoryData,b:MemoryData){return normalizePersonName(a.name)===normalizePersonName(b.name)||!!(a.email&&b.email&&a.email.trim().toLowerCase()===b.email.trim().toLowerCase())||!!(a.phone&&b.phone&&normalizedPhone(a.phone)===normalizedPhone(b.phone));}
export function matchesPerson(data:MemoryData,query:string){
 const haystack=normalizePersonName([data.name,data.notes,data.partner,data.meetingPlace,data.metOn,data.howWeMet,data.mutualConnections,data.interests,data.occupation,data.children,data.commonGround,data.phone,data.email,...(data.tags??[]),...(data.relationshipNotes??[]).map(n=>n.text),...(data.importantDates??[]).map(d=>d.label)].filter(Boolean).join(' '));
 return normalizePersonName(query).split(' ').filter(Boolean).every(word=>haystack.includes(word));
}
export function recentlyMet(data:MemoryData,now=new Date()){
 const today=householdToday(now);return [data.metOn,data.createdAt?householdToday(new Date(data.createdAt)):null].some(d=>d&&dateGap(d,today)>=0&&dateGap(d,today)<=90);
}
export function connectedSinceMeeting(data:MemoryData,activity?:ContactMessaging){
 if(!data.metOn)return false;
 return [data.lastInPerson,data.manualLastContact,activity?.direct.lastIncoming?householdToday(new Date(activity.direct.lastIncoming)):null,activity?.direct.lastOutgoing?householdToday(new Date(activity.direct.lastOutgoing)):null].some(d=>d&&d>data.metOn!);
}
export function upcomingDates(data:MemoryData,now=new Date(),window=30){
 const result:{key:string;label:string;days:number;date:string}[]=[];const today=householdToday(now);
 if(data.followUpOn){const days=dateGap(today,data.followUpOn);if(days>=0&&days<=window)result.push({key:'follow-up',label:'Follow up',days,date:data.followUpOn});}
 const birthday=upcomingBirthday(data.birthday,now);if(birthday&&birthday.days<=window)result.push({key:'birthday',label:'Birthday',days:birthday.days,date:new Date(Date.parse(today+'T00:00:00Z')+birthday.days*86400000).toISOString().slice(0,10)});
 for(const event of data.importantDates??[]){let date=event.date;if(event.annual){const recurring=upcomingBirthday(date.slice(5),now)!;date=new Date(Date.parse(today+'T00:00:00Z')+recurring.days*86400000).toISOString().slice(0,10);}const days=dateGap(today,date);if(days>=0&&days<=window)result.push({key:'event:'+event.id+':'+date,label:event.label,days,date});}
 return result.sort((a,b)=>a.days-b.days||a.label.localeCompare(b.label));
}
export type ReconnectSuggestion={key:string;reason:string;kind:'follow-up'|'event'|'recent'|'outreach'|'frequency'};
export function reconnectSuggestions(data:MemoryData,activity:ContactMessaging|undefined,now=new Date(),reliableMessaging=true){
 const today=householdToday(now),suggestions:ReconnectSuggestion[]=[];
 if(data.followUpOn&&data.followUpOn<=today)suggestions.push({key:'follow-up:'+data.followUpOn,kind:'follow-up',reason:`You set a follow-up for ${data.followUpOn}.`});
 if(data.stayConnected){for(const event of upcomingDates(data,now,7))suggestions.push({key:event.key+':'+event.date,kind:'event',reason:`${event.label} ${event.days===0?'is today':event.days===1?'is tomorrow':`is in ${event.days} days`}.`});}
 // Missing/stale metadata cannot establish that a tracked person hasn't been contacted.
 if((data.stayConnected||data.reminderDays)&&(!data.trackMessaging||reliableMessaging&&!!activity)){
  const metrics=activity?communicationMetrics(activity,now):null;
  const lastPersonal=[metrics?.lastDirect?householdToday(new Date(metrics.lastDirect)):null,data.lastInPerson,data.manualLastContact].filter((d):d is string=>!!d).sort().pop();
  const lastOutgoing=[activity?.direct.lastOutgoing?householdToday(new Date(activity.direct.lastOutgoing)):null,data.lastInPerson,data.manualLastContact].filter((d):d is string=>!!d).sort().pop();
  const quiet=lastPersonal?dateGap(lastPersonal,today)>=7:true;
  if(quiet){
   const quietSuggestions:ReconnectSuggestion[]=[];
   const metAge=data.metOn?dateGap(data.metOn,today):null;
   if(data.stayConnected&&metAge!==null&&metAge>=7&&metAge<=90&&!connectedSinceMeeting(data,activity))quietSuggestions.push({key:'recent:'+data.metOn,kind:'recent',reason:`You met on ${data.metOn}; no later direct or in-person contact is recorded.`});
   const anchor=lastOutgoing??(!activity?data.metOn:null);
   if(data.reminderDays&&anchor&&dateGap(anchor,today)>=data.reminderDays)quietSuggestions.push({key:'outreach:'+anchor,kind:'outreach',reason:`No personal outgoing or manually recorded contact since ${anchor}; your interval is ${data.reminderDays} days.`});
   if(data.stayConnected&&metrics&&lastOutgoing&&dateGap(lastOutgoing,today)>=14&&metrics.previousThirty.direct>=4&&metrics.thirty.direct<=metrics.previousThirty.direct/2)quietSuggestions.push({key:'frequency:'+lastOutgoing,kind:'frequency',reason:`Direct messages: ${metrics.thirty.direct} in the last 30 days, down from ${metrics.previousThirty.direct} in the previous 30.`});
   if(quietSuggestions[0])suggestions.push(quietSuggestions[0]);
  }
 }
 return suggestions.filter(s=>!data.suggestionState?.some(state=>state.key===s.key&&(state.disposition==='dismissed'||!!state.until&&state.until>today)));
}
