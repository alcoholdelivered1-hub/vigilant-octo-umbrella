import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
const call = async payload => { const { data } = await base44.functions.invoke('retailerAgreement',payload); if (data.error) throw new Error(data.error); return data; };
export default function useRetailerAgreement() {
  const [params,setParams] = useSearchParams(), storeId = params.get('store_id') || '';
  const [form,setForm] = useState({}), [record,setRecord] = useState(null), [accepted,setAccepted] = useState(false);
  const [status,setStatus] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false), [loaded,setLoaded] = useState('');
  const saved = useRef(null), baseline = useRef(''), queue = useRef(Promise.resolve()), activeStore = useRef(storeId);
  activeStore.current = storeId;
  const list = useQuery({ queryKey:['agreement-accessible-stores'],queryFn:() => call({ action:'list' }),retry:false });
  const details = useQuery({ queryKey:['retailer-agreement',storeId],enabled:!!storeId,queryFn:() => call({ action:'get',store_id:storeId }),refetchOnWindowFocus:false,retry:false });
  const select = id => setParams(current => { const next = new URLSearchParams(current); id ? next.set('store_id',id) : next.delete('store_id'); return next; },{ replace:true });
  useEffect(() => { if (!storeId && list.data?.stores.length === 1) select(list.data.stores[0].id); },[list.data,storeId]);
  useEffect(() => {
    if (!details.data || details.data.store.id !== storeId) return;
    const { store,record:current,configuration,controlled_fields,identity_fields,initial_fields } = details.data;
    const values = { ...Object.fromEntries(Object.keys(details.data.fields).map(k => [k,''])),...initial_fields,...current?.fields };
    if (current?.status !== 'submitted') {
      for (const key of controlled_fields) values[key] = configuration?.[key] || '';
      for (const key of identity_fields || []) values[key] = initial_fields[key];
    }
    saved.current = current; baseline.current = JSON.stringify(values); setRecord(current); setForm(values); setAccepted(false); setLoaded(store.id); setError(''); setStatus(current?.status === 'submitted' ? 'Signed original preserved; review is separate.' : `Draft for ${store.name}. Changes save automatically.`);
  },[details.data,details.dataUpdatedAt,storeId]);
  const persist = (action,values = form,extra = {}) => {
    const target = storeId, consent = accepted;
    if (loaded !== target) return Promise.reject(new Error('Wait for this retailer’s agreement to load.'));
    setBusy(true); setError('');
    const task = queue.current.then(() => { if (activeStore.current !== target) throw new Error('The selected retailer changed. Reload its agreement before saving.'); return call({ action,store_id:target,id:saved.current?.id,revision:saved.current?.revision || 0,fields:values,accepted:consent,...extra }); });
    queue.current = task.catch(() => undefined);
    return task.then(async result => {
      if (activeStore.current !== target) return result;
      if (result.record) { saved.current = result.record; setRecord(result.record); baseline.current = JSON.stringify(values); }
      setStatus(action === 'save' ? 'Draft saved for this retailer.' : 'Saved for review. No activation or notification was sent.');
      if (action !== 'save') { setLoaded(''); await details.refetch(); } return result;
    }).catch(e => { if (activeStore.current === target) setError(e?.response?.data?.error || e.message); throw e; }).finally(() => setBusy(false));
  };
  useEffect(() => { if (loaded !== storeId || record?.status === 'submitted' || busy || error || details.data?.ambiguity.length || baseline.current === JSON.stringify(form)) return; const timer = setTimeout(() => persist('save',form).catch(() => {}),1000); return () => clearTimeout(timer); },[form,loaded,storeId,record?.status,busy,error]);
  const chooseStore = async id => { if (busy) return; try { if (loaded === storeId && record?.status !== 'submitted' && baseline.current !== JSON.stringify(form)) await persist('save'); setLoaded(''); setForm({}); setRecord(null); setAccepted(false); saved.current = null; baseline.current = ''; setError(''); setStatus(''); select(id); } catch {} };
  return { storeId,setStoreId:chooseStore,form,update:(key,value) => { setError(''); setForm(f => ({ ...f,[key]:value })); setStatus('Unsaved changes…'); },record,accepted,setAccepted,status,error,busy,isSubmitting:busy,submit:() => persist('submit').catch(() => {}),save:() => persist('save').catch(() => {}),revise:() => persist('revise').catch(() => {}),adminAction:(action,extra) => persist(action,form,extra),stores:list.data?.stores || [],loading:list.isLoading || details.isLoading || (!!storeId && loaded !== storeId),loadError:list.error?.message || details.error?.response?.data?.error || details.error?.message,details:details.data };
}