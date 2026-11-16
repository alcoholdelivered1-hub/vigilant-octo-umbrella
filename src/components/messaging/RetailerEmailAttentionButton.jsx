import React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RetailerEmailAttentionButton({ store, pending, onOpen }) {
  const replies = pending.filter(alert => alert.store_id === store.id);
  const count = new Set(replies.map(alert => alert.gmail_message_id)).size;
  return <Button size="sm" variant="outline" className={count ? 'retailer-reply-attention' : ''} aria-label={`${store.name}: Gmail conversations${count ? `, ${count} new retailer replies` : ''}`} onClick={() => onOpen({ storeId: store.id, storeName: store.name, threadId: replies[0]?.thread_id })}>
    <Mail className="w-4 h-4" />Gmail conversations{count > 0 && <span className="font-semibold">· {count} new</span>}
  </Button>;
}