import {z} from 'zod';
import {measurementSchema,type GrowthMeasurement} from './growth';
import {list} from './store';
import {familySave} from './family-store';
const request=z.object({action:z.enum(['save_family_measurement','archive_family_measurement','restore_family_measurement']),profileId:z.string().uuid(),version:z.number().int().positive(),measurement:z.unknown().optional(),measurementId:z.string().uuid().optional()});
export async function growthOperation(value:unknown,user:string){
 const input=request.parse(value),rows=await list(),profile=rows.find(r=>r.id===input.profileId&&r.kind==='family');if(!profile||profile.data.role!=='child')throw Error('Choose an existing child profile');
 const history:GrowthMeasurement[]=profile.data.measurements??[];
 let measurements:GrowthMeasurement[];
 if(input.action==='save_family_measurement'){const entry=measurementSchema.parse(input.measurement);const existing=history.find(r=>r.id===entry.id);if(existing?.archived)throw Error('Restore this measurement before editing it');const next={...entry,archived:false};measurements=existing?history.map(r=>r.id===entry.id?next:r):[...history,next];}
 else{const id=z.string().uuid().parse(input.measurementId);if(!history.some(r=>r.id===id))throw Error('Measurement unavailable');measurements=history.map(r=>r.id===id?{...r,archived:input.action==='archive_family_measurement'}:r);}
 return familySave('family',{...profile.data,measurements},user,profile.id,input.version);
}
