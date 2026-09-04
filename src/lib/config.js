// App Configuration
export const APP_CONFIG = {
  // Set to true when ABC approves the platform for sales
  ABC_APPROVED: true,
};

// Arkansas GIS Municipal Boundaries — official geographic reference
export const GIS_BOUNDARY = {
  source_name: 'Arkansas GIS Office — Municipal Boundaries',
  dataset_url: 'https://gis.arkansas.gov/product/municipal-boundaries-polygon/',
  check_my_city_url: 'https://gis.arkansas.gov/checkmycity/',
  last_updated: '2026-07-15',
  boundary_version: 'AR-GIS-MUNI-2026-07-15',
  // Internal admin notice — Humphrey ward correction (not a boundary expansion)
  humphrey_notice:
    'The July 15, 2026 Arkansas GIS update made a ward-only correction for Humphrey based on a historic 1959 ordinance. This was not identified as a municipal-boundary expansion. Do not change customer delivery eligibility based solely on a ward correction.',
};