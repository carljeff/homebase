import {test} from 'node:test';import assert from 'node:assert/strict';
import {dashboardFriendReminders,type DashboardSource} from '../lib/friend-dashboard.ts';
import {friendSchema,type ContactMessaging,type MessagingSnapshot} from '../lib/friends.ts';
import type {RecordItem} from '../lib/domain.ts';
const now=new Date('2026-11-05T20:00:00Z');
const friend=(id:string,data={})=>({id,kind:'friend',version:1,updatedAt:now.toISOString(),data:friendSchema.parse({name:id,trackMessaging:true,...data})}) as RecordItem;
const activity=(id:string,last:string|null,groupLast:string|null=null):ContactMessaging=>({contactId:id,direct:{incoming:1,outgoing:1,lastIncoming:last,lastOutgoing:last},group:{incoming:0,outgoing:0,lastIncoming:groupLast,lastOutgoing:null},days:[]});
const source=(contacts:ContactMessaging[],patch:Partial<DashboardSource>={}):DashboardSource=>({enabled:true,lastSuccess:now.toISOString(),snapshot:{generatedAt:now.toISOString(),contacts,quality:{partial:false}} as MessagingSnapshot,...patch});
test('due notes rank before red gaps, recent/group contact and unknown activity do not trigger gaps',()=>{
 const rows=[friend('old'),friend('due',{followUpOn:'2026-11-01',notes:'Ask about their trip',trackMessaging:false}),friend('recent'),friend('group'),friend('unknown')];
 const src=source([activity('old','2026-09-01T12:00:00Z'),activity('recent','2026-11-04T12:00:00Z'),activity('group','2026-09-01T12:00:00Z','2026-11-04T12:00:00Z')]);const before=JSON.stringify(rows);
 const items=dashboardFriendReminders(rows,[src],now);assert.deepEqual(items.map(i=>i.friend.id),['due','old']);assert.equal(items[0].suggestion.key,'follow-up:2026-11-01');assert.match(items[1].suggestion.reason,/direct or group/);assert.equal(JSON.stringify(rows),before);
});
test('red begins after 30 household calendar days and respects opt-out, fresh manual contact and collector health',()=>{
 const rows=[friend('thirty'),friend('red'),friend('off',{trackMessaging:false}),friend('met',{lastInPerson:'2026-11-01'})];const src=source([activity('thirty','2026-10-06T12:00:00Z'),...['red','off','met'].map(id=>activity(id,'2026-10-05T12:00:00Z'))]);
 assert.deepEqual(dashboardFriendReminders(rows,[src],now).map(i=>i.friend.id),['red']);
 for(const stale of [{...src,enabled:false},{...src,lastSuccess:'2026-11-01T12:00:00Z'},{...src,snapshot:{...src.snapshot!,generatedAt:'2026-11-01T12:00:00Z'}},{...src,snapshot:{...src.snapshot!,quality:{...src.snapshot!.quality,partial:true}}}])assert.equal(dashboardFriendReminders(rows,[stale],now).length,0);
 assert.equal(dashboardFriendReminders([friend('due',{followUpOn:'2026-11-05'})],[],now).length,1);
});
test('explicit follow-up dates and stored snoozes/dismissals control timing without repeated red fallbacks',()=>{
 const last='2026-09-01T12:00:00Z',state=(key:string,disposition:'snoozed'|'dismissed'='snoozed',until:string|null='2026-11-08')=>[{key,disposition,until,updatedAt:now.toISOString()}];
 const rows=[friend('future',{followUpOn:'2026-11-10'}),friend('snoozed',{suggestionState:state('dashboard-contact:'+last)}),friend('dismissed',{suggestionState:state('follow-up:2026-11-01','dismissed',null),followUpOn:'2026-11-01'}),friend('expired',{suggestionState:state('dashboard-contact:'+last,'snoozed','2026-11-05')})];
 assert.deepEqual(dashboardFriendReminders(rows,[source(rows.map(r=>activity(r.id,last)))],now).map(i=>i.friend.id),['expired']);
});
