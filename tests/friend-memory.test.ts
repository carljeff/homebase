import {test} from 'node:test';
import assert from 'node:assert/strict';
import {friendSchema,type ContactMessaging} from '../lib/friends.ts';
import {householdToday,matchesPerson,possibleDuplicate,recentlyMet,connectedSinceMeeting,upcomingDates,reconnectSuggestions} from '../lib/friend-memory.ts';
const now=new Date('2026-11-04T20:00:00Z');
const friend=(patch={})=>friendSchema.parse({name:'Synthetic Friend',...patch});
const zero={incoming:0,outgoing:0,lastIncoming:null,lastOutgoing:null};
const activity=(patch:Partial<ContactMessaging>={}):ContactMessaging=>({contactId:'11111111-1111-4111-8111-111111111111',direct:{incoming:5,outgoing:5,lastIncoming:'2026-10-01T12:00:00Z',lastOutgoing:'2026-10-01T12:00:00Z'},group:{...zero},days:[],...patch});
test('legacy Friends fields default safely; keyword search spans all memory fields and notes',()=>{
 const data=friend({meetingPlace:'Cycling race',howWeMet:'Introduced by Morgan',mutualConnections:'Avery',interests:'Camping',occupation:'Healthcare IT',children:'Son Oliver plays soccer',commonGround:'Gravel rides',partner:'Sam',tags:['Outdoors'],notes:'General memory',relationshipNotes:[{id:crypto.randomUUID(),date:'2026-11-01',text:'Plans Colorado trip',createdAt:now.toISOString(),updatedAt:now.toISOString()}]});
 for(const query of ['cycling race','Morgan','Avery','camping','healthcare','Oliver soccer','gravel','Sam','outdoors','general','Colorado trip'])assert.ok(matchesPerson(data,query),query);
 assert.equal(matchesPerson(data,'astronaut'),false);assert.equal(friend().relationshipNotes.length,0);assert.equal(friend().lastInPerson,null);assert.equal(friend().stayConnected,false);
});
test('duplicate checks normalize names, international/US numbers and emails without changing Mac mappings',()=>{
 assert.ok(possibleDuplicate(friend({name:'José Doe'}),friend({name:'Jose  Doe'})));
 assert.ok(possibleDuplicate(friend({name:'A',phone:'(317) 555-0100'}),friend({name:'B',phone:'+1 317-555-0100'})));
 assert.ok(possibleDuplicate(friend({name:'A',email:'Test@example.test'}),friend({name:'B',email:'test@example.test'})));
 assert.equal(possibleDuplicate(friend({name:'A'}),friend({name:'B'})),false);
});
test('Recently Met uses real meeting/creation dates, not edits to legacy records',()=>{
 assert.ok(recentlyMet(friend({metOn:'2026-10-01'}),now));assert.ok(recentlyMet(friend({createdAt:'2026-11-01T12:00:00Z'}),now));
 assert.equal(recentlyMet(friend(),now),false);assert.equal(recentlyMet(friend({metOn:'2026-01-01'}),now),false);
 assert.equal(connectedSinceMeeting(friend({metOn:'2026-10-01'}),activity({direct:{...zero},group:{incoming:1,outgoing:0,lastIncoming:'2026-11-01T12:00:00Z',lastOutgoing:null}})),false);
 assert.ok(connectedSinceMeeting(friend({metOn:'2026-10-01',lastInPerson:'2026-10-10'})));
});
test('important date and birthday occurrences are stable around New Year and leap days',()=>{
 const data=friend({birthday:'01-02',importantDates:[{id:crypto.randomUUID(),label:'Annual gathering',date:'2020-01-03',annual:true},{id:crypto.randomUUID(),label:'Old event',date:'2020-01-01',annual:false}]});
 const dec=upcomingDates(data,new Date('2026-12-30T17:00:00Z')),jan=upcomingDates(data,new Date('2027-01-01T17:00:00Z'));
 assert.deepEqual(dec.map(e=>e.label),['Birthday','Annual gathering']);assert.equal(dec[0].date,'2027-01-02');assert.equal(dec[0].key,jan[0].key);
 assert.equal(householdToday(new Date('2026-11-05T02:00:00Z')),'2026-11-04');
});
test('suggestions are opt-in and explain direct outreach while keeping group messages separate',()=>{
 assert.deepEqual(reconnectSuggestions(friend(),activity(),now),[]);
 const data=friend({trackMessaging:true,reminderDays:14});const a=activity({group:{incoming:3,outgoing:3,lastIncoming:'2026-11-04T12:00:00Z',lastOutgoing:'2026-11-04T12:00:00Z'}});
 assert.ok(reconnectSuggestions(data,a,now).some(s=>s.kind==='outreach'));
 assert.deepEqual(reconnectSuggestions(data,activity({direct:{...a.direct,lastIncoming:'2026-11-03T12:00:00Z'}}),now),[]);
 assert.deepEqual(reconnectSuggestions({...data,lastInPerson:'2026-11-03'},a,now),[]);
 assert.deepEqual(reconnectSuggestions(data,a,now,false),[]);
});
test('manual history supports suggestions without messaging and group-only contact is not a follow-up',()=>{
 const data=friend({metOn:'2026-10-20',stayConnected:true});
 assert.ok(reconnectSuggestions(data,undefined,now).some(s=>s.kind==='recent'));
 assert.deepEqual(reconnectSuggestions({...data,lastInPerson:'2026-11-01'},undefined,now),[]);
 assert.ok(reconnectSuggestions(friend({manualLastContact:'2026-10-01',reminderDays:14}),undefined,now).some(s=>s.kind==='outreach'));
 const group=activity({direct:{...zero},group:{incoming:1,outgoing:1,lastIncoming:'2026-11-03T12:00:00Z',lastOutgoing:'2026-11-03T12:00:00Z'}});
 assert.ok(reconnectSuggestions(data,group,now).some(s=>s.kind==='recent'));
});
test('frequency suggestions need a meaningful decline and recent contact suppresses them',()=>{
 const data=friend({stayConnected:true});const a=activity({days:[{day:'2026-09-20',directIn:4,directOut:4,groupIn:0,groupOut:0},{day:'2026-10-20',directIn:1,directOut:0,groupIn:20,groupOut:20}]});
 assert.ok(reconnectSuggestions(data,a,now).some(s=>s.kind==='frequency'));
 assert.equal(reconnectSuggestions(data,activity({...a,direct:{...a.direct,lastOutgoing:'2026-11-03T12:00:00Z'}}),now).length,0);
});
test('dismissed cause stays dismissed, snoozes expire, follow-ups and dates are explicit',()=>{
 const data=friend({followUpOn:'2026-11-04'}),key='follow-up:2026-11-04';assert.equal(reconnectSuggestions(data,undefined,now)[0].kind,'follow-up');
 const dismissed={...data,suggestionState:[{key,disposition:'dismissed' as const,until:null,updatedAt:now.toISOString()}]};assert.deepEqual(reconnectSuggestions(dismissed,undefined,new Date('2026-11-20T20:00:00Z')),[]);
 const snoozed={...data,suggestionState:[{key,disposition:'snoozed' as const,until:'2026-11-11',updatedAt:now.toISOString()}]};assert.deepEqual(reconnectSuggestions(snoozed,undefined,now),[]);assert.equal(reconnectSuggestions(snoozed,undefined,new Date('2026-11-11T20:00:00Z')).length,1);
 assert.equal(reconnectSuggestions(friend({notes:'Follow up next week'}),undefined,now).length,0);
});

test('unknown matching history suppresses inactivity suggestions and recent creation uses local dates',()=>{
 assert.deepEqual(reconnectSuggestions(friend({trackMessaging:true,metOn:'2026-10-20',stayConnected:true,reminderDays:7}),undefined,now,true),[]);
 assert.ok(recentlyMet(friend({createdAt:'2026-11-05T02:00:00Z'}),now));
 const data=friend({metOn:'2026-10-20',stayConnected:true,reminderDays:7});
 const suggestion=reconnectSuggestions(data,undefined,now)[0];assert.equal(suggestion.kind,'recent');
 assert.deepEqual(reconnectSuggestions({...data,suggestionState:[{key:suggestion.key,disposition:'dismissed',until:null,updatedAt:now.toISOString()}]},undefined,now),[]);
});
