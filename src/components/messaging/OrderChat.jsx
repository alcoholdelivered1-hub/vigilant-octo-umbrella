import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Send, X, ChevronDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Load initial messages
  useEffect(() => {
    if (!orderId) return;
    base44.entities.Message.filter({ order_id: orderId }, 'created_date', 100)
      .then(setMessages).catch(() => {});
  }, [orderId]);

  // Real-time subscription
  useEffect(() => {
    if (!orderId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data?.order_id !== orderId) return;
      if (event.type === 'create') {
        setMessages(prev => [...prev, event.data]);
        if (!open && event.data.sender_role !== senderRole) {
          setUnread(u => u + 1);
        }
      }
    });
    return unsub;
  }, [orderId, open, senderRole]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnread(0);
      // Mark incoming as read
      messages
        .filter(m => !m.is_read && m.sender_role !== senderRole)
        .forEach(m => base44.entities.Message.update(m.id, { is_read: true }).catch(() => {}));
    }
  }, [open, messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await base44.entities.Message.create({
        order_id: orderId,
        order_number: orderNumber,
        sender_role: senderRole,
        sender_name: senderName || senderRole,
        text: text.trim(),
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickReplies = QUICK_REPLIES[filterRole || senderRole] || QUICK_REPLIES[senderRole] || [];
  const otherRole = chatLabel || (senderRole === 'driver' ? 'Store' : 'Driver');

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium transition-colors px-2.5 py-1.5 rounded-lg',
          unread > 0
            ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
            : 'text-primary hover:bg-primary/10'
        )}
      >
        <MessageCircle className="w-4 h-4" />
        Chat with {otherRole}
        {unread > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="mt-2 border rounded-xl bg-background shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
              Order {orderNumber} — {otherRole} Chat
            </p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="h-52 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No messages yet. Use a quick reply below or type your message.
              </p>
            ) : (
              messages
                .filter(msg => !filterRole || msg.sender_role === filterRole || msg.sender_role === senderRole)
                .map(msg => {
                const isMe = msg.sender_role === senderRole;
                return (
                  <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                    <div className={cn(
                      'max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    )}>
                      {msg.text}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {msg.sender_name || msg.sender_role}
                      {msg.created_date ? ` · ${format(new Date(msg.created_date), 'h:mm a')}` : ''}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 border-t bg-muted/30">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1.5">
              <Zap className="w-3 h-3" /> Quick replies
            </p>
            <div className="flex flex-wrap gap-1">
              {quickReplies.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => setText(qr)}
                  className="text-[10px] bg-background border rounded-full px-2.5 py-1 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap"
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="flex gap-2 p-2 border-t bg-background">
            <Input
              className="h-8 text-xs"
              placeholder="Type a message..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <Button size="sm" className="h-8 px-3" onClick={handleSend} disabled={sending || !text.trim()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}