import React from 'react';
import { Link } from 'react-router-dom';

export default function RichardOrderHold({ order }) {
  if (order.order_number !== 'SS-MS7OHVYB' || order.release_ready) return null;
  const openChat = () => {
    const chat = document.getElementById(`order-chat-${order.id}`);
    if (chat) { chat.open = true; chat.scrollIntoView({ block: 'nearest' }); chat.querySelector('summary')?.focus(); }
  };
  return (
    <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-2" aria-label="Richard’s fulfillment requirements">
      <h3 className="font-semibold">Richard’s order needs reconciliation</h3>
      <p>The $40.63 is recorded as paid, but the original payment must be verified. Do not charge again, substitute items, or dispatch before release.</p>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">{(order.release_blockers || ['Confirm payment, item identity, final pricing and store readiness with operations.']).map((blocker, index) => <li key={index}>{blocker}</li>)}</ul>
      <div className="flex flex-wrap gap-4">
        <Link to={`/onboarding?store_id=${encodeURIComponent(order.store_id)}`} className="text-primary underline underline-offset-4">Complete store setup</Link>
        <button type="button" onClick={openChat} className="text-primary underline underline-offset-4">Discuss exact items and price with Richard</button>
      </div>
    </section>
  );
}