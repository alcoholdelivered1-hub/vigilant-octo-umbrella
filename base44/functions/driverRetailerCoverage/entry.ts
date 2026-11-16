import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { readAllMatching, driverIsProductionQualified } from '../../shared/verifiedTaxDriverReadiness.ts';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const { action = 'snapshot' } = await req.json();
    if (!['snapshot', 'match'].includes(action)) return Response.json({ error: 'Invalid action' }, { status: 400 });
    const [stores, drivers, coverage] = await Promise.all([
      readAllMatching(base44.entities.Store, { onboarding_status: 'live', is_active: true }),
      readAllMatching(base44.entities.Driver, {}), readAllMatching(base44.entities.DriverStoreCoverage, {}),
    ]);
    const qualified = (await attachDriverCompliance(base44, drivers)).filter(driverIsProductionQualified);
    const normalized = value => value?.trim().toLowerCase();
    const matches = [];
    for (const s of stores) for (const d of qualified) {
      if (normalized(d.service_city) !== normalized(s.city)) continue;
      if (coverage.some(c => c.driver_id === d.id && c.store_id === s.id)) continue;
      matches.push({ store_id: s.id, store_name: s.name, city: s.city, driver_id: d.id, driver_name: d.name, driver_email: d.email });
    }
    if (matches.length > 500) return Response.json({ error: 'Too many matches for one run' }, { status: 400 });
    if (action === 'match' && matches.length) coverage.push(...await base44.entities.DriverStoreCoverage.bulkCreate(matches));
    const valid = coverage.filter(c => stores.some(s => s.id === c.store_id) && qualified.some(d => d.id === c.driver_id && normalized(d.service_city) === normalized(c.city)));
    return Response.json({ total_drivers: drivers.length, qualified_drivers: qualified.length, blocked_drivers: drivers.length - qualified.length, matched: action === 'match' ? matches.length : 0, available_matches: matches.length, stores: stores.sort((a,b) => a.name.localeCompare(b.name)).map(s => ({ id: s.id, name: s.name, city: s.city, drivers: valid.filter(c => c.store_id === s.id).map(c => ({ id: c.driver_id, name: c.driver_name })) })) });
  } catch (error) { console.error('Driver coverage:', error.message); return Response.json({ error: error.message }, { status: 500 }); }
}