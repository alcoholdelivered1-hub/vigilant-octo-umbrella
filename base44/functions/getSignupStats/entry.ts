import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { referral_code } = body;

    // Public endpoint — no auth required (this is a public launch page)
    const allSignups = await base44.asServiceRole.entities.EarlySignup.filter({}, 'created_date', 10000);
    const total = allSignups.length;

    let your_referral_count = 0;
    let your_position = null;

    if (referral_code) {
      const code = referral_code.toUpperCase();
      const mine = allSignups.find(s => (s.referral_code || '').toUpperCase() === code);
      if (mine) {
        your_referral_count = allSignups.filter(s => (s.referred_by_code || '').toUpperCase() === code).length;
        const myDate = new Date(mine.created_date);
        your_position = allSignups.filter(s => new Date(s.created_date) < myDate).length + 1;
      }
    }

    return Response.json({
      total_signups: total,
      your_referral_count,
      your_position,
    });
  } catch (error) {
    console.error('[getSignupStats] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});