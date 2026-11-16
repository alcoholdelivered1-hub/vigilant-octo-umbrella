/**
 * Resolves a trusted base URL for building redirect/success/cancel URLs from
 * the incoming request.
 *
 * The Origin header is fully client-controlled and must NEVER be trusted
 * directly: a spoofed Origin could redirect a paying customer to an
 * attacker-controlled page after Stripe checkout (post-payment phishing).
 *
 * Only origins that belong to this app are accepted; otherwise the canonical
 * published app URL is used.
 */
const ALLOWED_ORIGINS = [
  'https://alcohol-delivered-0c72f042.base44.app',
  'https://alcohol-delivered.biz',
];

const CANONICAL_ORIGIN = ALLOWED_ORIGINS[0];

export function resolveAppOrigin(req) {
  const origin = req.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return CANONICAL_ORIGIN;
}