import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    // Parse body first before any other stream consumption
    const body = await req.json().catch(() => ({}));
    const { first_name, code: submittedCode } = body;

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Verification codes only ever go to the signed-in user's own address
    const email = user.email;

    // --- Verify mode: user submitted a code, validate server-side ---
    if (submittedCode) {
      const storedCode = user.verification_code;
      const expiresAt = user.verification_code_expires
        ? new Date(user.verification_code_expires).getTime()
        : 0;

      if (!storedCode || Date.now() > expiresAt) {
        return Response.json({ verified: false, error: 'Code expired or not found. Please request a new code.' }, { status: 400 });
      }

      if (String(storedCode) !== String(submittedCode)) {
        return Response.json({ verified: false, error: 'Incorrect code.' }, { status: 400 });
      }

      // Code is valid — clear it so it can't be reused
      await base44.asServiceRole.entities.User.update(user.id, {
        verification_code: null,
        verification_code_expires: null,
      });

      return Response.json({ verified: true });
    }

    // --- Send mode: generate a new code and email it ---
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code temporarily on user profile
    await base44.asServiceRole.entities.User.update(user.id, {
      verification_code: code,
      verification_code_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    // Use Gmail connector to send — no recipient restrictions
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

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
    <p style="font-size: 15px; color: #374151; margin: 0 0 8px;">Hi ${first_name || 'there'},</p>
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

    // Build RFC 2822 message using TextEncoder for safe base64url encoding
    const subject = 'Verify your Alcohol Delivered account';
    const encodedSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    const messageParts = [
      `To: ${email}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(unescape(encodeURIComponent(htmlBody))),
    ];
    const rawMessage = messageParts.join('\r\n');
    // Safe base64url encoding using TextEncoder (works with all unicode)
    const encoder = new TextEncoder();
    const bytes = encoder.encode(rawMessage);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    const encodedMessage = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!gmailRes.ok) {
      const errBody = await gmailRes.json();
      console.error('Gmail send error:', JSON.stringify(errBody));
      // Fallback: use built-in SendEmail integration
      console.log('Falling back to built-in SendEmail...');
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: 'Verify your Alcohol Delivered account',
        body: `Hi ${first_name || 'there'},\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.\n\n- Alcohol Delivered`,
        from_name: 'Alcohol Delivered',
      });
      console.log(`Verification email sent via fallback to ${email}`);
      return Response.json({ success: true });
    }

    console.log(`Verification email sent via Gmail to ${email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('sendVerificationEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});