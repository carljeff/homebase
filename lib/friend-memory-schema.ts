import {z} from 'zod';
export const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;},'Use a valid calendar date');
const instant=z.string().datetime();
const text=z.string().trim().max(1000).default('');
export const relationshipNoteSchema=z.object({id:z.string().uuid(),date:calendarDate,text:z.string().trim().min(1).max(4000),createdAt:instant,updatedAt:instant}).strict();
export const importantDateSchema=z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(100),date:calendarDate,annual:z.boolean().default(false)}).strict();
export const relationshipFields={
 meetingPlace:text,metOn:calendarDate.nullable().default(null),howWeMet:text,mutualConnections:text,tags:z.array(z.string().trim().min(1).max(60)).max(20).default([]),
 interests:text,occupation:text,children:text,commonGround:text,
 phone:z.string().trim().max(40).refine(v=>!v||(/^[+()\d\s.-]+$/.test(v)&&v.replace(/\D/g,'').length>=7&&v.replace(/\D/g,'').length<=15),'Use a phone number').default(''),
 email:z.union([z.literal(''),z.string().trim().email().max(254)]).default(''),
 importantDates:z.array(importantDateSchema).max(30).refine(items=>new Set(items.map(i=>i.id)).size===items.length,'Duplicate date IDs').default([]),relationshipNotes:z.array(relationshipNoteSchema).max(200).refine(items=>new Set(items.map(i=>i.id)).size===items.length,'Duplicate note IDs').default([]),
 lastInPerson:calendarDate.nullable().default(null),manualLastContact:calendarDate.nullable().default(null),followUpOn:calendarDate.nullable().default(null),
 stayConnected:z.boolean().default(false),createdAt:instant.nullable().default(null),
 suggestionState:z.array(z.object({key:z.string().min(1).max(240),disposition:z.enum(['dismissed','snoozed']),until:calendarDate.nullable(),updatedAt:instant}).strict()).max(100).default([])
};
// Shape shared by search and suggestions; fields are optional for untouched legacy records.
export type MemoryData={name:string;notes?:string;birthday?:string|null;partner?:string;reminderDays?:number|null;trackMessaging?:boolean}&Partial<z.infer<z.ZodObject<typeof relationshipFields>>>;
