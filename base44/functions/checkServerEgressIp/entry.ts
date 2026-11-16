import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Diagnostic: reports this server runtime's outbound IP addresses, used to ask
// LiquorBee to allowlist our platform's servers for their Partner API.

async function probeText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  return text.trim();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const probes = await Promise.allSettled([
      probeText('https://api.ipify.org'),
      probeText('https://api64.ipify.org'),
      probeText('https://ipv4.icanhazip.com'),
      probeText('https://ipv6.icanhazip.com'),
      probeText('https://checkip.amazonaws.com'),
    ]);

    const ips = [];
    for (const probe of probes) {
      if (probe.status === 'fulfilled' && /^[0-9a-fA-F:.]+$/.test(probe.value)) ips.push(probe.value);
    }

    return Response.json({ ips: [...new Set(ips)] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}