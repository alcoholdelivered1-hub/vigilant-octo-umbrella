import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useRetailerChat(storeId, open) {
  const client = useQueryClient(), sendingRef = useRef(false);
  const [sending, setSending] = useState(false), [sendError, setSendError] = useState('');
  const key = ['retailer-chat', storeId];
  const call = async payload => { const { data } = await base44.functions.invoke('retailerChat', { store_id: storeId, ...payload }); if (data.error) throw new Error(data.error); return data; };
  const query = useQuery({ queryKey: key, enabled: open && !!storeId, queryFn: () => call({ action: 'list' }), refetchInterval: open ? 5000 : false });
  useEffect(() => {
    if (!open || !storeId) return;
    return base44.entities.RetailerMessage.subscribe(event => { if (event.data?.store_id === storeId) client.invalidateQueries({ queryKey: key }); });
  }, [open, storeId, client]);
  const send = async text => {
    if (sendingRef.current || !text.trim()) return false;
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      const result = await call({ action: 'send', text });
      client.setQueryData(key, current => ({ ...current, ...result, messages: [...(current?.messages || []).filter(m => m.id !== result.message.id), result.message] }));
      client.invalidateQueries({ queryKey: key }); return true;
    } catch (error) { setSendError(error.response?.data?.error || error.message || 'Could not send your message. Please try again.'); return false; }
    finally { sendingRef.current = false; setSending(false); }
  };
  return { ...query.data, loading: query.isLoading, error: sendError || query.error?.response?.data?.error || query.error?.message, sending, send, retry: query.refetch };
}