import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Store, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";

const AGENT_NAME = "retailer_onboarding_assistant";

export default function RetailerOnboardingAssistant() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversations = async () => {
    try {
      const result = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(result || []);
    } catch (err) {
      console.error("Failed to load conversations", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleNewConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: "New Onboarding Session", description: "Retailer onboarding assistant" }
    });
    setActiveConversation(conv);
    setMessages(conv.messages || []);
    setConversations([conv, ...conversations]);
  };

  const handleSelectConversation = async (conv) => {
    const full = await base44.agents.getConversation(conv.id);
    setActiveConversation(full);
    setMessages(full.messages || []);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !activeConversation) return;
    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const updated = await base44.agents.addMessage(activeConversation, {
        role: "user",
        content: userMessage.content
      });
      setMessages(updated.messages || newMessages);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversation sidebar */}
      <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <Button onClick={handleNewConversation} className="w-full" size="sm">
            <MessageSquare className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConversations ? (
              <p className="text-xs text-muted-foreground text-center p-4">Loading...</p>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center p-4">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeConversation?.id === conv.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {conv.metadata?.name || "Untitled"}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Retailer Onboarding Assistant</h1>
            <p className="text-xs text-muted-foreground">Set up stores, manage inventory, and launch retailers</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!activeConversation ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Store className="w-12 h-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Start Onboarding a Retailer</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Create a new session to onboard retailers, set up inventory, configure payments, and launch stores.
              </p>
              <Button onClick={handleNewConversation}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Start New Session
              </Button>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <ReactMarkdown className="text-sm prose prose-sm max-w-none">
                      {msg.content}
                    </ReactMarkdown>
                  )}
                  {msg.tool_calls?.map((toolCall, i) => (
                    <div key={i} className="mt-2 text-xs opacity-70 border-t border-border/50 pt-2">
                      {toolCall.name}: {toolCall.status}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {activeConversation && (
          <div className="px-6 py-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about onboarding a retailer..."
                disabled={loading}
              />
              <Button onClick={handleSendMessage} disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}