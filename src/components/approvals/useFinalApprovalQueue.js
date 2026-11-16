import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
const sources = [['RetailerSetupSubmission',{status:'submitted'}],['StoreSetupDocument',{status:'pending_review'}],['RetailerAgreement',{status:'submitted'}]];
export default function useFinalApprovalQueue() {
  const { user } = useAuth(), client = useQueryClient();
  const enabled = user?.role === 'admin';
  const query = useQuery({ queryKey:['final-approval-queue'],enabled,refetchInterval:15000,queryFn:async () => {
    const items = [];
    for (const [entity,filter] of sources) {
      let cursor = null;
      do {
        const page = await base44.entities[entity].filter(filter,{sort:'-created_date',limit:100,cursor});
        items.push(...page.items.filter(r => entity !== 'RetailerAgreement' || !['approved','needs_correction'].includes(r.review_status)).map(r => ({...r,entity,key:`${entity}:${r.id}:${r.submitted_at || r.created_date}`,label:entity === 'RetailerAgreement' ? 'Signed agreement' : entity === 'StoreSetupDocument' ? r.kind.replaceAll('_',' ') : r.step === 'launch' ? 'Final launch review' : `${r.step} step` })));
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
    }
    const linked = new Set(items.filter(i => i.entity === 'RetailerAgreement').map(i => i.document_id).filter(Boolean));
    return items.filter(i => !linked.has(i.id)).sort((a,b) => new Date(b.submitted_at || b.created_date)-new Date(a.submitted_at || a.created_date));
  }});
  const key = `final-approval-seen:${user?.id || ''}`;
  const [seen,setSeen] = useState({});
  useEffect(() => { setSeen(JSON.parse(localStorage.getItem(key) || '{}')); },[key]);
  useEffect(() => {
    if (!enabled) return;
    const off = [...sources.map(([entity]) => entity),'RetailerApprovalAlert'].map(entity => base44.entities[entity].subscribe(() => { client.invalidateQueries({queryKey:['final-approval-queue']}); client.invalidateQueries({queryKey:['final-approval-detail']}); client.invalidateQueries({queryKey:['final-approval-push']}); }));
    return () => off.forEach(fn => fn());
  },[client,enabled]);
  const items = query.data || [], unseen = items.filter(i => !seen[i.key]);
  const markSeen = () => { const next = {...seen,...Object.fromEntries(items.map(i => [i.key,true]))}; localStorage.setItem(key,JSON.stringify(next)); setSeen(next); window.dispatchEvent(new Event('final-approval-seen')); };
  useEffect(() => { const update = () => setSeen(JSON.parse(localStorage.getItem(key) || '{}')); window.addEventListener('final-approval-seen',update); window.addEventListener('storage',update); return () => { window.removeEventListener('final-approval-seen',update); window.removeEventListener('storage',update); }; },[key]);
  return {...query,items,unseen,markSeen};
}