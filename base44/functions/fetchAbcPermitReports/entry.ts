import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const PAGE_URL = 'https://www.dfa.arkansas.gov/office/alcohol-beverage-control/permit-changes/';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const res = await fetch(PAGE_URL, {
      headers: { 'User-Agent': 'AlcoholDelivered/1.0 (ABC compliance sync)' },
    });
    if (!res.ok) {
      return Response.json({ error: `Failed to fetch ABC page (${res.status})` }, { status: 502 });
    }
    const html = await res.text();

    const reports = [];
    const re = /href="(https:\/\/www\.dfa\.arkansas\.gov\/wp-content\/uploads\/[^"]+\.pdf)"[^>]*>([^<]*Permit Changes[^<]*)</gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      const label = m[2].trim();
      const ym = label.match(/([A-Za-z]+)\s+(\d{4})/);
      const month = ym ? ym[1] : '';
      const year = ym ? parseInt(ym[2], 10) : null;
      reports.push({ label, url, month, year });
    }

    // Deduplicate by URL (page may list a report twice)
    const seen = new Set();
    const unique = reports.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    return Response.json({ reports: unique, count: unique.length, source: PAGE_URL });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});