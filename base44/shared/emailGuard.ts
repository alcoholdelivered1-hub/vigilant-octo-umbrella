// Shared email suppression guard.
//
// Ensures the app NEVER sends emails to Arkansas ABC / state government
// recipients. Transactional emails to customers, drivers, retailers, and
// internal admins continue normally — only government/ABC addresses are
// blocked.
//
// Import `isBlockedRecipient` in any backend function that resolves an
// outbound email recipient, and skip the send when it returns true.

// Exact addresses that must never receive mail from us.
const BLOCKED_ADDRESSES = new Set([
  'drew.cousins@dfa.arkansas.gov',
]);

// Domains that are always treated as government/ABC recipients.
const BLOCKED_DOMAINS = [
  'dfa.arkansas.gov',
  'arkansas.gov',
  'arkansas.com',
];

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function isBlockedRecipient(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = normalizeEmail(email);
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  if (BLOCKED_ADDRESSES.has(e)) return true;
  return BLOCKED_DOMAINS.some((d) => e.endsWith('@' + d) || e.endsWith('.' + d));
}

// Returns the first non-blocked recipient from a list, or null if all are blocked.
export function pickAllowedRecipient(emails: (string | null | undefined)[]): string | null {
  for (const e of emails) {
    if (e && !isBlockedRecipient(e) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(e))) {
      return normalizeEmail(e);
    }
  }
  return null;
}