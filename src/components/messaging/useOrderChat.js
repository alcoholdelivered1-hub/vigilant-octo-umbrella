import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useOrderChat({ orderId, senderRole, channel, open }) {
  const client = useQueryClient(), seen = useRef(null), sendingRef = useRef(false);
  const [unread, setUnread] = useState(0), [sending, setSending] = useState(false), [sendError, setSendError] = useState('');
  const key = ['order-chat', orderId, senderRole, channel];
  const call = async payload => { const { data } = await base44.functions.invoke('orderChat', { order_id: orderId, sender_role: senderRole, channel, ...payload }); if (data.error) throw new Error(data.error); return data; };
  const query = useQuery({ queryKey: key, enabled: !!orderId, queryFn: () => call({ action: 'list' }), refetchInterval: open ? 5000 : 30000 });
  useEffect(() => { seen.current = null; setUnread(0); setSendError(''); }, [orderId, channel]);
  useEffect(() => {
    const messages = query.data?.messages;
    if (!messages) return;
    if (!open && seen.current) setUnread(count => count + messages.filter(m => !seen.current.has(m.id) && m.sender_email !== query.data.viewer_email).length);
    if (open) setUnread(0);
    seen.current = new Set(messages.map(m => m.id));
  }, [query.data, open]);
  useEffect(() => {
    if (!orderId) return;
    return base44.entities.Message.subscribe(event => { if (event.data?.order_id === orderId && (!event.data.channel || event.data.channel === channel)) client.invalidateQueries({ queryKey: key }); });
  }, [orderId, senderRole, channel]);
  const send = async text => {
    if (sendingRef.current || !text.trim()) return false;
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      const result = await call({ action: 'send', text });
      client.setQueryData(key, current => ({ ...current, viewer_email: result.viewer_email, can_send: true, messages: [...(current?.messages || []).filter(m => m.id !== result.message.id), result.message].sort((a,b) => (a.created_date || '').localeCompare(b.created_date || '')) }));
      client.invalidateQueries({ queryKey: key }); return true;
    } catch (error) { setSendError(error.response?.data?.error || error.message || 'Message could not be sent. Please try again.'); return false; }
    finally { sendingRef.current = false; setSending(false); }
  };
  return { messages: query.data?.messages || [], viewerEmail: query.data?.viewer_email, canSend: query.data?.can_send === true, notice: query.data?.notice, loading: query.isLoading, error: sendError || query.error?.response?.data?.error || query.error?.message, sending, unread, send, retry: query.refetch };
}