import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { allSetupRecords, normalizeRetailer } from '../../shared/retailerSetupAccess.ts';
import { isPlaceholder } from '../../shared/readiness/readinessEvidence.ts';

// Safe, read-first migration for legacy name-based onboarding relationships.
// Dry run by default. Only unambiguous matches are linked; nothing is approved,
// no status changes, and ambiguous or duplicate records are reported untouched.
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Administrators only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (body.dry_run !== false) return Response.json(await migrate(base44, true));
    // Applying requires an explicit second confirmation so a stray click cannot write.
    if (body.confirm !== 'link-unambiguous-records') return Response.json({ error: 'Confirm the migration to apply store links.' }, { status: 400 });
    return Response.json(await migrate(base44, false));
  } catch (error) {
    console.error('Onboarding store-link migration failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function migrate(base44, dryRun) {
  const [stores, records] = await Promise.all([
    allSetupRecords(base44.asServiceRole.entities.Store, {}, 'name'),
    allSetupRecords(base44.asServiceRole.entities.RetailerOnboarding, {}, '-created_date'),
  ]);

  const byName = new Map();
  for (const store of stores) {
    const key = normalizeRetailer(store.name);
    byName.set(key, [...(byName.get(key) || []), store]);
  }
  const nameCounts = new Map();
  for (const record of records) {
    const key = normalizeRetailer(record.name);
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }

  const report = {
    dry_run: dryRun,
    stores: stores.length,
    onboarding_records: records.length,
    already_linked: records.filter(record => record.store_id).length,
    linkable: [],
    ambiguous: [],
    unmatched: [],
    placeholder_clover_values: [],
    applied: [],
  };

  for (const record of records) {
    if (isPlaceholder(record.clover_merchant_id) === false && record.clover_merchant_id) {
      // A real-looking merchant id in the free-text field is still not a connection;
      // report it so an administrator can authorize the merchant properly.
      report.placeholder_clover_values.push({ id: record.id, name: record.name, value: record.clover_merchant_id, legacy_free_text: true });
    } else if (record.clover_merchant_id) {
      report.placeholder_clover_values.push({ id: record.id, name: record.name, value: record.clover_merchant_id, placeholder: true });
    }
    if (record.store_id) continue;
    const key = normalizeRetailer(record.name);
    const matches = byName.get(key) || [];
    const reason = matches.length > 1
      ? `Multiple stores share this name (${matches.length}); an administrator must choose.`
      : nameCounts.get(key) > 1
        ? 'Multiple onboarding records share this name; an administrator must resolve them first.'
        : matches.length === 0 ? 'No store matches this name.' : null;
    if (reason) {
      (matches.length === 0 || nameCounts.get(key) > 1 ? report.unmatched : report.ambiguous).push({ id: record.id, name: record.name, reason });
      continue;
    }
    const target = matches[0];
    const entry = { id: record.id, name: record.name, store_id: target.id, store_name: target.name };
    report.linkable.push(entry);
    if (!dryRun) {
      await base44.asServiceRole.entities.RetailerOnboarding.update(record.id, { store_id: target.id });
      report.applied.push(entry);
    }
  }

  return report;
}