import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { email, first_name } = body;

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const displayName = first_name || 'there';

    const plainText = `Hi ${displayName},

Thanks for signing up with Alcohol Delivered!

Your verification code is: ${code}

This code expires in 15 minutes.

If you did not create an account with Alcohol Delivered, please ignore this email.

- Alcohol Delivered
Pine Bluff, AR · 21+ Only · Licensed & Compliant`;

    const htmlBody = `
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8f9fb; border-radius: 16px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <div style="width: 60px; height: 60px; background: #1e2d6e; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
      <span style="font-size: 28px;">🍷</span>
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #1e2d6e; margin: 0;">Alcohol Delivered</h1>
    <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Pine Bluff, AR · 21+ Only · Licensed & Compliant</p>
  </div>

  <div style="background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
    <p style="font-size: 15px; color: #374151; margin: 0 0 8px;">Hi ${displayName},</p>
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px;">Thanks for signing up! Please verify your email address using the code below. This code expires in <strong>15 minutes</strong>.</p>

    <div style="text-align: center; background: #f3f4f6; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
      <p style="font-size: 40px; font-weight: 800; color: #1e2d6e; letter-spacing: 8px; margin: 0;">${code}</p>
    </div>

    <p style="font-size: 12px; color: #9ca3af; margin: 0;">If you did not create an account with Alcohol Delivered, please ignore this email.</p>
  </div>

  <p style="text-align: center; font-size: 12px; color: #9ca3af; margin: 0;">
    © 2026 Alcohol Delivered · Must be 21+ · Drink Responsibly<br/>
    📞 <a href="tel:8702099109" style="color: #9ca3af;">870-209-9109</a>
  </p>
</div>`;

    // Use Core.SendEmail — restricts delivery to registered app users (prevents open relay)
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'Verify your Alcohol Delivered account',
      body: plainText,
      from_name: 'Alcohol Delivered',
    });

    console.log(`Verification email sent to ${email}`);
    return Response.json({ success: true, code });
  } catch (error) {
    console.error('sendVerificationEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});