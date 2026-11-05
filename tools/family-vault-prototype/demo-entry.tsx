import {createRoot} from 'react-dom/client';
import Family from '../../app/family';
import {familySchema} from '../../lib/family';
import type {RecordItem} from '../../lib/domain';
import '../../app/globals.css';
const names=['Alex Demo','Robin Demo','Sam Demo','Taylor Demo','Casey Demo'];
const rows=names.map((name,i)=>({id:`${i+1}1111111-1111-4111-a111-111111111111`,kind:'family',version:1,updatedAt:'2026-11-05T12:00:00Z',data:familySchema.parse({name,role:i<2?'parent':'child'})})) as RecordItem[];
createRoot(document.getElementById('root')!).render(<main style={{padding:24,maxWidth:1100,margin:'0 auto'}}><h1>Homebase · synthetic test harness</h1><p>These are fake profiles rendered by the existing Family component. Normal profile writes are disabled here. Open a profile → Secure Vault. No production login or data is used.</p><Family rows={rows} action={async()=>false} busy={false} today="2026-11-05"/></main>);
