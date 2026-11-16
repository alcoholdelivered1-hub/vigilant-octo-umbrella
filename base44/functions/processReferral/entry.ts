import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const REFERRER_CREDITS = 500;  // $5.00 in cents
const REFERRED_CREDITS = 300;  // $3.00 in cents

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { referral_code } = await req.json();
    if (!referral_code) {
      return Response.json({ error: 'No referral code provided' }, { status: 400 });
    }

    // Find the referrer by their referral code
    const referrers = await base44.asServiceRole.entities.User.filter({ referral_code });
    if (!referrers || referrers.length === 0) {
      return Response.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    const referrer = referrers[0];

    // Make sure user isn't referring themselves
    if (referrer.email === user.email) {
      return Response.json({ error: 'Cannot use your own referral code' }, { status: 400 });
    }

    // Make sure this user hasn't already been referred
    if (user.referred_by_code) {
      return Response.json({ error: 'You have already used a referral code' }, { status: 400 });
    }

    // Award credits to referrer
    await base44.asServiceRole.entities.User.update(referrer.id, {
      referral_count: (referrer.referral_count || 0) + 1,
      referral_credits: (referrer.referral_credits || 0) + REFERRER_CREDITS,
      loyalty_points: (referrer.loyalty_points || 0) + 50,
    });

    // Award credits to the new user (current user).
    // Written with the service role: credit and referral-attribution fields are locked
    // against app-user writes so a user cannot grant themselves credits from the browser.
    await base44.asServiceRole.entities.User.update(user.id, {
      referred_by_code: referral_code,
      referred_by_email: referrer.email,
      referral_credits: (user.referral_credits || 0) + REFERRED_CREDITS,
      loyalty_points: (user.loyalty_points || 0) + 30,
    });

    return Response.json({
      success: true,
      referrer_name: referrer.full_name,
      your_credits: REFERRED_CREDITS,
      message: `Referral applied! You earned $${(REFERRED_CREDITS / 100).toFixed(2)} credit and 30 loyalty points.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});