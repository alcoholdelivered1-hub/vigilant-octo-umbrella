import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertAdmin } from '../../shared/authGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const payload = await req.json();

    // Support both direct call and entity automation trigger
    const driverId = payload.driver_id || payload.event?.entity_id || payload.data?.id;
    if (!driverId) {
      return Response.json({ error: 'Missing driver_id' }, { status: 400 });
    }

    // Fetch driver record
    const drivers = await base44.asServiceRole.entities.Driver.filter({ id: driverId });
    const driver = drivers[0];
    if (!driver) {
      return Response.json({ error: 'Driver not found' }, { status: 404 });
    }

    console.log(`Running background check for driver: ${driver.name} (${driver.email})`);

    const apiKey = Deno.env.get('CHECKR_API_KEY');
    let checkStatus = 'pending';
    let checkId = null;

    if (apiKey) {
      // Submit candidate + background check to Checkr
      // Step 1: Create candidate
      const candidateRes = await fetch('https://api.checkr.com/v1/candidates', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(apiKey + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: driver.name.split(' ')[0],
          last_name: driver.name.split(' ').slice(1).join(' ') || driver.name,
          email: driver.email,
          phone: driver.phone,
          dob: driver.date_of_birth,
          driver_license_number: driver.license_number,
          driver_license_state: 'AR',
        }),
      });

      if (!candidateRes.ok) {
        const err = await candidateRes.text();
        console.error('Checkr candidate creation failed:', err);
        checkStatus = 'error';
      } else {
        const candidate = await candidateRes.json();
        console.log('Checkr candidate created:', candidate.id);

        // Step 2: Submit report (use "driver_pro" or "driver_standard" package)
        const reportRes = await fetch('https://api.checkr.com/v1/reports', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(apiKey + ':')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            package: 'driver_pro',
            candidate_id: candidate.id,
          }),
        });

        if (!reportRes.ok) {
          const err = await reportRes.text();
          console.error('Checkr report creation failed:', err);
          checkStatus = 'error';
        } else {
          const report = await reportRes.json();
          checkId = report.id;
          // Checkr reports start as "pending" — webhook will update when complete
          // We map Checkr statuses: clear -> clear, consider/dispute/suspended -> failed
          if (report.status === 'clear') checkStatus = 'clear';
          else if (['consider', 'dispute', 'suspended'].includes(report.status)) checkStatus = 'failed';
          else checkStatus = 'pending';
          console.log(`Checkr report ${report.id} status: ${report.status}`);
        }
      }
    } else {
      // No API key — cannot perform a real background check. Never fail-open.
      console.error('CHECKR_API_KEY not set. Background check cannot be performed.');
      checkStatus = 'error';
      checkId = null;
    }

    // Update driver record
    await base44.asServiceRole.entities.Driver.update(driverId, {
      background_check_status: checkStatus,
      background_check_id: checkId,
      background_check_completed_at: checkStatus !== 'pending' ? new Date().toISOString() : undefined,
    });

    console.log(`Driver ${driver.name} background_check_status set to: ${checkStatus}`);

    // Alert admin if check failed or errored (non-blocking — don't fail the whole function if email is undeliverable)
    if (checkStatus === 'failed' || checkStatus === 'error') {
      const adminEmail = Deno.env.get('STORE_MANAGER_EMAIL') || 'admin@alcoholdelivered.com';
      if (adminEmail && adminEmail.includes('@')) {
        try {
          const subject = checkStatus === 'failed'
            ? `⚠️ Background Check FAILED — ${driver.name}`
            : `🚨 Background Check ERROR — ${driver.name}`;
          const body = checkStatus === 'failed'
            ? `A background check has returned a FAILED result for a new driver application.\n\nDriver: ${driver.name}\nEmail: ${driver.email}\nPhone: ${driver.phone}\nLicense #: ${driver.license_number}\nCheck ID: ${checkId || 'N/A'}\n\nThis driver's account is currently inactive. Please review their application in the admin dashboard before taking any action.\n\nAction Required: Log in to the Admin Dashboard → Drivers to review or suspend this applicant.`
            : `A background check API call encountered an ERROR for a new driver application.\n\nDriver: ${driver.name}\nEmail: ${driver.email}\nCheck ID: ${checkId || 'N/A'}\n\nPlease manually review and re-run the background check from the Admin Dashboard.`;

          await base44.asServiceRole.integrations.Core.SendEmail({ to: adminEmail, subject, body });
          console.log(`Admin alert sent to ${adminEmail} for driver ${driver.name}`);
        } catch (emailErr) {
          console.error(`Failed to send admin alert email: ${emailErr.message}`);
        }
      } else {
        console.warn(`STORE_MANAGER_EMAIL is not a valid email address; skipping admin alert.`);
      }
    }

    return Response.json({ success: true, driver_id: driverId, background_check_status: checkStatus, check_id: checkId });
  } catch (error) {
    console.error('runDriverBackgroundCheck error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});