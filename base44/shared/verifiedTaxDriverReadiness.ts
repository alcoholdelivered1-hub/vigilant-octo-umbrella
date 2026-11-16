import { allSetupRecords } from './retailerSetupAccess.ts';
import { annualComplianceIsCurrent } from './driverAnnualCompliance.ts';

export function taxEvidenceIsComplete(tax) {
  return tax?.status === 'confirmed' && Boolean(tax.source?.trim() && tax.confirmed_at && tax.notes?.trim());
}

export function driverIsProductionQualified(driver) {
  return driver?.status === 'available' && driverHasProductionCredentials(driver);
}

export function driverHasProductionCredentials(driver) {
  if (!driver) return false;
  const dob = driver.date_of_birth ? new Date(driver.date_of_birth) : null;
  const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 21);
  return driver.is_active === true && driver.status !== 'suspended'
    && annualComplianceIsCurrent(driver)
    && driver.training_completed === true && driver.background_check_status === 'clear'
    && Boolean(driver.background_check_id?.trim())
    && !/^(simulated|test|demo|ad-)/i.test(driver.background_check_id.trim())
    && Boolean(driver.background_check_completed_at && dob && Number.isFinite(dob.getTime()) && dob <= cutoff
      && driver.license_number?.trim() && driver.vehicle_info?.trim());
}

export async function readAllMatching(entity, query) {
  return await allSetupRecords(entity, query, '-updated_date');
}