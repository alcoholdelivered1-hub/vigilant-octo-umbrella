import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { assertAdmin } from '../../shared/authGuard.ts';

function buildEmail(to, subject, bodyText) {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ];
  return headers.join('\r\n') + '\r\n\r\n' + bodyText;
}

function base64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;
    const body = await req.json().catch(() => ({}));
    const signup = body.data || body;
    const {
      store_name, contact_name, contact_email, contact_phone, license_number,
      business_type, address, city, county, state, zip_code, website,
      num_locations, has_pos, pos_provider, referral_source,
    } = signup;

    if (!contact_email || !store_name) {
      return Response.json({ error: 'Missing store_name or contact_email' }, { status: 400 });
    }

    const origin = 'https://alcohol-delivered-0c72f042.base44.app';
    const contractUrl = `${origin}/retailer-contract`;
    const results = { onboardingId: null, retailerEmail: null, adminEmail: null };

    // 1. Create a RetailerOnboarding candidate so it flows into the admin pipeline
    try {
      const rec = await base44.entities.RetailerOnboarding.create({
        name: store_name,
        status: 'candidate',
        contact_name,
        contact_email,
        license_number,
        address: [address, city, county, state, zip_code].filter(Boolean).join(', '),
        notes: `Auto-created from retailer signup. Type: ${business_type || 'unknown'}; POS: ${has_pos ? (pos_provider || 'yes') : 'no'}${num_locations ? `; locations: ${num_locations}` : ''}${referral_source ? `; source: ${referral_source}` : ''}.`,
        agreement_signed: false,
        clover_authorized: false,
        stripe_ready: false,
        catalog_verified: false,
        test_order_passed: false,
      });
      results.onboardingId = rec?.id || null;
    } catch (e) {
      console.log('RetailerOnboarding create failed:', e.message);
    }

    // 2. Get the shared Gmail connection (builder's account)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // 3. Confirmation email to the retailer
    const retailerBody = `Hi ${contact_name || 'there'},

Thank you for applying to join Alcohol Delivered as a retail partner!

We've received your application for ${store_name}. Our partnerships team will review your details and Arkansas ABC license, then reach out to ${contact_email} within 1-2 business days to start onboarding.

What happens next:
1. We verify your license and business details.
2. We send you a retailer partner agreement to sign: ${contractUrl}
3. We connect your Clover POS and sync your inventory.
4. You go live and start receiving orders.

If you have any questions, just reply to this email.

Cheers,
The Alcohol Delivered Partnerships Team`;

    try {
      const raw = base64urlEncode(buildEmail(contact_email, `Your Alcohol Delivered Application - ${store_name}`, retailerBody));
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      results.retailerEmail = r.ok ? 'sent' : `failed: ${(await r.text()).slice(0, 200)}`;
    } catch (e) {
      results.retailerEmail = `error: ${e.message}`;
    }

    // 4. Admin alert email
    const candidateAdmin = secrets.get('STORE_MANAGER_EMAIL') || '';
    const adminEmail = /^\S+@\S+\.\S+$/.test(candidateAdmin) ? candidateAdmin : 'alcohol.delivered1@gmail.com';
    const adminBody = `New retailer signup received!

Store: ${store_name}
Contact: ${contact_name} (${contact_email})
Phone: ${contact_phone || 'N/A'}
Business type: ${business_type || 'N/A'}
License: ${license_number || 'N/A'}
Location: ${[address, city, county, state, zip_code].filter(Boolean).join(', ') || 'N/A'}
Website: ${website || 'N/A'}
Locations: ${num_locations || 1}
POS: ${has_pos ? (pos_provider || 'Yes') : 'No'}
Heard about us: ${referral_source || 'N/A'}

${results.onboardingId ? `RetailerOnboarding record created (id: ${results.onboardingId}).` : 'RetailerOnboarding record could not be auto-created.'}

Review all applications: ${origin}/admin/retailer-signups`;

    try {
      const raw = base64urlEncode(buildEmail(adminEmail, `New Retailer Application - ${store_name}`, adminBody));
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      results.adminEmail = r.ok ? 'sent' : `failed: ${(await r.text()).slice(0, 200)}`;
    } catch (e) {
      results.adminEmail = `error: ${e.message}`;
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    console.log('processRetailerSignup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}