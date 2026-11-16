import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import ChatMessageList from '@/components/messaging/ChatMessageList';
import useRetailerChat from '@/components/messaging/useRetailerChat';

export default function RetailerChatButton({ storeId, storeName, admin = false }) {
  const [open, setOpen] = useState(false), [text, setText] = useState('');
  const chat = useRetailerChat(storeId, open);
  const send = async e => { e.preventDefault(); if (await chat.send(text)) setText(''); };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" className="gap-1.5"><MessageCircle className="w-4 h-4" />{admin ? 'Chat with Retailer' : 'Chat with Admin'}</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{storeName} — {admin ? 'Retailer Chat' : 'Admin Chat'}</DialogTitle><DialogDescription>Messages between this retailer and the Alcohol Delivered team.</DialogDescription></DialogHeader>
      {chat.error && <div role="alert" className="text-sm text-destructive">{chat.error}<Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => chat.retry()}>Retry</Button></div>}
      {chat.notice && <p role="status" className="text-sm text-muted-foreground">{chat.notice}</p>}
      <ChatMessageList messages={chat.messages || []} viewerEmail={chat.viewer_email} senderRole={chat.sender_role} loading={chat.loading} />
      <form onSubmit={send} className="flex gap-2 border-t pt-3">
        <Input aria-label="Chat message" placeholder="Type a message…" maxLength={2000} value={text} onChange={e => setText(e.target.value)} disabled={!chat.can_send || chat.sending} />
        <Button type="submit" aria-label="Send message" disabled={!chat.can_send || chat.sending || !text.trim()}>{chat.sending ? 'Sending…' : <Send className="w-4 h-4" />}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}