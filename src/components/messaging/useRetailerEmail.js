import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useRetailerEmail(storeId, initialThread) {
  const client = useQueryClient();
  const [threadId, setThreadId] = useState(initialThread || ''), [compose, setCompose] = useState(false);
  const [recipient, setRecipient] = useState(''), [subject, setSubject] = useState(''), [text, setText] = useState('');
  const call = async payload => { const { data } = await base44.functions.invoke('retailerEmail', { store_id: storeId, ...payload }); if (data.error) throw new Error(data.error); return data; };
  const list = useInfiniteQuery({ queryKey: ['retailer-email', storeId, 'threads'], initialPageParam: '', queryFn: ({ pageParam }) => call({ action: 'list', page_token: pageParam }), getNextPageParam: page => page.next_page_token || undefined, refetchInterval: 30000 });
  const contacts = list.data?.pages[0]?.contacts || [];
  const threads = [...new Map((list.data?.pages || []).flatMap(p => p.threads).map(t => [t.id, t])).values()];
  useEffect(() => { if (!threadId && threads[0] && !compose) setThreadId(threads[0].id); }, [threads[0]?.id, threadId, compose]);
  const detail = useQuery({ queryKey: ['retailer-email', storeId, 'thread', threadId], enabled: !!threadId && !compose, queryFn: () => call({ action: 'thread', thread_id: threadId }), refetchInterval: 30000 });
  const mutation = useMutation({ mutationFn: () => call({ action: 'send', thread_id: compose ? undefined : threadId, recipient: recipient || contacts[0], subject, text }), onSuccess: data => { setText(''); setSubject(''); setCompose(false); setThreadId(data.thread_id); client.invalidateQueries({ queryKey: ['retailer-email', storeId] }); } });
  const selectThread = id => { mutation.reset(); setText(''); setSubject(''); setCompose(false); setThreadId(id); };
  const newEmail = () => { mutation.reset(); setText(''); setSubject(''); setCompose(true); };
  return { contacts, threads, threadId, compose, recipient: recipient || contacts[0] || '', setRecipient, subject, setSubject, text, setText, selectThread, newEmail, list, detail, mutation, error: mutation.error?.response?.data?.error || mutation.error?.message || list.error?.response?.data?.error || list.error?.message || detail.error?.response?.data?.error || detail.error?.message };
}