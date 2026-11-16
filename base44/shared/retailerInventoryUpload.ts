import { setupStore, setupError, allSetupRecords } from './retailerSetupAccess.ts';
import { inventoryUploadRows } from './inventoryUploadRows.ts';
import { inventoryUploadPlan } from './inventoryUploadPlan.ts';

const columns = ['product_id','product_name','category','brand','price','volume','abv','stock_quantity','in_stock','sku','upc','external_id'];
const csvCell = value => `"${String(value ?? '').replace(/"/g,'""')}"`;
export async function retailerInventoryUpload(base44,user,payload) {
  if (!['preview','import','export'].includes(payload.action)) throw setupError('Choose preview, import, or export.');
  const store = await setupStore(base44,user,payload.store_id);
  if (store.id === '6a3bed91eb84bc989a04e479' && payload.action !== 'export') throw setupError('Colonial inventory is POS-authoritative. Submit its POS export through retailer setup for review.',409);
  const products = await allSetupRecords(base44.asServiceRole.entities.Product,{ store_id:store.id },'name');
  if (payload.action === 'export') {
    const csv = [columns.join(','), ...products.map(product => columns.map(key => csvCell(key === 'product_id' ? product.id : key === 'product_name' ? product.name : key === 'price' ? Number(product.price || 0).toFixed(2) : product[key])).join(','))].join('\r\n');
    return { success:true,csv,count:products.length };
  }
  const parsed = await inventoryUploadRows(base44,payload);
  const { plan,errors:matchErrors } = inventoryUploadPlan(parsed.rows,products);
  const errors = [...parsed.errors,...matchErrors];
  const preview = {
    success:true,total_rows:parsed.rows.length,
    created:plan.filter(row => row.action === 'create').length,
    updated:plan.filter(row => row.action === 'update').length,
    errors:errors.slice(0,50),valid:errors.length === 0,
    rows:plan.map(row => ({ row:row.row,action:row.action,...row.update })),
  };
  if (payload.action === 'preview') return preview;
  if (errors.length) return { success:false,error:'Correct the file errors before importing.',...{ errors:preview.errors } };
  const summary = { created:0,updated:0,errors:[],total_rows:plan.length };
  const stamp = new Date().toISOString();
  const creates = plan.filter(row => row.action === 'create').map(row => ({ ...row.update,store_id:store.id,in_stock:row.update.in_stock ?? true,inventory_source:'csv',last_synced_at:stamp }));
  const updates = plan.filter(row => row.action === 'update');
  try {
    for (let i=0;i<creates.length;i+=100) {
      const saved = await base44.asServiceRole.entities.Product.bulkCreate(creates.slice(i,i+100));
      summary.created += Array.isArray(saved) ? saved.length : creates.slice(i,i+100).length;
    }
    for (let i=0;i<updates.length;i+=100) {
      const batch = updates.slice(i,i+100);
      const audits = batch.filter(row => Number(row.existing.price) !== row.update.price).map(row => ({ store_id:store.id,product_id:row.existing.id,product_name:row.existing.name,old_price:Number(row.existing.price || 0),new_price:row.update.price,changed_by_email:user.email,change_reason:'Retailer bulk inventory upload',changed_at:stamp }));
      if (audits.length) await base44.asServiceRole.entities.RetailerPriceAudit.bulkCreate(audits);
      const saved = await base44.asServiceRole.entities.Product.bulkUpdate(batch.map(row => ({ id:row.existing.id,...row.update,inventory_source:'csv',last_synced_at:stamp })));
      summary.updated += Array.isArray(saved) ? saved.length : batch.length;
    }
  } catch (error) {
    console.error('Retailer batch upload failed:',error.message);
    summary.errors.push('The import stopped: '+error.message+'. Refresh inventory before retrying; matching rows will be updated, not added again.');
  }
  return { success:summary.errors.length === 0,summary };
}