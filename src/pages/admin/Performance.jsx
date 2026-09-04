import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Truck, DollarSign, Users, AlertTriangle, CheckCircle2, Bot, Send, Loader2 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';

// ── Chat ──────────────────────────────────────────────────────────────────────
function PerformanceChat() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    async function init() {
      const conv = await base44.agents.createConversation({
        agent_name: 'performance_analyst',
        metadata: { name: 'Performance Analysis' },
      });
      setConversation(conv);
      setMessages(conv.messages || []);
    }
    init();
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setSending(false);
    });
    return unsub;
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !conversation || sending) return;
    setSending(true);
    const text = input;
    setInput('');
    await base44.agents.addMessage(conversation, { role: 'user', content: text });
  };

  const suggestions = [
    'What is our overall delivery success rate?',
    'Who are the top performing drivers?',
    'Show me revenue trends this month',
    'How many deliveries were refused and why?',
  ];

  return (
    <div className="bg-card rounded-2xl border flex flex-col h-[500px]">
      <div className="p-4 border-b flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Performance Analyst</p>
          <p className="text-xs text-muted-foreground">Ask anything about your business metrics</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center mb-4">Try asking:</p>
            {suggestions.map((s) => (
              <button key={s} onClick={() => setInput(s)}
                className="w-full text-left text-sm px-3 py-2 rounded-xl border hover:bg-muted transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.filter(m => m.role !== 'system').map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {m.role === 'user' ? m.content : (
                <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {m.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about performance..."
          className="flex-1"
          disabled={!conversation || sending}
        />
        <Button size="icon" onClick={send} disabled={!input.trim() || !conversation || sending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Performance() {
  const { data: orders = [] } = useQuery({
    queryKey: ['perf-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['perf-drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  // ── Order metrics ──
  const delivered = orders.filter(o => o.status === 'delivered');
  const refused = orders.filter(o => o.status === 'refused');
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const completedOrFailed = orders.filter(o => ['delivered', 'refused', 'cancelled'].includes(o.status));
  const successRate = completedOrFailed.length
    ? ((delivered.length / completedOrFailed.length) * 100).toFixed(1)
    : '0.0';

  // Avg delivery time (pickup → delivery confirmed)
  const deliveryTimes = delivered
    .filter(o => o.pickup_confirmed_at && o.delivery_confirmed_at)
    .map(o => (new Date(o.delivery_confirmed_at) - new Date(o.pickup_confirmed_at)) / 60000);
  const avgDeliveryMin = deliveryTimes.length
    ? (deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length).toFixed(0)
    : '–';

  // ── Revenue metrics ──
  const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
  const feesEarned = delivered.reduce((s, o) => {
    const fee = (o.subtotal || 0) * 0.25 + (o.delivery_fee || 0);
    return s + fee;
  }, 0);

  // Last 14 days revenue chart
  const revenueByDay = Array.from({ length: 14 }, (_, i) => {
    const day = startOfDay(subDays(new Date(), 13 - i));
    const dayOrders = delivered.filter(o => {
      const d = startOfDay(new Date(o.created_date));
      return d.getTime() === day.getTime();
    });
    return {
      date: format(day, 'MMM d'),
      revenue: parseFloat(dayOrders.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)),
      orders: dayOrders.length,
    };
  });

  // ── Driver metrics ──
  const driverStats = drivers.map(d => {
    const dOrders = delivered.filter(o => o.driver_id === d.id || o.driver_name === d.name);
    return { name: d.name, deliveries: dOrders.length, status: d.status };
  }).sort((a, b) => b.deliveries - a.deliveries);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Overall Performance</h1>
        <p className="text-muted-foreground mt-1">Orders, drivers, and revenue analytics</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} />
        <StatCard title="Fees Earned" value={`$${feesEarned.toFixed(2)}`} icon={TrendingUp} />
        <StatCard title="Delivery Success" value={`${successRate}%`} icon={CheckCircle2} />
        <StatCard title="Avg Delivery Time" value={avgDeliveryMin === '–' ? '–' : `${avgDeliveryMin}m`} icon={Truck} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={orders.length} icon={Truck} />
        <StatCard title="Delivered" value={delivered.length} icon={CheckCircle2} />
        <StatCard title="Refused" value={refused.length} icon={AlertTriangle} />
        <StatCard title="Active Drivers" value={drivers.filter(d => d.status !== 'offline').length} icon={Users} />
      </div>

      {/* Revenue Chart + AI Chat */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border p-5">
          <h2 className="font-semibold mb-4">Revenue – Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => [`$${v}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <PerformanceChat />
      </div>

      {/* Driver Performance + Orders by Day */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Driver Performance</h2>
            <p className="text-xs text-muted-foreground">Ranked by completed deliveries</p>
          </div>
          <div className="divide-y">
            {driverStats.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground text-sm">No driver data yet</p>
            ) : driverStats.map((d, i) => (
              <div key={d.name} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{d.name}</span>
                </div>
                <span className="font-bold text-sm">{d.deliveries} deliveries</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-5">
          <h2 className="font-semibold mb-4">Orders per Day – Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="orders" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Refusal reasons */}
      {refused.length > 0 && (
        <div className="bg-card rounded-2xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Refused Deliveries Breakdown</h2>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {refused.map(o => (
              <div key={o.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{o.customer_name}</p>
                </div>
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1 max-w-xs text-right">
                  {o.refusal_reason || 'No reason given'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}