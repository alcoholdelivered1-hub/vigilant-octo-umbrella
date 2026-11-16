import React, { useState } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import useOrderChat from '@/components/messaging/useOrderChat';
import OrderChatPanel from '@/components/messaging/OrderChatPanel';

// Quick-reply shortcuts keyed by sender role
const QUICK_REPLIES = {
  driver: [
    "What's the gate/entry code?",
    "Substitution OK for this item?",
    "Running ~10 min late",
    "At the store, any updates?",
    "Customer not answering — what should I do?",
  ],
  store: [
    "Entry code: ",
    "Substitution approved ✓",
    "No substitutions — remove that item",
    "Order is ready for pickup",
    "Please call the customer",
  ],
  customer: [
    "What's my ETA?",
    "I'll meet you outside",
    "Please call when you arrive",
    "Gate code: ",
    "Leave at the door please",
  ],
};

/**
 * OrderChat — real-time messaging between driver and store for a given order.
 * Props:
 *   orderId      — the order's id
 *   orderNumber  — display label
 *   senderRole   — "driver" | "store"
 *   senderName   — display name of the current user
 */
export default function OrderChat({ orderId, orderNumber, senderRole, senderName, chatLabel, filterRole }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const channel = senderRole === 'customer' || filterRole === 'customer' ? 'customer_driver' : 'store_driver';
  const chat = useOrderChat({ orderId, senderRole, channel, open });
  const otherRole = chatLabel || (senderRole === 'driver' ? 'Store' : 'Driver');
  const send = async () => { if (await chat.send(text)) setText(''); };
  return <div className="relative">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className={cn('flex items-center gap-1.5 text-xs font-medium transition-colors px-2.5 py-1.5 rounded-lg', chat.unread ? 'bg-muted text-primary border' : 'text-primary hover:bg-primary/10')}>
      <MessageCircle className="w-4 h-4" />Chat with {otherRole}{chat.unread > 0 && <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5">{chat.unread}</span>}<ChevronDown className={cn('w-3.5 h-3.5', open && 'rotate-180')} />
    </button>
    {open && <OrderChatPanel chat={chat} orderNumber={orderNumber} otherRole={otherRole} senderRole={senderRole} text={text} setText={setText} send={send} quickReplies={QUICK_REPLIES[senderRole] || []} close={() => setOpen(false)} />}
  </div>;
}