// Shared Clover → product-category inference.
// Used by syncCloverInventory (live sync) and importCloverInventoryToStaging
// (staging import) so both classify Clover items identically.

export function inferCategory(item) {
  const name = (item.name || '').toLowerCase();
  const cats = (item.categories?.elements || []).map(c => (c.name || '').toLowerCase());
  const allText = name + ' ' + cats.join(' ');
  if (/beer|ale|lager|ipa|stout|pilsner|busch|bud|miller|coors|corona|heineken|modelo|dos equis|michelob|natural|keystone|pabst|seltzer|cider/.test(allText)) return 'beer';
  if (/wine|chardonnay|merlot|cabernet|pinot|moscato|riesling|zinfandel|sauvignon|malbec|shiraz|prosecco|champagne|barefoot|yellowtail|kendall|rose/.test(allText)) return 'wine';
  if (/vodka|whiskey|bourbon|rum|gin|tequila|scotch|brandy|cognac|liqueur|schnapps|jager|hennessy|crown|jack daniels|jim beam|patron|titos|smirnoff|bacardi|captain morgan/.test(allText)) return 'spirits';
  if (/mixer|soda|tonic|juice|cola|grenadine|sour mix|red bull|monster|rockstar/.test(allText)) return 'mixers';
  if (/opener|corkscrew|glass|cup|coaster|ice bag|accessory|koozie|limes|lemons/.test(allText)) return 'accessories';
  return 'spirits';
}