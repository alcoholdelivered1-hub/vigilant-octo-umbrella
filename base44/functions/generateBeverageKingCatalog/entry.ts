/**
 * Generates a comprehensive ~10,000 product catalog for BEVERAGE KING
 * using AI-generated product data across all liquor store categories,
 * then creates pack-size/volume variations to reach the target count.
 *
 * POST body: { store_id?: string }  (defaults to BEVERAGE KING)
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

// Category → pack size variations
const VARIATIONS = {
  beer: [
    { pack_size: 'Single', vol: '12oz', mult: 0.12 },
    { pack_size: '6-Pack', vol: '12oz', mult: 0.72 },
    { pack_size: '12-Pack', vol: '12oz', mult: 1.35 },
    { pack_size: '18-Pack', vol: '12oz', mult: 1.95 },
    { pack_size: '24-Pack', vol: '12oz', mult: 2.5 },
    { pack_size: '30-Pack', vol: '12oz', mult: 3.1 },
    { pack_size: 'Case', vol: '12oz', mult: 2.4 },
  ],
  wine: [
    { pack_size: '187ml', vol: '187ml', mult: 0.3 },
    { pack_size: '375ml', vol: '375ml', mult: 0.55 },
    { pack_size: '750ml', vol: '750ml', mult: 1.0 },
    { pack_size: '1.5L', vol: '1.5L', mult: 1.85 },
  ],
  spirits: [
    { pack_size: '50ml', vol: '50ml', mult: 0.15 },
    { pack_size: '200ml', vol: '200ml', mult: 0.35 },
    { pack_size: '375ml', vol: '375ml', mult: 0.6 },
    { pack_size: '750ml', vol: '750ml', mult: 1.0 },
    { pack_size: '1L', vol: '1L', mult: 1.3 },
    { pack_size: '1.75L', vol: '1.75L', mult: 2.1 },
  ],
  mixers: [
    { pack_size: 'Single', vol: '1L', mult: 1.0 },
    { pack_size: '6-Pack', vol: '7.5oz', mult: 3.5 },
    { pack_size: '12-Pack', vol: '7.5oz', mult: 6.5 },
  ],
  accessories: [
    { pack_size: 'Single', vol: '', mult: 1.0 },
  ],
};

function normalizeCategory(cat) {
  const c = (cat || '').toLowerCase();
  if (/champagne|sparkling|prosecco|cava|cremant/.test(c)) return 'wine';
  if (/rose/.test(c)) return 'wine';
  if (/beer|ale|lager|ipa|stout|porter|pilsner|cider|seltzer|malt/.test(c)) return 'beer';
  if (/mixer|soda|tonic|juice|bitter|syrup|grenadine|olive|cherry|salt/.test(c)) return 'mixers';
  if (/accessor|opener|glass|cup|shaker|flask|coaster|koozie|spout|jigger/.test(c)) return 'accessories';
  return 'spirits';
}

const LLM_PROMPTS = [
  { label: 'domestic_beer', prompt: 'List 100 real domestic beer products (Budweiser, Miller, Coors, Natural Light, Keystone, Pabst Blue Ribbon, Busch, Michelob Ultra, Bud Light, Miller Lite, Coors Light, Rolling Rock, Steel Reserve, Old Milwaukee, Icehouse, High Life, Hamms, Lone Star, Yuengling, Busch Light, Genesee, Rainier, Olympia, Schlitz, Blatz, Red Dog, Colt 45, Olde English 800, Mickeys, etc). Each as Single 750ml.' },
  { label: 'craft_beer', prompt: 'List 100 real craft beer products (Sierra Nevada, Sam Adams, Lagunitas, Stone, Dogfish Head, Founders, Bells, New Belgium, Deschutes, Oskar Blues, Goose Island, Blue Moon, Fat Tire, Anchor Steam, Brooklyn Brewery, SweetWater, Avery, Ballast Point, Green Flash, Cigar City, Odell, Stone, Great Divide, Left Hand, Breckenridge, Boulevard, Odell, Founders, Southern Tier, Oskar Blues, Clown Shoes, Weldwerks, Trillium, Tree House, The Alchemist, Lawson, Hill Farmstead, etc). Include IPAs, stouts, porters, ales, lagers, sours, saisons.' },
  { label: 'imported_beer', prompt: 'List 100 real imported beer products (Corona, Heineken, Modelo, Dos Equis, Stella Artois, Guinness, Red Stripe, Sapporo, Tsingtao, Fosters, Peroni, Pilsner Urquell, Becks, Amstel Light, Newcastle, Bass, Smithwicks, Hofbrau, Spaten, Warsteiner, St Pauli Girl, Labatt Blue, Molson Canadian, Kirin, Singha, Tiger, Boddingtons, Fullers, Hobgoblin, Innis & Gunn, Weihenstephaner, Franziskaner, Paulaner, Erdinger, Modelo Negra, Dos Equis Ambar, Pacifico, Victoria, Estrella Jalisco, Montejo, Tennents, Harp, Smithwicks, Kilkenny, Magners, Strongbow, etc).' },
  { label: 'red_wine', prompt: 'List 120 real red wine products (Barefoot, Yellow Tail, Kendall Jackson, Woodbridge, Menage a Trois, Apothic, Josh Cellars, Meiomi, The Prisoner, Decoy, La Crema, Belle Glos, Caymus, Silver Oak, Cakebread, Stags Leap, Rodney Strong, Chateau Ste Michelle, Columbia Crest, 14 Hands, 19 Crimes, Dark Horse, Bota Box, Black Box, Francis Ford Coppola, Justin, Dao, Ornellaia, Antinori, Frescobaldi, Penfolds, Wolf Blass, Lindemans, Yalumba, Trapiche, Norton, Santa Julia, Casillero del Diablo, Concha y Toro, Santa Rita, Hess, Sebastiani, Ravenswood, Clos du Bois, Estancia, Hahn, J Lohr, Cline, McManis, Carnivor, Boden, Sledgehammer, 7 Deadly, Avalon, Cooper & Thief, Bread & Butter, Decoy, etc). Include Cabernet Sauvignon, Merlot, Pinot Noir, Red Blend, Zinfandel, Malbec, Shiraz, Tempranillo, Sangiovese, Barbera, Nebbiolo.' },
  { label: 'white_wine', prompt: 'List 120 real white wine products (Barefoot, Yellow Tail, Kendall Jackson, Woodbridge, Menage a Trois, Apothic, Josh Cellars, Meiomi, La Crema, Decoy, Chateau Ste Michelle, Columbia Crest, 14 Hands, 19 Crimes, Dark Horse, Bota Box, Black Box, Francis Ford Coppola, Oyster Bay, Kim Crawford, Nobilo, Brancott Estate, Montana, Villa Maria, Cloudy Bay, Santa Margherita, Ruffino, Folonari, Cavit, Ecco Domani, Frescobaldi, Antinori, Penfolds, Wolf Blass, Lindemans, Yalumba, Trapiche, Norton, Santa Julia, Casillero del Diablo, Concha y Toro, Hess, Sebastiani, Ravenswood, Clos du Bois, Estancia, Hahn, J Lohr, Cline, etc). Include Chardonnay, Sauvignon Blanc, Pinot Grigio, Riesling, Moscato, White Blend, Gewurztraminer, Viognier, Albarino, Grüner Veltliner.' },
  { label: 'sparkling_wine', prompt: 'List 80 real sparkling wine, champagne, rosé and dessert wine products (Moet & Chandon, Veuve Clicquot, Dom Perignon, Nicolas Feuillatte, Perrier Jouet, Taittinger, Bollinger, Laurent-Perrier, Krug, Piper-Heidsieck, G.H. Mumm, Ruinart, La Marca, Martini & Rossi, Mionetto, Ruffino, Zonin, Barefoot, Cooks, Andre, Korbel, Freixenet, Gloria Ferrer, Mumm Napa, Chandon, Roscato, Stella Rosa, Whispering Angel, Miraval, Dark Horse Rose, White Girl Rose, La Vieille Ferme Rose, Mulderbosch Rose, Sauternes, Taylor Fladgate, Fonseca, Grahams, Dow, Warre, Cockburn, Sandeman, Harveys, Tio Pepe, etc).' },
  { label: 'vodka_gin', prompt: 'List 100 real vodka and gin products (Titos, Smirnoff, Absolut, Grey Goose, Belvedere, Stolichnaya, Ketel One, Skyy, New Amsterdam, Pinnacle, Svedka, Burnetts, Crystal Head, Ciroc, Deep Eddy, Hangar 1, Reyka, Finlandia, Three Olives, UV, Karkov, Seagrams, Gordons, Barton, Mr Boston, Fleischmanns, Crystal Palace, Popov, McCormick, Taaka, Nikolai, Tanqueray, Bombay Sapphire, Hendricks, Beefeater, Gordons, Seagrams, New Amsterdam, Aviation, The Botanist, Plymouth, Bulldog, Monkey 47, Roku, Empress, Hendricks Lunar, Genevieve, etc).' },
  { label: 'whiskey_bourbon', prompt: 'List 120 real whiskey, bourbon, and scotch products (Jack Daniels, Jim Beam, Makers Mark, Woodford Reserve, Bulleit, Buffalo Trace, Wild Turkey, Knob Creek, Makers 46, Four Roses, Evan Williams, Heaven Hill, Old Forester, Colonel EH Taylor, Blantons, Eagle Rare, Weller, Pappy Van Winkle, Basil Hayden, Crown Royal, Seagrams 7, Canadian Club, Canadian Mist, Black Velvet, Jameson, Bushmills, Tullamore Dew, Kilbeggan, Powers, Redbreast, Green Spot, Midleton, Glenlivet, Glenfiddich, Macallan, Lagavulin, Laphroaig, Oban, Talisker, Highland Park, Ardbeg, Bowmore, Caol Ila, Auchentoshan, Balvenie, Dalmore, Johnnie Walker Red/Black/Double Black/Green/Gold/Blue, Chivas Regal, Dewars, Cutty Sark, Famous Grouse, Grants, JB, Ballantines, etc).' },
  { label: 'tequila_rum_cognac', prompt: 'List 120 real tequila, rum, cognac, brandy, and liqueur products (Patron, Don Julio, Jose Cuervo, Sauza, 1800, Casamigos, Herradura, El Jimador, Milagro, Espolon, Avion, Cazadores, Cabo Wabo, Clase Azul, Fortaleza, Tapatio, Olmeca Altos, Lunazul, Tres Agaves, Corralejo, Porfidio, Bacardi, Captain Morgan, Malibu, Meyers, Kraken, Goslings, Appleton Estate, Mount Gay, Havana Club, Cruzan, Don Q, Brugal, Flor de Cana, Diplomatico, Zacapa, Sailor Jerry, Hennessy, Remy Martin, Martell, Courvoisier, Pierre Ferrand, Camus, Hine, Kelt, Paul Masson, Christian Brothers, E&J, Korbel, Torres, Asbach, Baileys, Kahlua, Grand Marnier, Cointreau, Triple Sec, Disaronno, Frangelico, Chambord, Midori, Jagermeister, Campari, Aperol, Pimms, Drambuie, Chartreuse, Benedictine, Galliano, Sambuca, Schnapps, etc).' },
  { label: 'mixers_accessories', prompt: 'List 80 real mixers, accessories, and supplies (Coca-Cola, Diet Coke, Sprite, Dr Pepper, Fever-Tree Tonic, Q Mixers, Canada Dry, Schweppes, Goslings Ginger Beer, Mr & Mrs T Sour Mix, Roses Grenadine, Roses Lime Juice, Tres Agaves Agave, Simple Syrup, Jose Cuervo Margarita Mix, Zing Zang Bloody Mary Mix, Coco Lopez Pina Colada Mix, Angostura Bitters, Peychauds Bitters, Mezzetta Olives, Tillen Farms Cocktail Onions, Luxardo Cherries, Twang Margarita Salt, Red Bull, Monster, Rockstar, Celsius, Jack Rudy Tonic Syrup, Bottle Openers, Corkscrews, Wine Glasses, Beer Glasses, Shot Glasses, Cocktail Shakers, Ice Bags, Koozies, Coasters, Flasks, Pour Spouts, Jiggers, Muddlers, Strainers, Cutting Boards, etc).' },
];

const LLM_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          brand: { type: 'string' },
          category: { type: 'string' },
          price: { type: 'number' },
          pack_size: { type: 'string' },
          volume: { type: 'string' },
          abv: { type: 'number' },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled */ }
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    // Phase 1: Generate base products via LLM
    let allBase = [];
    for (const { label, prompt } of LLM_PROMPTS) {
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${prompt} Return as JSON array with fields: name, brand, category, price (USD), pack_size, volume, abv.`,
        response_json_schema: LLM_SCHEMA,
      });
      const products = res.products || [];
      console.log(`[${label}] Generated ${products.length} base products`);
      allBase = allBase.concat(products);
    }

    console.log(`Total base products: ${allBase.length}`);

    // Phase 2: Create pack-size variations
    const allProducts = [];
    for (const p of allBase) {
      if (!p.name) continue;
      const cat = normalizeCategory(p.category);
      const variations = VARIATIONS[cat] || VARIATIONS.spirits;

      for (const v of variations) {
        const priceMult = v.mult;
        const adjustedPrice = Math.round((p.price || 10) * priceMult * 100) / 100;
        allProducts.push({
          name: p.name,
          brand: p.brand || '',
          category: cat,
          description: '',
          price: adjustedPrice,
          pack_size: v.pack_size,
          volume: v.vol || p.volume || '',
          abv: p.abv || 0,
          store_id: storeId,
          image_url: '',
          in_stock: true,
        });
      }
    }

    console.log(`Total products with variations: ${allProducts.length}`);

    // Phase 3: Get existing product names to avoid exact duplicates
    const existing = await base44.asServiceRole.entities.Product.filter({ store_id: storeId });
    const existingKeys = new Set();
    for (const e of existing) {
      existingKeys.add(`${e.name}|${e.pack_size || ''}|${e.volume || ''}`);
    }

    const newProducts = allProducts.filter(p =>
      !existingKeys.has(`${p.name}|${p.pack_size || ''}|${p.volume || ''}`)
    );

    console.log(`${newProducts.length} new products to create (after dedup)`);

    // Phase 4: Bulk create in batches of 500
    let created = 0;
    for (let i = 0; i < newProducts.length; i += 500) {
      const batch = newProducts.slice(i, i + 500);
      await base44.asServiceRole.entities.Product.bulkCreate(batch);
      created += batch.length;
      console.log(`Created batch ${Math.floor(i / 500) + 1}: ${created}/${newProducts.length}`);
    }

    // Final count
    const finalCount = await base44.asServiceRole.entities.Product.filter({ store_id: storeId });

    return Response.json({
      success: true,
      store_id: storeId,
      base_products_generated: allBase.length,
      variations_created: allProducts.length,
      deduped: newProducts.length,
      created,
      total_products_now: finalCount.length,
    });
  } catch (error) {
    console.error('generateBeverageKingCatalog error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});