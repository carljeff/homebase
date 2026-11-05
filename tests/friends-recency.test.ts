import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactRecency,compareContactRecency,communicationMetrics,type ContactMessaging} from '../lib/friends.ts';
const now=new Date('2026-11-04T20:00:00Z');
test('recency colors and labels follow calendar-day boundaries',()=>{
 for(const [days,tone] of [[0,'recent'],[1,'recent'],[7,'recent'],[8,'warm'],[30,'warm'],[31,'distant']] as const){
 const result=contactRecency(new Date(+now-days*86400000).toISOString(),now);
 assert.equal(result.tone,tone);assert.equal(result.days,days);
 }
 assert.equal(contactRecency(now.toISOString(),now).label,'Today');
 assert.equal(contactRecency(new Date(+now-86400000).toISOString(),now).label,'Yesterday');
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

test('last-contact labels cross Indianapolis midnight without waiting 24 hours',()=>{
 const last='2026-11-05T04:30:00Z'; // Nov 4, 11:30 PM in Indianapolis.
 assert.equal(contactRecency(last,new Date('2026-11-05T04:59:00Z')).label,'Today');
 assert.equal(contactRecency(last,new Date('2026-11-05T05:01:00Z')).label,'Yesterday');
 assert.equal(contactRecency('2026-11-04T18:00:00Z',new Date('2026-11-05T13:00:00Z')).days,1);
});
test('calendar recency is stable through year and daylight-saving boundaries',()=>{
 assert.equal(contactRecency('2027-01-01T04:59:00Z',new Date('2027-01-01T05:01:00Z')).label,'Yesterday');
 // The spring DST transition makes this calendar day only 23 hours long.
 assert.equal(contactRecency('2027-03-14T05:30:00Z',new Date('2027-03-15T04:15:00Z')).days,1);
 // Fall-back day can exceed 24 elapsed hours while still being the same local date.
 assert.equal(contactRecency('2026-11-01T04:01:00Z',new Date('2026-11-02T04:59:00Z')).label,'Today');
});
