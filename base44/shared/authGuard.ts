/**
 * Shared authorization guards for backend functions.
 *
 * The previous pattern of trusting a client-supplied `body.event` / `body.automation`
 * field to distinguish automation calls from manual calls was unsafe — any anonymous
 * caller could include that field to bypass authentication.
 *
 * The Base44 platform authenticates automation / scheduled-task / workflow invocations
 * internally, so `base44.auth.me()` resolves to a valid admin-level identity for those
 * calls.  Requiring an authenticated admin therefore closes the spoofing hole without
 * breaking legitimate platform automations.
 */

export async function assertAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    return {
      authorized: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  if (user.role !== 'admin') {
    return {
      authorized: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
    };
  }
  return { authorized: true, response: null, user };
}

export async function assertAuthenticated(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    return {
      authorized: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  return { authorized: true, response: null, user };
}

/**
 * Driver operations: the caller must be signed in and own a Driver profile, or be an admin.
 * The Driver record is read with the service role because a driver may not be able to read
 * their own row before the portal finishes provisioning it.
 */
export async function assertDriver(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    return { authorized: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }), user: null, driver: null };
  }
  if (user.role === 'admin') return { authorized: true, response: null, user, driver: null };
  if (!user.email) {
    return { authorized: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }), user, driver: null };
  }
  const drivers = await base44.asServiceRole.entities.Driver.filter({ email: user.email }, '-created_date', 1).catch(() => []);
  const driver = (drivers || [])[0] || null;
  if (!driver) {
    return { authorized: false, response: Response.json({ error: 'No driver profile is linked to this account.' }, { status: 403 }), user, driver: null };
  }
  return { authorized: true, response: null, user, driver };
}

/**
 * Retailer / partner operations: the caller must be an admin, or the store must list the
 * caller's email as its contact (store email or one of its authorized contact_emails).
 * Never trust a store ownership claim supplied in the request body.
 */
export async function assertStoreAccess(base44, storeId) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    return { authorized: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }), user: null, store: null };
  }
  if (typeof storeId !== 'string' || !storeId || storeId.length > 100) {
    return { authorized: false, response: Response.json({ error: 'A retailer is required.' }, { status: 400 }), user, store: null };
  }
  const store = await base44.asServiceRole.entities.Store.get(storeId).catch(() => null);
  if (!store) {
    return { authorized: false, response: Response.json({ error: 'Retailer not found' }, { status: 404 }), user, store: null };
  }
  const email = user.email?.trim().toLowerCase();
  const ownsStore = Boolean(email) && [store.email, ...(store.contact_emails || [])]
    .some(contact => typeof contact === 'string' && contact.trim().toLowerCase() === email);
  if (user.role !== 'admin' && !ownsStore) {
    return { authorized: false, response: Response.json({ error: 'This retailer is not linked to your account.' }, { status: 403 }), user, store };
  }
  return { authorized: true, response: null, user, store };
}