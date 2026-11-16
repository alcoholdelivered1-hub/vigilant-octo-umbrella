import React from 'react';
export default function InventoryBulkPreview({ preview }) {
  if (!preview) return null;
  return <div className="space-y-3">
    <p className="text-sm font-medium">{preview.total_rows} products: {preview.created} new, {preview.updated} updates. Nothing is deleted.</p>
    {!!preview.errors?.length && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive"><p className="font-medium">Correct these errors and upload again. No products have been changed.</p><ul className="list-disc pl-5">{preview.errors.map((error,index) => <li key={index}>{error}</li>)}</ul></div>}
    {!!preview.rows?.length && <div className="max-h-64 overflow-auto rounded-lg border"><table className="w-full text-left text-sm"><caption className="sr-only">Inventory upload preview</caption><thead className="bg-muted"><tr><th className="p-3">Row</th><th className="p-3">Product</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Action</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.row} className="border-t"><td className="p-3">{row.row}</td><td className="p-3">{row.name}{row.volume ? ` · ${row.volume}` : ''}</td><td className="p-3">${Number(row.price).toFixed(2)}</td><td className="p-3">{row.stock_quantity ?? 'Unchanged / untracked'}</td><td className="p-3">{row.action === 'create' ? 'Add' : 'Update'}</td></tr>)}</tbody></table></div>}
  </div>;
}