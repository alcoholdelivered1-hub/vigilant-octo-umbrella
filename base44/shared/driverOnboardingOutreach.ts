import { readAllMatching, driverIsProductionQualified } from './verifiedTaxDriverReadiness.ts';
import { attachDriverCompliance } from './driverAnnualCompliance.ts';

export async function sendDriverOnboardingOutreach(base44, preview) {
  const [drivers, applications, stores, users, logs] = await Promise.all([
    readAllMatching(base44.entities.Driver, {}),
    readAllMatching(base44.entities.EarlySignup, { role: 'driver', status: { $in: ['pending', 'contacted'] } }),
    readAllMatching(base44.entities.Store, { onboarding_status: 'live', is_active: true }),
    base44.entities.User.list('email', 1000),
    readAllMatching(base44.entities.DriverOnboardingOutreach, {}),
  ]);
  if (!stores.length) return { sent: 0, results: [], reason: 'No live active retailers' };
  const registered = new Set(users.map(u => u.email?.trim().toLowerCase()));
  const targets = new Map();
  for (const a of applications) targets.set(a.email?.trim().toLowerCase(), { name: a.full_name, application: a, url: 'https://alcohol-delivered.biz/driver/signup', steps: 'Complete your driver application, required documents, and training. Your application remains pending until verification is complete.' });
  const reviewedDrivers = await attachDriverCompliance(base44, drivers);
  for (const d of reviewedDrivers) if (!driverIsProductionQualified(d) || !d.service_city) targets.set(d.email?.trim().toLowerCase(), { name: d.name, url: 'https://alcohol-delivered.biz/driver', steps: 'Open your Driver Portal, select your service city, and contact John Bess to resolve missing or simulated background-check evidence. Complete any missing profile or training steps.' });
  if (targets.size > 50) throw new Error('This outreach supports up to 50 applicants per run.');
  const results = [];
  const cities = [...new Set(stores.map(s => s.city.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())))].join(', ');
  for (const [email, target] of targets) {
    const recent = logs.some(l => l.email === email && Date.now() - Date.parse(l.sent_at) < 7 * 86400000);
    if (!registered.has(email) || recent) { results.push({ name: target.name, status: 'skipped', reason: recent ? 'Already contacted within 7 days' : 'Not a registered app user' }); continue; }
    if (preview) { results.push({ name: target.name, status: 'ready' }); continue; }
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: email, template_name: 'DriverRetailerOnboarding', variables: { first_name: target.name?.split(' ')[0] || 'Driver', store_count: String(stores.length), cities, next_steps: target.steps, setup_url: target.url } });
      await base44.entities.DriverOnboardingOutreach.create({ email, sent_at: new Date().toISOString() });
      if (target.application) await base44.entities.EarlySignup.update(target.application.id, { status: 'contacted' });
      results.push({ name: target.name, status: 'sent' });
    } catch (error) { results.push({ name: target.name, status: 'failed', error: error.message }); }
  }
  return { preview, sent: results.filter(r => r.status === 'sent').length, ready: results.filter(r => r.status === 'ready').length, skipped: results.filter(r => r.status === 'skipped').length, failed: results.filter(r => r.status === 'failed').length, results };
}