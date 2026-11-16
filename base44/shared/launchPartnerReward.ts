export async function applyLaunchPartnerReward(base44, store, enrollment) {
  const placements = base44.asServiceRole.entities.LaunchPartnerPlacement;
  let placement = (await placements.filter({ store_id: store.id }, 'created_date', 1))[0] || null;
  if (!enrollment || !['approved', 'rewarded'].includes(enrollment.status)) return placement;
  if (!placement && store.onboarding_status === 'live' && store.is_active === true && store.stripe_connection_status === 'connected' && store.compliance_status === 'compliant') {
    const start = Date.now();
    placement = await placements.create({ store_id: store.id, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 30 * 86400000).toISOString() });
  }
  if (placement && enrollment.status !== 'rewarded') {
    await base44.asServiceRole.entities.LaunchPartnerEnrollment.update(enrollment.id, { status: 'rewarded' });
    enrollment.status = 'rewarded';
  }
  return placement;
}