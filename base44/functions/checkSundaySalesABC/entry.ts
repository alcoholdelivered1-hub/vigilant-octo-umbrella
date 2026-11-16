import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { normalizeJurisdictionName } from '../../shared/sundaySalesRules.ts';

// Admin-only: checks Arkansas ABC (DFA) and certified sources for local-option
// Sunday alcohol sales jurisdictions, then applies them when they are in
// effect. A jurisdiction is only ever marked 'certified' with an ABC-confirmed
// effective date and a real source URL; a passed-but-uncertified vote stays
// 'pending_abc_certification' and Sunday delivery stays blocked there.
// A record that is already 'certified' is never demoted automatically.

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    jurisdictions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          county: { type: 'string' },
          jurisdiction_type: { type: 'string', enum: ['city', 'county'] },
          election_passed: { type: 'boolean' },
          result_known: { type: 'boolean' },
          abc_certified: { type: 'boolean' },
          effective_date: { type: 'string' },
          source_url: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['county', 'jurisdiction_type', 'election_passed', 'abc_certified'],
      },
    },
  },
  required: ['jurisdictions'],
};

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { items: existing } = await base44.asServiceRole.entities.SundaySalesJurisdiction.list({ limit: 200 });
    const keyOf = (r) =>
      `${normalizeJurisdictionName(r.city)}|${normalizeJurisdictionName(r.county)}|${r.jurisdiction_type}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_8_flash',
      add_context_from_internet: true,
      response_json_schema: RESPONSE_SCHEMA,
      prompt: [
        'You are checking Arkansas local-option Sunday alcohol sales (off-premises retail sales at liquor stores) for a delivery platform.',
        'Research: (1) every jurisdiction the platform currently tracks, listed below; (2) any other Arkansas city or county with a Sunday alcohol sales local option, including results from the November 3, 2026 Arkansas general election and any Arkansas Alcoholic Beverage Control / Arkansas DFA announcements certifying results or setting effective dates.',
        'For each jurisdiction report: the city name (empty string for county-wide options), the Arkansas county, the jurisdiction level (city or county), election_passed (true only if voters approved it; false if voters rejected it), result_known (true only when you found actual post-election results for this ballot question; false when the measure was merely on a ballot and results are unknown or unreported), abc_certified (true only if Arkansas ABC has certified the results so Sunday sales are legally in effect), the effective date in YYYY-MM-DD format (empty string if not certified or unknown), a source URL (prefer dfa.arkansas.gov, an official county election commission, or a major Arkansas news outlet), and short notes.',
        'Only report real jurisdictions you found in sources. Never invent jurisdictions, dates or URLs.',
        `Jurisdictions currently tracked: ${existing.map(r => `${r.city || r.county} (${r.county} County, ${r.jurisdiction_type})`).join('; ') || 'none'}.`,
      ].join(' '),
    });

    const found = Array.isArray(result?.jurisdictions) ? result.jurisdictions : [];
    const now = new Date().toISOString();
    const changes = [];

    for (const item of found) {
      if (!item?.county || !item?.jurisdiction_type) continue;
      const city = String(item.city || '').trim();
      const county = String(item.county).trim();
      const record = existing.find(r => keyOf(r) === `${normalizeJurisdictionName(city)}|${normalizeJurisdictionName(county)}|${item.jurisdiction_type}`);

      const certified = item.abc_certified === true
        && /^\d{4}-\d{2}-\d{2}$/.test(String(item.effective_date || ''))
        && /^https?:\/\/\S+$/i.test(String(item.source_url || ''));

      const patch = { last_checked_at: now };
      if (certified) {
        Object.assign(patch, {
          status: 'certified',
          effective_date: String(item.effective_date),
          source_url: String(item.source_url),
          evidence_notes: String(item.notes || '').slice(0, 500),
          verified_by: 'checkSundaySalesABC',
          verified_at: now,
        });
      } else if (item.election_passed === true) {
        patch.status = 'pending_abc_certification';
        patch.evidence_notes = String(item.notes || '').slice(0, 500);
        if (/^https?:\/\//.test(String(item.source_url || ''))) patch.source_url = String(item.source_url);
      } else if (item.result_known === true && item.election_passed === false && /^https?:\/\//.test(String(item.source_url || ''))) {
        // A source confirms this measure actually failed at the ballot.
        if (record && record.status !== 'certified') {
          patch.status = 'not_available';
          patch.evidence_notes = String(item.notes || '').slice(0, 500);
          if (/^https?:\/\//.test(String(item.source_url || ''))) patch.source_url = String(item.source_url);
        }
      } else {
        // Results unknown: tracked records keep their current status; nothing new is created.
        if (!record) continue;
      }

      if (record) {
        if (record.status === 'certified') delete patch.status; // never un-certify automatically
        await base44.asServiceRole.entities.SundaySalesJurisdiction.update(record.id, patch);
        changes.push({ jurisdiction: `${city || county} (${county})`, action: 'updated', status: patch.status || record.status });
      } else {
        await base44.asServiceRole.entities.SundaySalesJurisdiction.create({
          jurisdiction_type: item.jurisdiction_type, city, county, ...patch,
        });
        changes.push({ jurisdiction: `${city || county} (${county})`, action: 'created', status: patch.status });
      }
    }

    return Response.json({
      success: true,
      checked_at: now,
      jurisdictions_reviewed: found.length,
      changes,
    });
  } catch (error) {
    console.error('checkSundaySalesABC error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}