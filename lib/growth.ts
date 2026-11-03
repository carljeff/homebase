import {z} from 'zod';
const day=z.string().refine(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'Use a valid measurement date');
export const measurementSchema=z.object({id:z.string().uuid(),date:day,heightCm:z.number().positive().max(300).nullable().default(null),weightKg:z.number().positive().max(500).nullable().default(null),notes:z.string().trim().max(2000).default(''),archived:z.boolean().default(false)}).refine(v=>v.heightCm!==null||v.weightKg!==null,'Enter a height, weight, or both');
export type GrowthMeasurement=z.infer<typeof measurementSchema>;
export const measurementHistorySchema=z.array(measurementSchema).max(1000).default([]).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length,'Measurement IDs must be unique');
export function activeMeasurements(rows:GrowthMeasurement[]=[]){return rows.filter(r=>!r.archived).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));}
export function latestMeasurements(rows:GrowthMeasurement[]=[]){const active=activeMeasurements(rows);return {height:active.find(r=>r.heightCm!==null),weight:active.find(r=>r.weightKg!==null)};}
export function measurementInput(value:string,kind:'height'|'weight',units:'imperial'|'metric'):number|null{
 if(value.trim()==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Error('Measurements must be positive numbers');return units==='metric'?n:kind==='height'?n*2.54:n*0.45359237;
}
export function displayMeasurement(value:number|null,kind:'height'|'weight',units:'imperial'|'metric'){
 if(value===null)return '—';if(units==='metric')return `${Number(value.toFixed(1))} ${kind==='height'?'cm':'kg'}`;
 if(kind==='weight')return `${Number((value/0.45359237).toFixed(1))} lb`;
 const inches=Math.round(value/2.54*10)/10,feet=Math.floor(inches/12),rest=Number((inches-feet*12).toFixed(1));return `${feet}′ ${rest}″ (${inches} in)`;
}
