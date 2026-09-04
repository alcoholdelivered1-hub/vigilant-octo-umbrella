/**
 * Arkansas Alcohol Tax Rates
 *
 * 1. State + Local Sales Tax — applied to ALL items (set per DeliveryZone, default 6.5% state).
 * 2. Alcohol Retail Excise Tax — additional point-of-sale tax on alcoholic beverages only.
 *
 * Sources: Arkansas Code § 3-7-201; Arkansas DFA Miscellaneous Tax Descriptions.
 *
 * The per-gallon wholesale excise taxes ($0.372/gal beer, $0.75/gal wine, $2.50/gal spirits)
 * are paid by distributors and embedded in retail price — NOT added at checkout.
 *
 * The retail excise taxes below ARE charged at the point of sale on top of sales tax.
 */
export const AR_ALCOHOL_EXCISE_RATES = {
  beer: 0.01,      // 1% retail excise tax on beer
  wine: 0.03,      // 3% retail excise tax on wine
  spirits: 0.03,   // 3% retail excise tax on liquor/spirits
  mixers: 0.0,     // not alcoholic
  accessories: 0.0, // not alcoholic
};

/**
 * Calculates the Arkansas alcohol retail excise tax for a set of cart items.
 *
 * @param {Array<{category?: string, subtotal?: number, price?: number, quantity?: number}>} items
 * @returns {number} total excise tax in dollars
 */
export function calculateAlcoholExciseTax(items) {
  return items.reduce((sum, item) => {
    const rate = AR_ALCOHOL_EXCISE_RATES[item.category] || 0;
    const itemSubtotal = item.subtotal ?? (item.price * item.quantity) ?? 0;
    return sum + itemSubtotal * rate;
  }, 0);
}