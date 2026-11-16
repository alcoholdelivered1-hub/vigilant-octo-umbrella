import React from 'react';
import { MessageCircle, Send, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatMessageList from '@/components/messaging/ChatMessageList';

export default function OrderChatPanel({ chat, orderNumber, otherRole, senderRole, text, setText, send, quickReplies, close }) {
  return <div className="mt-2 border rounded-xl bg-background shadow-lg overflow-hidden">
    <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b"><p className="text-xs font-semibold flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-primary" />Order {orderNumber} — {otherRole} Chat</p><button type="button" onClick={close} aria-label="Close chat" className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
    {chat.error && <div role="alert" className="p-3 text-sm text-destructive">{chat.error}<Button type="button" variant="outline" size="sm" onClick={() => chat.retry()} className="ml-2">Retry</Button></div>}
    {chat.notice && <p role="status" className="p-3 text-sm text-muted-foreground">{chat.notice}</p>}
    <ChatMessageList messages={chat.messages} viewerEmail={chat.viewerEmail} senderRole={senderRole} loading={chat.loading} />
    <div className="px-3 py-2 border-t bg-muted/30"><p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1.5"><Zap className="w-3 h-3" />Quick replies</p><div className="flex flex-wrap gap-1">{quickReplies.map((reply,i) => <button key={i} type="button" disabled={!chat.canSend} onClick={() => setText(reply)} className="text-[10px] bg-background border rounded-full px-2.5 py-1 hover:bg-primary/10 disabled:opacity-50">{reply}</button>)}</div></div>
    <div className="flex gap-2 p-2 border-t"><Input aria-label={`Message to ${otherRole}`} className="h-8 text-xs" placeholder="Type a message..." maxLength={2000} value={text} disabled={!chat.canSend || chat.sending} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} autoFocus /><Button type="button" size="sm" className="h-8 px-3" aria-label="Send message" onClick={send} disabled={chat.sending || !chat.canSend || !text.trim()}>{chat.sending ? 'Sending…' : <Send className="w-3.5 h-3.5" />}</Button></div>
  </div>;
}