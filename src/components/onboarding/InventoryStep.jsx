import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, ExternalLink, CheckCircle2, Headphones } from 'lucide-react';

export default function InventoryStep({ store, productCount, loading, isAdmin }) {
  const hasInventory = (productCount || 0) > 0;

  if (hasInventory) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Products synced:</span>
          <span className="font-medium">{productCount}</span>
        </div>
        <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Catalog is saved. The retailer must confirm shelf prices and availability, and launch checks must pass before ordering.</p>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/inventory-upload?store_id=${encodeURIComponent(store.id)}`}><ExternalLink className="w-3.5 h-3.5" /> Upload inventory</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/google-sheet-sync"><ExternalLink className="w-3.5 h-3.5" /> Google Sheet sync</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4">
          <Headphones className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-primary">We'll handle your inventory</p>
            <p className="text-sm text-muted-foreground">
              Our team uploads and syncs your product catalog for you. We'll reach out to collect your product list, or you can email it to <a href="mailto:alcohol.delivered1@gmail.com" className="text-primary hover:underline">alcohol.delivered1@gmail.com</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Package className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Products synced:</span>
        <span className="font-medium">{loading ? '…' : productCount}</span>
      </div>
      <p className="text-sm text-muted-foreground">No products synced yet. Upload or sync from Clover/Google Sheets.</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/inventory-upload?store_id=${encodeURIComponent(store.id)}`}><ExternalLink className="w-3.5 h-3.5" /> Upload inventory</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/google-sheet-sync"><ExternalLink className="w-3.5 h-3.5" /> Google Sheet sync</Link>
        </Button>
      </div>
    </div>
  );
}