import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

/**
 * Checkr webhook receiver.
 * Verifies the Checkr-Signature header using CHECKR_WEBHOOK_SECRET,
 * then updates the driver's background_check_status when a report completes.
 *
 * Register this endpoint in Checkr Dashboard → Webhooks:
 *   URL: https://alcohol-delivered-0c72f042.base44.app/functions/checkrWebhook
 *
 * Events handled: report.completed, report.updated, report.pre_adverse_action
 */

async function verifySignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  // Checkr sends a comma-separated list of "t=timestamp,v1=signature" pairs
  const elements = signatureHeader.split(',').map(s => s.trim());
  const timestamp = elements.find(e => e.startsWith('t='))?.split('=')[1];
  const v1Signatures = elements.filter(e => e.startsWith('v1=')).map(e => e.split('=')[1]);
  if (!timestamp || v1Signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(expectedBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return v1Signatures.some(sig => sig === expected);
}

function mapCheckrStatus(checkrStatus) {
  // Checkr report statuses: pending, clear, consider, suspended, dispute, withdrawn
  if (checkrStatus === 'clear') return 'clear';
  if (['consider', 'suspended', 'dispute', 'withdrawn'].includes(checkrStatus)) return 'failed';
  return 'pending';
}

export default async function(req) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('checkr-signature') || '';
    const webhookSecret = secrets.get('CHECKR_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('CHECKR_WEBHOOK_SECRET is not set — cannot verify webhook signature');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 503 });
    }

    const verified = await verifySignature(rawBody, signatureHeader, webhookSecret);
    if (!verified) {
      console.error('Checkr webhook signature verification failed');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;
    const data = event.data?.object || event.data;

    console.log(`Checkr webhook received: ${eventType}`);

    // Only process report-related events
    if (!eventType || !eventType.startsWith('report.')) {
      return Response.json({ received: true, skipped: true, reason: `Ignoring event type: ${eventType}` });
    }

    const reportId = data?.id;
    const candidateId = data?.candidate_id;
    const reportStatus = data?.status;

    if (!reportId || !candidateId) {
      return Response.json({ received: true, skipped: true, reason: 'Missing report or candidate ID' });
    }

    const base44 = createClientFromRequest(req);

    // Find the driver by their Checkr background_check_id
    const drivers = await base44.asServiceRole.entities.Driver.filter({ background_check_id: reportId });
    if (!drivers || drivers.length === 0) {
      console.log(`No driver found with background_check_id=${reportId}, attempting candidate lookup`);
      // Fallback: look up candidate from Checkr API to find email, then match
      const apiKey = secrets.get('CHECKR_API_KEY');
      if (!apiKey) {
        return Response.json({ received: true, skipped: true, reason: 'Driver not found and CHECKR_API_KEY not set for candidate lookup' });
      }
      const candRes = await fetch(`https://api.checkr.com/v1/candidates/${candidateId}`, {
        headers: { Authorization: `Basic ${btoa(apiKey + ':')}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!candRes.ok) {
        return Response.json({ received: true, skipped: true, reason: `Candidate lookup failed: ${candRes.status}` });
      }
      const candidate = await candRes.json();
      const driverByEmail = await base44.asServiceRole.entities.Driver.filter({ email: candidate.email });
      if (!driverByEmail || driverByEmail.length === 0) {
        return Response.json({ received: true, skipped: true, reason: `No driver found for candidate email ${candidate.email}` });
      }
      const driver = driverByEmail[0];
      const mappedStatus = mapCheckrStatus(reportStatus);
      await base44.asServiceRole.entities.Driver.update(driver.id, {
        background_check_status: mappedStatus,
        background_check_id: reportId,
        background_check_completed_at: mappedStatus !== 'pending' ? new Date().toISOString() : undefined,
      });
      console.log(`Driver ${driver.name} background_check_status updated to ${mappedStatus} via candidate lookup`);
      return Response.json({ received: true, updated: true, driver_id: driver.id, status: mappedStatus });
    }

    // Update the driver record
    const driver = drivers[0];
    const mappedStatus = mapCheckrStatus(reportStatus);
    await base44.asServiceRole.entities.Driver.update(driver.id, {
      background_check_status: mappedStatus,
      background_check_completed_at: mappedStatus !== 'pending' ? new Date().toISOString() : undefined,
    });

    console.log(`Driver ${driver.name} background_check_status updated to ${mappedStatus}`);

    // Alert admin on failed background checks
    if (mappedStatus === 'failed') {
      const adminEmail = secrets.get('STORE_MANAGER_EMAIL');
      if (adminEmail) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: adminEmail,
          subject: `Background Check FAILED — ${driver.name}`,
          body: `A Checkr background check has returned a FAILED result.\n\nDriver: ${driver.name}\nEmail: ${driver.email}\nPhone: ${driver.phone}\nCheckr Report ID: ${reportId}\nCheckr Status: ${reportStatus}\n\nThis driver's account should be reviewed and suspended if necessary.`,
          category: 'transactional',
        });
      }
    }

    return Response.json({ received: true, updated: true, driver_id: driver.id, status: mappedStatus });
  } catch (error) {
    console.error('checkrWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}