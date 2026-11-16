import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useRetailerActivation(storeId) {
  const [agreed, setAgreed] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const request = async event => {
    event.preventDefault();
    if (!agreed || running || !storeId) return;
    setRunning(true); setError(''); setResult(null);
    try {
      const { data } = await base44.functions.invoke('retailerGoLive', { store_id: storeId, action: 'request_activation', consent: true });
      if (data?.error) throw new Error(data.error);
      if (typeof data?.activated !== 'boolean' || !Array.isArray(data?.blockers)) throw new Error('Activation could not be confirmed. Please try again.');
      setResult(data);
      if (data.activated) await Promise.all(['owner-stores', 'retailer-stores', 'onboarding-hub-stores', 'stores'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (error) {
      setError(error?.response?.data?.error || error.message || 'Activation request failed. Please try again.');
    } finally {
      setRunning(false);
    }
  };
  return { agreed, setAgreed, running, result, error, request };
}