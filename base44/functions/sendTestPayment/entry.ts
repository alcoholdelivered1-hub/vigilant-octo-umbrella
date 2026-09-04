import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { email, amount_cents = 100 } = body;

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Create a Stripe Checkout session for the test payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Test Payment — Alcohol Delivered' },
          unit_amount: amount_cents,
        },
        quantity: 1,
      }],
      success_url: 'https://app.base44.com/success',
      cancel_url: 'https://app.base44.com/cancel',
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        type: 'test_payment',
      },
    });

    // 2. Send the checkout link via Gmail
    let emailSent = false;
    let emailError = null;
    try {
      const { accessToken: token } = await base44.asServiceRole.connectors.getConnection('gmail');

      if (token) {
        const htmlBody = [
          '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">',
          '<h2 style="color:#1e1b4b;">Test Payment — $' + (amount_cents / 100).toFixed(2) + '</h2>',
          '<p>Click the button below to complete your test payment:</p>',
          `<a href="${session.url}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Pay $${(amount_cents / 100).toFixed(2)}</a>`,
          `<p style="font-size:12px;color:#666;word-break:break-all;">Or copy this link:<br>${session.url}</p>`,
          '</div>'
        ].join('\r\n');

        const mimeMessage = 'From: Alcohol Delivered\r\n' +
          'To: ' + email + '\r\n' +
          'Subject: Test Payment Link - Alcohol Delivered\r\n' +
          'Content-Type: text/html; charset=UTF-8\r\n' +
          '\r\n' +
          htmlBody;
        const rawEmail = btoa(unescape(encodeURIComponent(mimeMessage)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const emailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: rawEmail }),
        });
        const emailResult = await emailRes.json();
        emailSent = !!emailResult.id;
        if (!emailSent) emailError = emailResult.error?.message || 'Unknown Gmail error';
      } else {
        emailError = 'Gmail token not available';
      }
    } catch (e) {
      emailError = e.message;
    }

    return Response.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (error) {
    console.error('sendTestPayment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});