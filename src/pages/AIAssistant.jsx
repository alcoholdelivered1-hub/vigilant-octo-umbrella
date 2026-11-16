import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AssistantMessageBubble from '@/components/assistant/AssistantMessageBubble';
import { Plus, Loader2, Bot, History, Send } from 'lucide-react';
import { toast } from 'sonner';

const AGENT_NAME = 'ai_assistant';

const SUGGESTIONS = [
  'Summarize Arkansas ABC rules for third-party alcohol delivery',
  'Draft a friendly order confirmation message for customers',
  'Give me ideas to recruit more drivers in Pine Bluff',
];

export default function AIAssistant() {
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const pendingCountRef = useRef(null);
  const skipInitialLoadRef = useRef(false);

  useEffect(() => {
    base44.agents.listConversations({ agent_name: AGENT_NAME })
      .then(res => setConversations(Array.isArray(res) ? res : res?.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = conversation?.id;
    if (!id) return;
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
    } else {
      base44.agents.getConversation(id)
        .then(conv => setMessages(conv?.messages || []))
        .catch(() => {});
    }
    const unsubscribe = base44.agents.subscribeToConversation(id, data => setMessages(data?.messages || []));
    return unsubscribe;
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    if (busy && pendingCountRef.current !== null && lastMessage?.role === 'assistant' && messages.length > pendingCountRef.current) {
      pendingCountRef.current = null;
      setBusy(false);
    }
  }, [messages, busy, lastMessage]);

  const startConversation = async (name = 'New conversation') => {
    try {
      const conv = await Promise.resolve(base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name },
      }));
      skipInitialLoadRef.current = true;
      setConversation(conv);
      setConversations(prev => [conv, ...prev]);
      return conv;
    } catch {
      toast.error('Could not start a new conversation.');
      return null;
    }
  };

  const startNewConversation = async () => {
    setHistoryOpen(false);
    setMessages([]);
    await startConversation();
  };

  const openConversation = conv => {
    setConversation(conv);
    setHistoryOpen(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    let conv = conversation;
    try {
      if (!conv) {
        conv = await startConversation(text.slice(0, 60));
        if (!conv) { setBusy(false); return; }
      }
      setMessages(prev => {
        pendingCountRef.current = prev.length + 1;
        return [...prev, { role: 'user', content: text }];
      });
      await base44.agents.addMessage(conv, { role: 'user', content: text });
    } catch {
      setBusy(false);
      toast.error('Message failed to send. Please try again.');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4">
      <div className="flex items-center justify-between gap-2 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-none">Codex</h1>
            <p className="text-xs text-muted-foreground">AI assistant</p>
          </div>
        </div>
        <div className="flex gap-2">
          {conversations.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(value => !value)} aria-expanded={historyOpen}>
              <History className="h-4 w-4" />History
            </Button>
          )}
          <Button size="sm" onClick={startNewConversation}><Plus className="h-4 w-4" />New chat</Button>
        </div>
      </div>

      {historyOpen && (
        <div className="mb-3 max-h-56 overflow-y-auto rounded-xl border bg-card p-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              type="button"
              onClick={() => openConversation(conv)}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm ${conversation?.id === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <span className="truncate">{conv.metadata?.name || conv.name || 'Conversation'}</span>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                {conv.updated_date ? new Date(conv.updated_date).toLocaleDateString() : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex h-[calc(100dvh-16rem)] flex-col overflow-hidden rounded-2xl border bg-card md:h-[calc(100dvh-12rem)]">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!conversation && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold">How can I help?</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ask me anything about your alcohol delivery business — compliance, orders, marketing, driver ops, and more.
              </p>
              <Button onClick={startNewConversation} className="mt-1"><Plus className="h-4 w-4" />Start a new chat</Button>
              <div className="mt-4 w-full max-w-md space-y-2">
                {SUGGESTIONS.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={startNewConversation}
                    className="w-full rounded-xl border px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {conversation && messages.map((message, idx) => <AssistantMessageBubble key={idx} message={message} />)}
          {conversation && busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {conversation && (
          <div className="flex items-end gap-2 border-t p-3">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Codex anything…"
              rows={1}
              className="max-h-32 resize-none"
              aria-label="Message Codex"
            />
            <Button size="icon" onClick={send} disabled={!input.trim() || busy} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="h-6" />
    </div>
  );
}