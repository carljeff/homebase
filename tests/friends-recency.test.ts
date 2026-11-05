import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactRecency,compareContactRecency,communicationMetrics,type ContactMessaging} from '../lib/friends.ts';
const now=new Date('2026-11-04T20:00:00Z');
test('recency colors and labels follow elapsed-day boundaries',()=>{
 for(const [days,tone] of [[0,'recent'],[1,'recent'],[7,'recent'],[8,'warm'],[30,'warm'],[31,'distant']] as const){
 const result=contactRecency(new Date(+now-days*86400000).toISOString(),now);
 assert.equal(result.tone,tone);assert.equal(result.days,days);
 }
 assert.equal(contactRecency(now.toISOString(),now).label,'Today');
 assert.equal(contactRecency(new Date(+now-86400000).toISOString(),now).label,'1 day ago');
 for(const missing of [null,'invalid'])assert.equal(contactRecency(missing,now).tone,'unknown');
});
test('unknown first, oldest next, most recently texted last, deterministic name ties',()=>{
 const rows=[{name:'Newest',lastContact:'2026-11-04T20:00:00Z'},{name:'Older',lastContact:'2026-10-01T20:00:00Z'},{name:'Unknown Z',lastContact:null},{name:'Unknown A',lastContact:null}];
 assert.deepEqual(rows.toSorted(compareContactRecency).map(r=>r.name),['Unknown A','Unknown Z','Older','Newest']);
 assert.equal(rows[0].name,'Newest');
});
test('last contact includes incoming and group messages without changing direct outreach',()=>{
 const contact:ContactMessaging={contactId:'11111111-1111-4111-8111-111111111111',direct:{incoming:1,outgoing:1,lastIncoming:'2026-11-02T20:00:00Z',lastOutgoing:'2026-11-01T20:00:00Z'},group:{incoming:1,outgoing:0,lastIncoming:'2026-11-04T20:00:00Z',lastOutgoing:null},days:[]};
 const metrics=communicationMetrics(contact,now);
 assert.equal(metrics.lastInteraction,contact.group.lastIncoming);assert.equal(metrics.lastDirect,contact.direct.lastIncoming);assert.equal(metrics.daysSinceOutgoing,3);
});
