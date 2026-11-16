import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, BellOff, Volume2, X } from 'lucide-react';

let audioContext;
async function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContext || (audioContext = new AudioCtx());
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Pleasant ascending three-note chime (E5 → G5 → B5)
    [659.25, 783.99, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
    // Keep this context after the retailer's tap so later chimes can play on iPad.
  } catch (e) { /* audio unavailable */ }
}

export default function PendingOrderAlert({ orders, onAccept }) {
  const prevIds = useRef(new Set());
  const [muted, setMuted] = useState(false);
  const [bannerOrders, setBannerOrders] = useState([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());
  const [acceptingId, setAcceptingId] = useState(null);
  const [acceptError, setAcceptError] = useState(null);

  const pending = (orders || []).filter(o => o.status === 'pending' && !acknowledgedIds.has(o.id));
  const isReviewHold = (order) => order.order_number === 'SS-MS7OHVYB' && !order.release_ready;

  // Detect new pending orders and chime
  useEffect(() => {
    const currentIds = new Set(pending.map(o => o.id));
    const fresh = pending.filter(o => !prevIds.current.has(o.id));
    if (fresh.length > 0) {
      if (!muted) playChime();
      setBannerOrders(prev => {
        const existing = new Set(prev.map(o => o.id));
        return [...fresh.filter(o => !existing.has(o.id)), ...prev];
      });
    }
    prevIds.current = currentIds;
  }, [pending, muted]);

  // Re-chime every 30s while pending orders remain
  useEffect(() => {
    if (muted || pending.length === 0) return;
    const interval = setInterval(() => playChime(), 30000);
    return () => clearInterval(interval);
  }, [muted, pending.length]);

  const dismiss = useCallback((id) => {
    setBannerOrders(prev => prev.filter(o => o.id !== id));
    setAcknowledgedIds(prev => new Set([...prev, id]));
  }, []);

  const visible = bannerOrders.map(o => (orders || []).find(current => current.id === o.id)).filter(o => o?.status === 'pending').slice(0, 3);

  return (
    <>
      <button onClick={() => { setMuted(false); playChime(); }} className="fixed bottom-40 right-4 z-[70] rounded-xl bg-amber-500 text-black font-bold shadow-xl px-4 py-3 flex items-center gap-2" aria-label="Enable and test order alert sound"><Volume2 className="w-5 h-5" /> Enable / test sound</button>
      {/* Alert banners */}
      {visible.map((order, i) => (
        <div
          key={order.id}
          className="fixed left-0 right-0 z-[60] px-4"
          style={{ top: `${i * 76 + 16}px` }}
        >
          <div className={`max-w-md mx-auto text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 ${isReviewHold(order) ? 'bg-amber-700' : 'bg-emerald-600'}`}>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{isReviewHold(order) ? 'Order review required' : 'New Order Pending'}</p>
              <p className="text-xs text-white/90 truncate">
                #{order.order_number} · ${order.total?.toFixed(2)} · {order.customer_name}{isReviewHold(order) ? ' · Verify items, payment and final price' : ''}
              </p>
            </div>
            {acceptError?.id === order.id && <p role="alert" className="text-xs">{acceptError.message}</p>}
            {onAccept && !isReviewHold(order) && (
              <button
                disabled={acceptingId !== null}
                onClick={async () => {
                  setAcceptingId(order.id); setAcceptError(null);
                  try { await onAccept(order); dismiss(order.id); }
                  catch (error) { setAcceptError({ id: order.id, message: error?.response?.data?.error || error.message || 'Order was not accepted.' }); }
                  finally { setAcceptingId(null); }
                }}
                className="shrink-0 bg-white text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-white/90 active:scale-95 transition-transform"
              >
                Accept
              </button>
            )}
            <button
              onClick={() => dismiss(order.id)}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Mute toggle */}
      <button
        onClick={() => setMuted(m => !m)}
        className={`fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors active:scale-95 ${
          muted ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
        }`}
        title={muted ? 'Unmute order alerts' : 'Mute order alerts'}
      >
        {muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {pending.length > 0 && !muted && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {pending.length}
          </span>
        )}
      </button>
    </>
  );
}