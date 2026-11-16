# Beverage King launch handoff — November 1, 2026

## Verified payment mismatch

- Alcohol Delivered Stripe platform accessible to this session: acct_1TOoCnItSFUKmqfV.
- Canonical Beverage King Store: 6a32d14d09b760f592dbf19e; retailer email bevking71603@gmail.com.
- App-mapped connected account: acct_1UID6HK2X4PvQU84; saved connection status pending.
- A complete connected-account list (has_more=false) for the accessible platform did not include the app-mapped account. This does not establish that the account is deleted or invalid; it may belong to another platform.
- Visible Beverage King accounts: acct_1U1pPfIx0BpWWcV5 and acct_1TxBD5RM33s8LkuI. Both returned charges_enabled=false, payouts_enabled=false and requirements.disabled_reason=rejected.fraud.
- Do not remap, recreate accounts or override launch gates without verifying retailer ownership and platform access. Have John, Gajendran and Mr. Singh identify the correct platform and retailer-owned account; obtain Stripe's review decision and confirm charges/payouts.

## Inventory import

- No in-stock Products with inventory_source liquor_bee or csv were found for the canonical store.
- syncBeverageKingLiquorBee uses LIQUOR_BEE_API_URL + /products, Bearer LIQUOR_BEE_API_KEY, limit=5000. This is implementation, not a provider-confirmed API contract.
- Await Liquor Bee's official URL, merchant identification, authentication, schemas, pagination, stock/price semantics and retailer authorization. Do not run sync against an unverified endpoint.
- Import risk: current mapping defaults unknown stock to available, missing/invalid prices to zero, unknown categories to spirits, and matches existing items by name+brand. Validate source data and identifiers before enabling import; do not invent stock or shelf prices.
- Retailer-approved CSV can be a temporary inventory source, but does not prove POS/order acceptance or settlement integration.

## Launch evidence

- Saved RetailerOnboarding says ready/catalog_verified but sandbox_evidence and sandbox_config_signature are null. Saved labels are not proof of a passed test.
- Verify approved retailer documents, permits, tax evidence, verified inventory and a qualified driver with notification receipt.
- Run an isolated sandbox transaction through payment events, store acceptance, pickup, ID/proof of delivery and settlement reconciliation before final activation.
- Existing Richard Campbell order SS-MS7OHVYB must not be duplicated or recharged; reconcile its original processor payment separately.

## Driver signup correction

- Replaced public applicant dependency on private Store records with a required preferred-city text field.
- City is a recruitment preference, not a promise of delivery coverage or driver approval. Whitespace-only city input is rejected and saved values are trimmed.
- Driver applications remain offline/inactive pending review. No driver or store was approved by this change.
