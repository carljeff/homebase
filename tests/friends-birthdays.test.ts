import {test} from 'node:test';
import assert from 'node:assert/strict';
import {friendSchema,upcomingBirthday,compareFriendPriority} from '../lib/friends.ts';
const now=new Date('2026-11-04T20:00:00Z');
test('birthday and partner are optional and validate without a birth year',()=>{
 const legacy=friendSchema.parse({name:'Legacy'});assert.equal(legacy.birthday,null);assert.equal(legacy.partner,'');
 assert.equal(friendSchema.parse({name:'Friend',birthday:'02-29',partner:' Partner '}).partner,'Partner');
 for(const birthday of ['02-30','04-31','00-01','13-01','11-00','1-01','2026-11-04',''])assert.equal(friendSchema.safeParse({name:'Friend',birthday}).success,false,birthday);
 assert.equal(friendSchema.safeParse({name:'Friend',partner:'x'.repeat(101)}).success,false);
});
test('birthday priority includes today through seven calendar days, never an expired birthday',()=>{
 assert.equal(upcomingBirthday('11-04',now)?.label,'Birthday today');assert.equal(upcomingBirthday('11-05',now)?.label,'Birthday tomorrow');
 assert.equal(upcomingBirthday('11-11',now)?.upcoming,true);assert.equal(upcomingBirthday('11-12',now)?.upcoming,false);
 assert.equal(upcomingBirthday('11-03',now)?.upcoming,false);
 assert.equal(upcomingBirthday(null,now),null);assert.equal(upcomingBirthday('bogus',now),null);
});
test('calendar boundaries use Indianapolis time and handle new year, DST and leap days',()=>{
 assert.equal(upcomingBirthday('01-02',new Date('2026-12-30T20:00:00Z'))?.days,3);
 assert.equal(upcomingBirthday('11-04',new Date('2026-11-05T02:00:00Z'))?.days,0);
 assert.equal(upcomingBirthday('03-10',new Date('2027-03-07T17:00:00Z'))?.days,3);
 assert.equal(upcomingBirthday('02-29',new Date('2027-02-27T17:00:00Z'))?.days,1);
 assert.equal(upcomingBirthday('02-29',new Date('2028-02-28T17:00:00Z'))?.days,1);
});
test('upcoming birthdays sort first by soonest birthday; remaining contacts retain recency order',()=>{
 const person=(name:string,birthdayDays:number|null,lastContact:string|null)=>({name,birthdayDays,lastContact});
 const contacts=[person('Recent',null,'2026-11-04T20:00:00Z'),person('Seven days',7,'2026-11-04T20:00:00Z'),person('Old',8,'2026-09-01T20:00:00Z'),person('Today',0,'2026-11-04T20:00:00Z'),person('Unknown',null,null)];
 assert.deepEqual(contacts.toSorted(compareFriendPriority).map(p=>p.name),['Today','Seven days','Unknown','Old','Recent']);
});
