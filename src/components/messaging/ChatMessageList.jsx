import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ChatMessageList({ messages, viewerEmail, senderRole, loading }) {
  const bottom = useRef(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);
  return <div className="h-52 overflow-y-auto px-3 py-2 space-y-2" role="log" aria-label="Order chat messages" aria-live="polite">
    {loading ? <p role="status" className="text-center text-sm text-muted-foreground py-6">Loading messages…</p> : !messages.length ? <p className="text-center text-xs text-muted-foreground py-6">No messages yet. Use a quick reply below or type your message.</p> : messages.map(msg => {
      const mine = msg.sender_email ? msg.sender_email === viewerEmail : msg.sender_role === senderRole;
      return <div key={msg.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
        <div className={cn('max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words', mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm')}>{msg.text}</div>
        <p className="text-[10px] text-muted-foreground mt-0.5 px-1">{msg.sender_name || msg.sender_role}{msg.created_date ? ` · ${format(new Date(msg.created_date), 'h:mm a')}` : ''}</p>
      </div>;
    })}<div ref={bottom} />
  </div>;
}