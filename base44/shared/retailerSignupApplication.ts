import { secrets } from 'base44:runtime';

// Arkansas has 75 counties. The application form uses the same list so the county
// saved on an application always matches the values downstream zone/permit rules compare.
export const ARKANSAS_COUNTIES = [
  'Arkansas', 'Ashley', 'Baxter', 'Benton', 'Boone', 'Bradley', 'Calhoun', 'Carroll', 'Chicot',
  'Clark', 'Clay', 'Cleburne', 'Cleveland', 'Columbia', 'Conway', 'Craighead', 'Crawford',
  'Crittenden', 'Cross', 'Dallas', 'Desha', 'Drew', 'Faulkner', 'Franklin', 'Fulton', 'Garland',
  'Grant', 'Greene', 'Hempstead', 'Hot Spring', 'Howard', 'Independence', 'Izard', 'Jackson',
  'Jefferson', 'Johnson', 'Lafayette', 'Lawrence', 'Lee', 'Lincoln', 'Little River', 'Logan',
  'Lonoke', 'Madison', 'Marion', 'Miller', 'Mississippi', 'Monroe', 'Montgomery', 'Nevada',
  'Newton', 'Ouachita', 'Perry', 'Phillips', 'Pike', 'Poinsett', 'Polk', 'Pope', 'Prairie',
  'Pulaski', 'Randolph', 'Saline', 'Scott', 'Searcy', 'Sebastian', 'Sevier', 'Sharp', 'St. Francis',
  'Stone', 'Union', 'Van Buren', 'Washington', 'White', 'Woodruff', 'Yell',
];

export const BUSINESS_TYPES = ['liquor_store', 'wine_spirits', 'convenience', 'grocery', 'restaurant_bar', 'other'];

const APP_URL = 'https://alcohol-delivered-0c72f042.base44.app';

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const clean = value => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const norm = value => clean(value).toLowerCase();

function required(value, label, max) {
  const text = clean(value);
  if (!text) throw invalid(`Enter ${label}.`);
  if (text.length > max) throw invalid(`That value is too long for ${label} (maximum ${max} characters).`);
  return text;
}

function optional(value, label, max) {
  const text = clean(value);
  if (text.length > max) throw invalid(`That value is too long for ${label} (maximum ${max} characters).`);
  return text;
}

// Server-side validation. Nothing is trusted from the browser and nothing is
// marked verified here; administrators verify licenses and location later.
export function validateApplication(body) {
  const source = body || {};
  const store_name = required(source.store_name, 'your store’s legal name', 120);
  if (store_name.length < 2) throw invalid('Enter your store’s legal name.');

  const contact_name = required(source.contact_name, 'the name of the person we should contact', 100);
  const contact_email = required(source.contact_email, 'your email address', 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(contact_email)) throw invalid('Enter a valid email address.');

  const contact_phone = optional(source.contact_phone, 'the phone number', 40);
  if (contact_phone) {
    const digits = contact_phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) throw invalid('Enter a valid phone number, including the area code.');
  }

  const business_type = required(source.business_type, 'your business type', 40);
  if (!BUSINESS_TYPES.includes(business_type)) throw invalid('Choose a valid business type.');

  const address = required(source.address, 'your store’s street address', 200);
  if (address.length < 4) throw invalid('Enter your store’s street address.');
  const city = required(source.city, 'your city', 80);

  const state = required(source.state, 'your state', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw invalid('Enter the two-letter state code for your store.');

  const zip_code = required(source.zip_code, 'your ZIP code', 10);
  if (!/^\d{5}(-\d{4})?$/.test(zip_code)) throw invalid('Enter a valid 5-digit ZIP code.');

  const countyInput = required(source.county, 'your county', 40);
  const county = ARKANSAS_COUNTIES.find(name => norm(name) === norm(countyInput));
  if (!county) throw invalid('Select the Arkansas county where your store is located.');

  const license_number = required(source.license_number, 'your ABC retail license number', 40);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ./&-]{2,39}$/.test(license_number)) throw invalid('Enter your ABC retail license number using letters and numbers.');

  const website = optional(source.website, 'the website address', 200);
  if (website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(website)) throw invalid('Enter a valid website address, or leave it blank.');

  const operating_hours = optional(source.operating_hours, 'the operating hours', 120);
  const referral_source = optional(source.referral_source, 'how you heard about us', 100);
  const description = optional(source.description, 'notes', 1000);

  let num_locations = 1;
  if (source.num_locations !== undefined && source.num_locations !== null && source.num_locations !== '') {
    num_locations = Number(source.num_locations);
    if (!Number.isInteger(num_locations) || num_locations < 1 || num_locations > 999) throw invalid('Enter the number of locations as a whole number.');
  }

  const has_pos = source.has_pos === true || source.has_pos === 'true';
  const pos_provider = optional(source.pos_provider, 'the POS provider', 60);
  if (has_pos && !pos_provider) throw invalid('Tell us which register or POS system your store uses.');

  return {
    store_name, contact_name, contact_email, contact_phone, business_type,
    address, city, county, state, zip_code, license_number, website,
    operating_hours, referral_source, description, num_locations, has_pos, pos_provider,
    status: 'pending',
  };
}

// One application per business + contact email. Comparisons are case/space
// insensitive so a retry or a re-submission cannot create a second record.
async function matchingApplications(base44, fields) {
  const [byEmail, byName] = await Promise.all([
    base44.asServiceRole.entities.RetailerSignup.filter({ contact_email: fields.contact_email }, '-created_date', 25),
    base44.asServiceRole.entities.RetailerSignup.filter({ store_name: fields.store_name }, '-created_date', 25),
  ]);
  return [...(byEmail || []), ...(byName || [])].filter(row => row
    && norm(row.contact_email) === norm(fields.contact_email)
    && norm(row.store_name) === norm(fields.store_name));
}

export async function findExistingApplication(base44, fields) {
  const rows = await matchingApplications(base44, fields);
  return rows[0] || null;
}

// Minimal summary for the applicant's own acknowledgement. Deliberately omits
// licence, address and contact details.
export function applicationSummary(row) {
  if (!row) return null;
  return {
    application_id: row.id,
    store_name: row.store_name || '',
    status: row.status || 'pending',
    created_date: row.created_date || null,
  };
}

// The signed-in applicant's own application. The caller passes the email from the
// authenticated session, never from the request body, so one applicant can never
// retrieve another applicant's record.
export async function findOwnApplication(base44, email) {
  const address = norm(email);
  if (!address) return null;
  const rows = await base44.asServiceRole.entities.RetailerSignup.filter({ contact_email: address }, '-created_date', 25);
  return (rows || []).find(row => row && norm(row.contact_email) === address) || null;
}

// Two simultaneous submissions can both pass the pre-insert check. After
// inserting, keep exactly one application: the oldest (then lowest id) wins and
// this request discards only the row it just created.
export async function reconcileConcurrentDuplicate(base44, fields, createdId) {
  const rows = await matchingApplications(base44, fields);
  if (rows.length < 2) return null;
  const canonical = rows.slice().sort((a, b) =>
    String(a.created_date || '').localeCompare(String(b.created_date || '')) || String(a.id).localeCompare(String(b.id)))[0];
  if (!canonical || canonical.id === createdId) return null;
  await base44.asServiceRole.entities.RetailerSignup.delete(createdId);
  return canonical;
}

// Creates the admin-pipeline candidate, or links the existing one. Never marks
// anything verified and never approves the application.
export async function ensureOnboardingCandidate(base44, fields, signupId) {
  const [stores, candidates] = await Promise.all([
    base44.asServiceRole.entities.Store.filter({ name: fields.store_name }, 'created_date', 25),
    base44.asServiceRole.entities.RetailerOnboarding.filter({ contact_email: fields.contact_email }, '-created_date', 25),
  ]);
  const store = (stores || []).find(row => row && norm(row.name) === norm(fields.store_name)) || null;
  const existing = (candidates || []).find(row => row && norm(row.name) === norm(fields.store_name)) || null;
  if (existing) {
    if (!existing.store_id && store) return await base44.asServiceRole.entities.RetailerOnboarding.update(existing.id, { store_id: store.id });
    return existing;
  }
  return await base44.asServiceRole.entities.RetailerOnboarding.create({
    name: fields.store_name,
    ...(store ? { store_id: store.id } : {}),
    status: 'candidate',
    contact_name: fields.contact_name,
    contact_email: fields.contact_email,
    license_number: fields.license_number,
    address: fields.address,
    city: fields.city,
    county: fields.county,
    state: fields.state,
    zip_code: fields.zip_code,
    notes: `Submitted through the retailer application form (application ${signupId}). Type: ${fields.business_type}; POS: ${fields.has_pos ? fields.pos_provider : 'not confirmed'}${fields.num_locations > 1 ? `; locations: ${fields.num_locations}` : ''}${fields.referral_source ? `; source: ${fields.referral_source}` : ''}. Unverified: the license, county and permits require administrator review.`,
    agreement_signed: false,
    clover_authorized: false,
    stripe_ready: false,
    catalog_verified: false,
    test_order_passed: false,
  });
}

// Email delivery stays off unless the RETAILER_SIGNUP_EMAILS secret is set to
// "live", so submissions can be tested without contacting anyone.
export function notificationMode() {
  try {
    return norm(secrets.get('RETAILER_SIGNUP_EMAILS'));
  } catch {
    return '';
  }
}

function base64urlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function rawEmail(to, subject, body) {
  return base64urlEncode([
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ].join('\r\n') + '\r\n\r\n' + body);
}

function managerEmail() {
  try {
    const value = clean(secrets.get('STORE_MANAGER_EMAIL'));
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value;
  } catch {
    // Secret not configured: fall back to the published partnerships inbox.
  }
  return 'alcohol.delivered1@gmail.com';
}

export function signupMessages(fields) {
  const location = [fields.address, fields.city, fields.county, fields.state, fields.zip_code].filter(Boolean).join(', ');
  return [
    {
      to: fields.contact_email,
      subject: `Your Alcohol Delivered application - ${fields.store_name}`,
      body: `Hi ${fields.contact_name || 'there'},

Thank you for applying to join Alcohol Delivered as a retail partner.

We have received your application for ${fields.store_name} in ${fields.county} County and will review your details and Arkansas ABC license. Our team will contact you at ${fields.contact_email} to confirm the next steps.

What happens next:
1. We verify your license and business details.
2. We send you a retailer partner agreement to sign.
3. We connect your register or POS and sync your inventory.
4. You go live and start receiving orders.

Submitting an application does not activate ordering.

Alcohol Delivered Partnerships Team`,
    },
    {
      to: managerEmail(),
      subject: `New retailer application - ${fields.store_name}`,
      body: `A new retailer application was submitted.

Store: ${fields.store_name}
Contact: ${fields.contact_name} (${fields.contact_email})
Phone: ${fields.contact_phone || 'Not provided'}
Business type: ${fields.business_type}
License: ${fields.license_number}
Location: ${location}
POS: ${fields.has_pos ? fields.pos_provider : 'Not confirmed'}
Locations: ${fields.num_locations}

Nothing has been verified. Review the application at ${APP_URL}/admin/retailer-signups`,
    },
  ];
}

export async function deliverSignupNotifications(base44, fields) {
  const messages = signupMessages(fields);
  if (notificationMode() !== 'live') {
    console.log('[retailer signup] email delivery suppressed', JSON.stringify(messages.map(m => ({ to: m.to, subject: m.subject }))));
    return { delivery: 'suppressed', detail: 'Set the RETAILER_SIGNUP_EMAILS secret to "live" to deliver these emails.' };
  }
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    for (const message of messages) {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: rawEmail(message.to, message.subject, message.body) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Gmail rejected ${message.to}: ${(await response.text()).slice(0, 200)}`);
    }
    return { delivery: 'sent' };
  } catch (error) {
    console.error('[retailer signup] email delivery failed:', error.message);
    return { delivery: 'failed', detail: error.message };
  }
}