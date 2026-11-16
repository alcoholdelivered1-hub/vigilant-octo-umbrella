import * as XLSX from 'npm:xlsx@0.18.5';
import { retailerProductChanges } from './retailerProductChanges.ts';
import { setupError } from './retailerSetupAccess.ts';

export async function inventoryUploadRows(base44, payload) {
  const { file_uri, filename } = payload;
  if (typeof file_uri !== 'string' || file_uri.length > 1500 || typeof filename !== 'string' || filename.length > 200 || !/\.(csv|xlsx|xls)$/i.test(filename)) throw setupError('Choose a CSV or Excel inventory file.');
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
  const response = await fetch(signed_url);
  if (!response.ok) throw setupError('The uploaded file could not be opened. Upload it again.');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5 * 1024 * 1024) { await reader.cancel(); throw setupError('Inventory files must be no larger than 5 MB.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const workbook = XLSX.read(bytes, { type:'array', raw:true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.['!ref']) throw setupError('The first sheet is empty.');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  if (range.e.r > 500 || range.e.c > 30) throw setupError('Use at most 500 product rows and 31 columns on the first sheet.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:'', raw:false });
  const headers = rows.shift().map(value => String(value).trim().toLowerCase().replace(/\s+/g,'_'));
  if ((!headers.includes('product_name') && !headers.includes('name')) || !headers.includes('price') || !headers.includes('category')) throw setupError('Required columns: product_name (or name), category, price. Download the template for the complete format.');
  const usedHeaders = headers.filter(Boolean);
  if (new Set(usedHeaders).size !== usedHeaders.length) throw setupError('Remove duplicate column headings.');
  const result = [], errors = [];
  rows.forEach((values, index) => {
    if (!values.some(value => String(value).trim())) return;
    const row = Object.fromEntries(headers.filter(Boolean).map(key => [key, String(values[headers.indexOf(key)] ?? '').trim()]));
    const input = { name:row.product_name || row.name, category:row.category?.toLowerCase(), price:row.price.replace(/^\$/, '').replace(/,/g,'') };
    for (const key of ['brand','volume','description']) if (row[key]) input[key] = row[key];
    if (row.stock_quantity) {
      if (!/^\d+$/.test(row.stock_quantity.replace(/,/g,''))) errors.push(`Row ${index+2}: stock_quantity must be a whole nonnegative number.`);
      input.stock_quantity = Number(row.stock_quantity.replace(/,/g,''));
    }
    if (row.in_stock) {
      const value = row.in_stock.toLowerCase();
      if (!['true','false','yes','no','1','0'].includes(value)) errors.push(`Row ${index+2}: in_stock must be true or false.`);
      input.in_stock = ['true','yes','1'].includes(value);
    } else if (input.stock_quantity !== undefined) input.in_stock = input.stock_quantity > 0;
    const { update, error } = retailerProductChanges(input, true);
    if (error) { errors.push(`Row ${index+2}: ${error}`); return; }
    if (row.abv) {
      const abv = Number(row.abv);
      if (!Number.isFinite(abv) || abv < 0 || abv > 100) errors.push(`Row ${index+2}: abv must be between 0 and 100.`);
      else update.abv = abv;
    }
    for (const key of ['sku','upc','external_id']) if (row[key]) {
      if (row[key].length > 200) errors.push(`Row ${index+2}: ${key} is too long.`);
      else update[key] = row[key];
    }
    delete update.last_synced_at; delete update.inventory_source;
    // Missing optional columns preserve existing product values during updates.
    if (!row.stock_quantity) delete update.stock_quantity;
    if (!row.in_stock && input.stock_quantity === undefined) delete update.in_stock;
    result.push({ row:index+2, product_id:row.product_id || '', update });
  });
  if (!result.length && !errors.length) errors.push('No product rows were found.');
  return { rows:result, errors };
}