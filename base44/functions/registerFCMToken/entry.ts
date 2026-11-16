import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { setupStore, requireUnambiguousRetailer } from '../../shared/retailerSetupAccess.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { token, store_id, driver_id, device_info } = await req.json();
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || (device_info !== undefined && (typeof device_info !== 'string' || device_info.length > 200))) return Response.json({ error:'A valid device token is required.' },{ status:400 });

    // Validate that store_id belongs to the caller (store.email === user.email)
    let validatedStoreId = '';
    if (store_id) {
      const store = await setupStore(base44,user,store_id);
      await requireUnambiguousRetailer(base44,store);
      validatedStoreId = store.id;
    }

    // Validate that driver_id belongs to the caller (Driver.email === user.email)
    let validatedDriverId = '';
    if (driver_id) {
      if (user.role === 'admin') {
        validatedDriverId = driver_id;
      } else {
        const drivers = await base44.asServiceRole.entities.Driver.filter({ id: driver_id });
        if (drivers[0] && drivers[0].email === user.email) {
          validatedDriverId = driver_id;
        }
      }
    }

    // Check if this token is already registered for this user
    const existing = await base44.asServiceRole.entities.FCMToken.filter({ user_email: user.email, token });

    if (existing.length > 0) {
      // Update existing record (refresh updated_date)
      await base44.asServiceRole.entities.FCMToken.update(existing[0].id, {
        store_id: validatedStoreId || existing[0].store_id,
        driver_id: validatedDriverId || existing[0].driver_id,
        device_info: device_info || existing[0].device_info,
        user_role: user.role || 'user',
      });
      console.log(`FCM token refreshed for ${user.email}`);
      return Response.json({ success: true, updated: true });
    }

    // Register new token
    await base44.asServiceRole.entities.FCMToken.create({
      user_email: user.email,
      user_role: user.role || 'user',
      token,
      store_id: validatedStoreId,
      driver_id: validatedDriverId,
      device_info: device_info || '',
    });

    console.log(`FCM token registered for ${user.email}`);
    return Response.json({ success: true, created: true });
  } catch (error) {
    console.error('registerFCMToken error:', error.message);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}