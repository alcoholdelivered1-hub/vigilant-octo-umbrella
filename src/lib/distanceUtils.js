// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate delivery fee: $3.00 base + $1.00 per mile over 7 miles (driver keeps the extra)
export const calculateDeliveryFee = (distance) => {
  const baseFee = 3.0;
  const threshold = 7;
  const extraPerMile = 1.0;
  
  if (distance <= threshold) {
    return baseFee;
  }
  return parseFloat((baseFee + (distance - threshold) * extraPerMile).toFixed(2));
};

// Calculate just the mileage surcharge (driver keeps this) — $1.00 per mile over 7, exact (not rounded)
export const calculateMileageSurcharge = (distance) => {
  const threshold = 7;
  if (distance <= threshold) return 0;
  return parseFloat((distance - threshold).toFixed(2));
};