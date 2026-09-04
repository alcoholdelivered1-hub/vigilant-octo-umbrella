// Detects whether the app is running inside the Base44-generated native
// mobile wrapper (iOS WKWebView / Android WebView / Capacitor bridge).
//
// Why this exists: Apple and Google require digital subscriptions (like our
// $10/mo membership) to use their native in-app purchase systems inside a
// native app. Base44 does not yet expose StoreKit / Google Play Billing, so
// we use the approved "reader app" model — the mobile app may SHOW membership
// status and perks, but must NOT present a Stripe purchase button or an
// external purchase call-to-action. Stripe checkout stays on the web app.
//
// A PWA installed to the home screen (navigator.standalone) is just a website
// and is NOT subject to the IAP rules, so it is intentionally excluded here.
export function isMobileApp() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // Capacitor / native bridge injected by some wrapper toolchains
  if (window.Capacitor || window.isNativeApp) return true;

  // Android WebView — UA contains "; wv)" or "wv" on Android
  if (/Android/i.test(ua) && /\bwv\b/i.test(ua)) return true;

  // iOS WKWebView — AppleWebKit present but no standalone Safari token
  if (/(iPhone|iPad|iPod).*AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) return true;

  return false;
}