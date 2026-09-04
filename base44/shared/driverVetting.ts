// Security gate for driver order assignment.
// A driver may only claim or be assigned orders when their background check
// is genuinely cleared by an approved provider AND alcohol-safety training is
// complete. Simulated/test background-check results are rejected so that no
// unvetted driver can handle customer purchases or products.

export interface DriverRecord {
  background_check_status?: string;
  background_check_id?: string;
  training_completed?: boolean;
  is_active?: boolean;
  status?: string;
}

// True only when the background check is 'clear' and the check id is a real
// provider id (e.g. a Checkr report id) — not a simulated/test placeholder.
export function isBackgroundCheckGenuine(driver: DriverRecord): boolean {
  if (!driver) return false;
  if (driver.background_check_status !== 'clear') return false;
  const id = driver.background_check_id;
  if (!id) return false;
  if (id.startsWith('simulated_') || id.startsWith('test_')) return false;
  return true;
}

// Full vetting gate used by claimOrder / autoDispatchOrder.
export function isDriverVetted(driver: DriverRecord): { ok: boolean; reason?: string } {
  if (!driver) return { ok: false, reason: 'No driver profile found for your account.' };
  if (!driver.is_active) return { ok: false, reason: 'Your driver account is not currently active.' };
  if (driver.status === 'suspended') return { ok: false, reason: 'Your driver account is suspended.' };
  if (!driver.training_completed) {
    return { ok: false, reason: 'You must complete alcohol-safety training before accepting orders.' };
  }
  if (!isBackgroundCheckGenuine(driver)) {
    return {
      ok: false,
      reason:
        'A cleared background check from an approved provider is required before you can accept orders. Pending or test checks do not qualify.',
    };
  }
  return { ok: true };
}