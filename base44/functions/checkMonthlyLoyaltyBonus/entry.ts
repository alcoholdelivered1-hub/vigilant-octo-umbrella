/**
 * Monthly Loyalty Bonus Check
 *
 * Counts each customer's orders placed in the current calendar month. When a
 * customer crosses MORE_THAN 5 orders, awards a fixed loyalty-point bonus
 * (same `loyalty_points` field that `awardLoyaltyPoints` manages) and sends a
 * congratulatory message to that customer via the `delivery_tracker` agent.
 *
 * Dedup: the `loyalty_bonus_month` field on the User records the YYYY-MM of the
 * last awarded bonus, so each customer receives the bonus at most once per month.
 *
 * Awards directly to `loyalty_points` rather than invoking `awardLoyaltyPoints`
 * because that function is per-delivery-order and also inflates
 * `loyalty_total_spent`; a synthetic bonus order would corrupt that total.
 *
 * POST body (optional, for testing): { month: "2026-08" }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

const BONUS_POINTS = 500;
const MONTHLY_THRESHOLD = 5;
const EXCLUDED_STATUSES = ['cancelled', 'refused'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Service-role automation — no interactive user; allow if no user present.
  const currentUser = await base44.auth.me().catch(() => null);
  if (currentUser && currentUser.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const now = new Date();
  const monthKey =
    body.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    return Response.json({ error: 'Invalid month key (expected YYYY-MM)' }, { status: 400 });
  }
  const monthStart = new Date(Date.UTC(y, m - 1, 1));

  // Pull recent orders (newest first) and keep only this month's, excluding cancelled/refused.
  const orders = await base44.asServiceRole.entities.Order.list('-created_date', 5000);
  const monthOrders = orders.filter((o) => {
    if (!o.created_date) return false;
    if (EXCLUDED_STATUSES.includes(o.status)) return false;
    return new Date(o.created_date) >= monthStart;
  });

  // Tally per customer.
  const counts = {};
  for (const o of monthOrders) {
    if (!o.customer_email) continue;
    counts[o.customer_email] = (counts[o.customer_email] || 0) + 1;
  }

  const qualifying = Object.entries(counts).filter(([, c]) => c > MONTHLY_THRESHOLD);

  const awarded = [];
  const skipped = [];

  for (const [email, count] of qualifying) {
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) {
      skipped.push({ email, reason: 'user not registered' });
      continue;
    }
    const user = users[0];

    if (user.loyalty_bonus_month === monthKey) {
      skipped.push({ email, reason: 'already awarded this month' });
      continue;
    }

    const newTotal = (user.loyalty_points || 0) + BONUS_POINTS;

    // Award the bonus (same loyalty_points field awardLoyaltyPoints manages).
    await base44.asServiceRole.entities.User.update(user.id, {
      loyalty_points: newTotal,
      loyalty_bonus_month: monthKey,
    });

    // Send a congratulatory message via the delivery_tracker agent.
    let agentMessageId = null;
    let agentError = null;
    try {
      const conversation = await base44.agents.createConversation({
        agent_name: 'delivery_tracker',
        metadata: {
          name: `Loyalty Bonus — ${email}`,
          description: `${count} orders in ${monthKey} · +${BONUS_POINTS} points`,
        },
      });
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: `Congratulate this customer! They placed ${count} orders in ${monthKey}, crossing the 5-order monthly loyalty threshold. They just earned a ${BONUS_POINTS}-point bonus, bringing their loyalty points total to ${newTotal}. Send them a warm, friendly congratulatory message and remind them to drink responsibly.`,
      });
      agentMessageId = conversation?.id || 'sent';
    } catch (e) {
      agentError = e.message;
      console.error(`delivery_tracker agent message failed for ${email}:`, e.message);
    }

    awarded.push({
      email,
      orders_this_month: count,
      bonus_points: BONUS_POINTS,
      new_loyalty_total: newTotal,
      agent_message: agentMessageId,
      agent_error: agentError,
    });
  }

  return Response.json({
    month: monthKey,
    month_orders_scanned: monthOrders.length,
    qualifying_customers: qualifying.length,
    awarded_count: awarded.length,
    skipped_count: skipped.length,
    awarded,
    skipped,
  });
});