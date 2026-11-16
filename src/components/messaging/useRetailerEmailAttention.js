import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useRetailerEmailAttention() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: alerts = [] } = useQuery({ queryKey: ['retailer-email-alerts'], queryFn: () => base44.entities.RetailerEmailAlert.list('-created_date', 50), enabled: user?.role === 'admin', refetchInterval: 15000, refetchIntervalInBackground: true });
  const [version, setVersion] = useState(0);
  const storageKey = user?.id ? `retailer-email-read:${user.id}` : '';
  const read = useMemo(() => new Set(storageKey ? (localStorage.getItem(storageKey) || '').split('|').filter(Boolean) : []), [storageKey, version]);
  const pending = user?.role === 'admin' ? alerts.filter(alert => !read.has(`${alert.store_id}:${alert.gmail_message_id}`)) : [];
  const markRead = useCallback((storeId, messages) => {
    if (!storageKey) return;
    const current = new Set((localStorage.getItem(storageKey) || '').split('|').filter(Boolean));
    const keys = messages.filter(message => message.incoming).map(message => `${storeId}:${message.id}`);
    if (!keys.some(key => !current.has(key))) return;
    keys.forEach(key => current.add(key));
    localStorage.setItem(storageKey, [...current].slice(-500).join('|'));
    setVersion(value => value + 1);
  }, [storageKey]);
  return { pending, markRead };
}