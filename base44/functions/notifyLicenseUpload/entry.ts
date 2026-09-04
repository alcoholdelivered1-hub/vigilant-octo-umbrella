import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const storeData = body.data;
    const oldData = body.old_data;

    // Only notify if license_number actually changed to a non-empty value
    const licenseChanged = storeData?.license_number &&
      storeData.license_number !== oldData?.license_number;

    if (!licenseChanged) {
      return Response.json({ skipped: true, reason: 'license_number not changed' });
    }

    const storeName = storeData.name || 'Unknown Store';
    const storeEmail = storeData.email || 'N/A';
    const city = storeData.city || '';
    const county = storeData.county || '';
    const newLicense = storeData.license_number;
    const oldLicense = oldData?.license_number || '(none)';

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    // Notify admin
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'alcohol.delivered1@gmail.com',
      subject: `License Document Updated — ${storeName}`,
      body: `A store owner has uploaded or updated their license document.

Store: ${storeName}
Location: ${city}${county ? ', ' + county + ' County' : ''}
Contact Email: ${storeEmail}

Previous License #: ${oldLicense}
New License #: ${newLicense}

Updated at: ${timestamp}

Log in to the admin dashboard to review the store's compliance status.`,
      from_name: 'Alcohol Delivered — Store Alerts',
    });

    // Notify the store owner (if they have an email on file)
    if (storeEmail && storeEmail !== 'N/A') {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: storeEmail,
        subject: `Your License Information Has Been Updated — ${storeName}`,
        body: `Hi ${storeName} team,

Your license document was successfully updated on your store dashboard.

License Number on File: ${newLicense}
Updated at: ${timestamp}

If you did not make this change or believe this is an error, please contact us immediately at alcohol.delivered1@gmail.com.

Thank you,
Alcohol Delivered Compliance Team`,
        from_name: 'Alcohol Delivered — Compliance',
      });
    }

    console.log(`License update notifications sent for store: ${storeName} (${newLicense})`);
    return Response.json({ success: true, store: storeName });
  } catch (error) {
    console.error('notifyLicenseUpload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});