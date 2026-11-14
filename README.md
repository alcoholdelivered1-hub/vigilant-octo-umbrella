# Alcohol Delivered

## Local development

1. Install the locked dependencies with `npm ci`.
2. Set `VITE_BASE44_APP_ID` in the local environment and configure any Base44
   function version or app URL values required by your Base44 deployment.
3. Run `npm run dev`.

## Production build

Run `npm run build`; the deployable static assets are written to `dist/`.
The Base44 project configuration uses `npm run build` and `dist/` as the output
directory.

## Optional push notifications

Set these Firebase Web App values in the deployment environment to enable
browser push notifications:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

Push notifications remain disabled when any required Firebase value is absent.
These are public client configuration values, not server secrets. Never put
Firebase Admin credentials, private keys, Stripe secret keys, or Clover tokens
in `VITE_` variables or commit them to this repository.
