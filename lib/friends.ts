import {z} from 'zod';
export const birthdaySchema=z.string().regex(/^\d{2}-\d{2}$/).refine(value=>{const date=new Date('2000-'+value+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(5,10)===value;},'Choose a valid birthday');
export const friendSchema=z.object({name:z.string().trim().min(1).max(100),notes:z.string().max(2000).default(''),birthday:birthdaySchema.nullable().default(null),partner:z.string().trim().max(100).default(''),trackMessaging:z.boolean().default(false),reminderDays:z.number().int().min(1).max(365).nullable().default(null)});
const count=z.number().int().nonnegative().max(10000000);
const timestamp=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
const totals=z.object({incoming:count,outgoing:count,lastIncoming:timestamp.nullable(),lastOutgoing:timestamp.nullable()}).strict();
export const messagingSnapshotSchema=z.object({version:z.literal(1),deviceId:z.string().uuid(),sequence:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),generatedAt:timestamp,reconciledAt:timestamp,contacts:z.array(z.object({contactId:z.string().uuid(),direct:totals,group:totals,days:z.array(z.object({day,directIn:count,directOut:count,groupIn:count,groupOut:count}).strict()).max(181)}).strict()).max(200),quality:z.object({unlinked:count,invalidTimestamp:count,ambiguous:count,unmatched:count,excluded:count,scanned:count,partial:z.boolean()}).strict()}).strict().superRefine((s,ctx)=>{if(new Set(s.contacts.map(c=>c.contactId)).size!==s.contacts.length)ctx.addIssue({code:'custom',message:'Duplicate contacts'});for(const c of s.contacts){if(new Set(c.days.map(d=>d.day)).size!==c.days.length)ctx.addIssue({code:'custom',message:'Duplicate days'});for(const t of [c.direct,c.group]){if((t.incoming===0)!==(t.lastIncoming===null)||(t.outgoing===0)!==(t.lastOutgoing===null))ctx.addIssue({code:'custom',message:'Inconsistent totals'});for(const last of [t.lastIncoming,t.lastOutgoing])if(last&&last>s.generatedAt)ctx.addIssue({code:'custom',message:'Future activity'});}let di=0,doo=0,gi=0,go=0;for(const d of c.days){di+=d.directIn;doo+=d.directOut;gi+=d.groupIn;go+=d.groupOut;if(d.day<new Date(Date.parse(s.generatedAt.slice(0,10)+'T00:00:00Z')-180*86400000).toISOString().slice(0,10))ctx.addIssue({code:'custom',message:'Expired bucket'});if(d.day>s.generatedAt.slice(0,10))ctx.addIssue({code:'custom',message:'Future day'});}if(di>c.direct.incoming||doo>c.direct.outgoing||gi>c.group.incoming||go>c.group.outgoing)ctx.addIssue({code:'custom',message:'Buckets exceed totals'});}});
export type MessagingSnapshot=z.infer<typeof messagingSnapshotSchema>;
export type ContactMessaging=MessagingSnapshot['contacts'][number];
export function communicationMetrics(contact:ContactMessaging,now=new Date()){
 const today=now.toISOString().slice(0,10),dayMs=86400000;
 function window(days:number,offset=0){const end=new Date(Date.parse(today+'T00:00:00Z')-offset*dayMs).toISOString().slice(0,10),start=new Date(Date.parse(end+'T00:00:00Z')-(days-1)*dayMs).toISOString().slice(0,10);return contact.days.filter(d=>d.day>=start&&d.day<=end).reduce((r,d)=>({direct:r.direct+d.directIn+d.directOut,group:r.group+d.groupIn+d.groupOut}),{direct:0,group:0});}
 const lastDirect=[contact.direct.lastIncoming,contact.direct.lastOutgoing].filter((s):s is string=>s!==null).sort().pop()??null;
 const lastAny=[lastDirect,contact.group.lastIncoming,contact.group.lastOutgoing].filter((s):s is string=>s!==null).sort().pop()??null;
 return {lastInteraction:lastAny,lastDirect,daysSinceOutgoing:contact.direct.lastOutgoing?Math.max(0,Math.floor((now.getTime()-Date.parse(contact.direct.lastOutgoing))/dayMs)):null,seven:window(7),thirty:window(30),ninety:window(90),previousThirty:window(30,30)};
}

/** Unknown history comes first; newest observed contact comes last. */
export function compareContactRecency(a:{name:string;lastContact:string|null},b:{name:string;lastContact:string|null}){
 const time=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?Date.parse(value):Number.NEGATIVE_INFINITY;
 const at=time(a.lastContact),bt=time(b.lastContact);
 return (at===bt?0:at<bt?-1:1)||a.name.localeCompare(b.name);
}
export function contactRecency(lastContact:string|null,now=new Date()){
 if(!lastContact||!Number.isFinite(Date.parse(lastContact)))return {tone:'unknown',label:'No contact recorded',days:null};
 const days=Math.max(0,Math.floor((now.getTime()-Date.parse(lastContact))/86400000));
 return {tone:days<=7?'recent':days<=30?'warm':'distant',label:days===0?'Today':days===1?'1 day ago':`${days} days ago`,days};
}

/** Calendar birthdays use the household timezone, without collecting birth years. */
export function upcomingBirthday(birthday:string|null|undefined,now=new Date()){
 if(!birthday||!birthdaySchema.safeParse(birthday).success)return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Indiana/Indianapolis',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now);
 const part=(type:string)=>Number(parts.find(p=>p.type===type)!.value);
 const year=part('year'),today=Date.UTC(year,part('month')-1,part('day'));
 const [month,day]=birthday.split('-').map(Number);
 // Observe February 29 on February 28 in non-leap years.
 const occurrence=(y:number)=>Date.UTC(y,month-1,Math.min(day,new Date(Date.UTC(y,month,0)).getUTCDate()));
 let next=occurrence(year);if(next<today)next=occurrence(year+1);
 const days=Math.round((next-today)/86400000);
 return {days,upcoming:days<=7,label:days===0?'Birthday today':days===1?'Birthday tomorrow':`Birthday in ${days} days`};
}
export function compareFriendPriority(a:{name:string;lastContact:string|null;birthdayDays:number|null},b:{name:string;lastContact:string|null;birthdayDays:number|null}){
 const priority=(days:number|null)=>days!==null&&days<=7?days:Number.POSITIVE_INFINITY;
 const ap=priority(a.birthdayDays),bp=priority(b.birthdayDays);
 return (ap===bp?0:ap<bp?-1:1)||compareContactRecency(a,b);
}
