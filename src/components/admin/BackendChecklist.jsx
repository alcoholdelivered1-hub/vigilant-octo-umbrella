import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Zap, Mail, CreditCard, Truck, ShieldCheck, BarChart2, Store } from 'lucide-react';

const STEPS = [
  {
    category: 'Payments',
    icon: CreditCard,
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-200',
    items: [
      { label: 'Stripe live keys set', key: 'stripe_keys', desc: 'STRIPE_SECRET_KEY & STRIPE_PUBLISHABLE_KEY are configured', done: true },
      { label: 'Stripe webhook registered', key: 'stripe_webhook', desc: 'stripeWebhook function handles checkout.session.completed', done: true },
      { label: 'Membership price configured', key: 'stripe_membership', desc: '$10/month membership product exists in Stripe', done: true },
    ],
  },
  {
    category: 'Order Notifications',
    icon: Mail,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    items: [
      { label: 'Order confirmation email', key: 'order_confirm', desc: 'sendOrderConfirmationEmail fires after checkout', done: true },
      { label: 'Retailer new order alert', key: 'retailer_alert', desc: 'notifyRetailerNewOrder emails store on new orders', done: true },
      { label: 'Order status updates', key: 'order_status', desc: 'notifyOrderStatusChange emails customer on status changes', done: true },
      { label: 'STORE_MANAGER_EMAIL secret set', key: 'manager_email', desc: 'Admin notification email is configured', done: true },
    ],
  },
  {
    category: 'Driver Dispatch',
    icon: Truck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    items: [
      { label: 'Notify nearest driver', key: 'notify_driver', desc: 'notifyNearestDriver emails top-3 drivers on confirmed orders', done: true },
      { label: 'One-click claim link', key: 'claim_order', desc: 'claimOrder function lets drivers claim via email link', done: true },
      { label: 'Auto dispatch fallback', key: 'auto_dispatch', desc: 'autoDispatchOrder assigns best available driver by distance', done: true },
      { label: 'Driver assignment notification', key: 'driver_assign', desc: 'notifyDriverAssignment emails driver when assigned', done: true },
    ],
  },
  {
    category: 'Compliance & Verification',
    icon: ShieldCheck,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    items: [
      { label: 'ID verification at checkout', key: 'id_checkout', desc: 'verifyCustomerID runs during checkout flow', done: true },
      { label: 'Failed ID alert', key: 'id_fail', desc: 'notifyFailedIDVerification flags compliance issues', done: true },
      { label: 'Driver alcohol training', key: 'driver_training', desc: 'Drivers must complete training before deliveries', done: true },
      { label: 'New sign-up alert', key: 'signup_alert', desc: 'notifyNewSignup emails admin when a new user registers', done: true },
    ],
  },
  {
    category: 'Inventory & Products',
    icon: Store,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    items: [
      { label: 'Low stock alerts', key: 'low_stock', desc: 'notifyLowStockProduct emails store when inventory is low', done: true },
      { label: 'Inventory sync on delivery', key: 'inventory_sync', desc: 'syncInventoryOnOrderComplete deducts stock after delivery', done: true },
      { label: 'Product CSV import', key: 'csv_import', desc: 'syncProductsFromCSV bulk-imports products from PRODUCTS_CSV_URL', done: true },
      { label: 'PRODUCTS_CSV_URL secret set', key: 'csv_url', desc: 'URL to your product spreadsheet is configured', done: true },
    ],
  },
  {
    category: 'Analytics & Reporting',
    icon: BarChart2,
    color: 'text-primary',
    bg: 'bg-primary/5 border-primary/20',
    items: [
      { label: 'Daily sales calculation', key: 'daily_sales', desc: 'calculateDailySales runs each night to build DailyReport records', done: true },
      { label: 'Google Sheets logging', key: 'sheets_log', desc: 'logOrderToSheets syncs completed orders to Google Sheets', done: true },
      { label: 'Weekly store report', key: 'weekly_report', desc: 'weeklyStoreProductReport emails partners every week', done: true },
      { label: 'Driver rating system', key: 'driver_rating', desc: 'submitDriverRating updates avg_rating after each delivery', done: true },
    ],
  },
  {
    category: 'Loyalty & Marketing',
    icon: Zap,
    color: 'text-pink-600',
    bg: 'bg-pink-50 border-pink-200',
    items: [
      { label: 'Loyalty points on delivery', key: 'loyalty', desc: 'awardLoyaltyPoints credits customer after successful delivery', done: true },
      { label: 'Referral processing', key: 'referral', desc: 'processReferral awards $3 credit on valid referral codes', done: true },
      { label: 'Weekly marketing email', key: 'marketing', desc: 'sendWeeklyMarketingEmail sends promotions to opted-in customers', done: true },
    ],
  },
];

export default function BackendChecklist() {
  const [open, setOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);

  const totalItems = STEPS.flatMap(s => s.items).length;
  const doneItems = STEPS.flatMap(s => s.items).filter(i => i.done).length;
  const allDone = doneItems === totalItems;

  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${allDone ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            {allDone
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              : <Zap className="w-5 h-5 text-amber-600" />
            }
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Backend Code Inventory</p>
            <p className="text-xs text-muted-foreground">{doneItems}/{totalItems} components present in code · live readiness is checked separately</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1">
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(doneItems / totalItems) * 100}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">code</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {STEPS.map((section) => {
            const Icon = section.icon;
            const sectionDone = section.items.filter(i => i.done).length;
            const isExpanded = expandedCat === section.category;

            return (
              <div key={section.category}>
                <button
                  onClick={() => setExpandedCat(isExpanded ? null : section.category)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${section.color}`} />
                    <span className="text-sm font-medium">{section.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{sectionDone}/{section.items.length}</span>
                    <div className="flex gap-0.5">
                      {section.items.map(item => (
                        <div
                          key={item.key}
                          className={`w-2 h-2 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-1" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className={`mx-4 mb-3 rounded-xl border p-3 space-y-2 ${section.bg}`}>
                    {section.items.map(item => (
                      <div key={item.key} className="flex items-start gap-2.5">
                        {item.done
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        }
                        <div>
                          <p className={`text-xs font-semibold ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}