import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import ErrorBoundary from '@/components/ErrorBoundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PublicLanding from './pages/PublicLanding';

import AppLayout from './components/layout/AppLayout';
import AdminRoute from './components/AdminRoute';
import DriverRoute from './components/DriverRoute';
import StoreRoute from './components/StoreRoute';
const Home = lazy(() => import('./pages/Home'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Stores = lazy(() => import('./pages/Stores'));
const StoreDetail = lazy(() => import('./pages/StoreDetail'));
const Checkout = lazy(() => import('./pages/Checkout'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));
const DriverPortal = lazy(() => import('./pages/DriverPortal'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminDrivers = lazy(() => import('./pages/admin/AdminDrivers'));
const AdminStores = lazy(() => import('./pages/admin/AdminStores'));
const AdminZones = lazy(() => import('./pages/admin/AdminZones'));
const Compliance = lazy(() => import('./pages/admin/Compliance'));
const ProductSync = lazy(() => import('./pages/admin/ProductSync'));
const ActiveDeliveries = lazy(() => import('./pages/admin/ActiveDeliveries'));
const Performance = lazy(() => import('./pages/admin/Performance'));
const Profile = lazy(() => import('./pages/Profile'));
const OrderStatus = lazy(() => import('./pages/OrderStatus'));
const DriverManagement = lazy(() => import('./pages/admin/DriverManagement'));
const SalesReports = lazy(() => import('./pages/admin/SalesReports'));
const StorePerformance = lazy(() => import('./pages/admin/StorePerformance'));
const StoreComparison = lazy(() => import('./pages/admin/StoreComparison'));
const DriverSignup = lazy(() => import('./pages/DriverSignup'));
const AutoDispatch = lazy(() => import('./pages/admin/AutoDispatch'));
const ZoneEditor = lazy(() => import('./pages/admin/ZoneEditor'));
const RetailerContract = lazy(() => import('./pages/RetailerContract'));
const RetailerSetup = lazy(() => import('./pages/RetailerSetup'));
const DriverEarnings = lazy(() => import('./pages/DriverEarnings'));
const CustomerComments = lazy(() => import('./pages/admin/CustomerComments'));
const AlcoholSafetyTraining = lazy(() => import('./pages/AlcoholSafetyTraining'));
const PartnerDashboard = lazy(() => import('./pages/partner/PartnerDashboard'));
const LiveMap = lazy(() => import('./pages/admin/LiveMap'));
const DemandHeatmap = lazy(() => import('./pages/admin/DemandHeatmap'));
const DriverAnalytics = lazy(() => import('./pages/admin/DriverAnalytics'));
const LegalDocuments = lazy(() => import('./pages/LegalDocuments'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const EarlySignup = lazy(() => import('./pages/EarlySignup'));
const StoreOwnerDashboard = lazy(() => import('./pages/partner/StoreOwnerDashboard'));
const CloverConnect = lazy(() => import('./pages/partner/CloverConnect'));
const EarlySignups = lazy(() => import('./pages/admin/EarlySignups'));
const ABCComplianceOverview = lazy(() => import('./pages/ABCComplianceOverview'));
const DriverTrainingOverview = lazy(() => import('./pages/DriverTrainingOverview'));
const QRCode = lazy(() => import('./pages/QRCode'));
const RateDelivery = lazy(() => import('./pages/RateDelivery'));
const StoreInventorySync = lazy(() => import('./pages/admin/StoreInventorySync'));
const StoreInventoryUpload = lazy(() => import('./pages/admin/StoreInventoryUpload'));
const InventoryAlerts = lazy(() => import('./pages/admin/InventoryAlerts'));
const StoreRevenueDashboard = lazy(() => import('./pages/admin/StoreRevenueDashboard'));
const DriverLeaderboard = lazy(() => import('./pages/admin/DriverLeaderboard'));
const DriverAgreement = lazy(() => import('./pages/DriverAgreement'));
const ABCPresentation = lazy(() => import('./pages/admin/ABCPresentation'));
const RetailerOnboarding = lazy(() => import('./pages/admin/RetailerOnboarding'));
const DispatchMap = lazy(() => import('./pages/admin/DispatchMap'));
const GoogleSheetInventorySync = lazy(() => import('./pages/admin/GoogleSheetInventorySync'));
const StoreMap = lazy(() => import('./pages/StoreMap'));
const ComplianceIncidents = lazy(() => import('./pages/admin/ComplianceIncidents'));
const StoreOnboardingUpload = lazy(() => import('./pages/admin/StoreOnboardingUpload'));
const LaunchReadiness = lazy(() => import('./pages/admin/LaunchReadiness'));
const AdCreatives = lazy(() => import('./pages/admin/AdCreatives'));
const RetailerCallSheet = lazy(() => import('./pages/admin/RetailerCallSheet'));
const CloverStripeSync = lazy(() => import('./pages/admin/CloverStripeSync'));
const BeverageKingCloverConnect = lazy(() => import('./pages/admin/BeverageKingCloverConnect'));
const BeverageKingGoLive = lazy(() => import('./pages/admin/BeverageKingGoLive'));
const AbcPermitReports = lazy(() => import('./pages/admin/AbcPermitReports'));
const Membership = lazy(() => import('./pages/Membership'));
const StripeExpress = lazy(() => import('./pages/StripeExpress'));
const DriverRecruitment = lazy(() => import('./pages/DriverRecruitment'));
const CustomerAdCampaign = lazy(() => import('./pages/admin/CustomerAdCampaign'));
const DriverAdCampaign = lazy(() => import('./pages/admin/DriverAdCampaign'));
const StripeDashboard = lazy(() => import('./pages/admin/StripeDashboard'));
const ConnectOnboardingTracker = lazy(() => import('./pages/admin/ConnectOnboardingTracker'));
const CloverRetailerConnect = lazy(() => import('./pages/admin/CloverRetailerConnect'));
const CloverSalesDashboard = lazy(() => import('./pages/admin/CloverSalesDashboard'));
const DriverVettingWatchlist = lazy(() => import('./pages/admin/DriverVettingWatchlist'));
const OperationsDashboard = lazy(() => import('./pages/admin/OperationsDashboard'));
const IntegrationsDashboard = lazy(() => import('./pages/admin/IntegrationsDashboard'));
const BulkRetailerEmail = lazy(() => import('./pages/admin/BulkRetailerEmail'));
const RetailerDocuments = lazy(() => import('./pages/admin/RetailerDocuments'));
const StripeOnboardingHub = lazy(() => import('./pages/admin/StripeOnboardingHub'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, checkAppState } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    } else {
      // Network/timeout error — show retry screen instead of blank page
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
          <div className="text-4xl">🍷</div>
          <h1 className="text-xl font-bold">Having trouble connecting</h1>
          <p className="text-sm text-muted-foreground max-w-xs">{authError.message || 'Please check your internet connection and try again.'}</p>
          <button
            onClick={checkAppState}
            className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            Try Again
          </button>
        </div>
      );
    }
  }

  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>}>
    <Routes>
      {/* Auth routes — standalone, no app layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<AppLayout />}>
        {/* Public routes */}
        <Route path="/" element={<PublicLanding />} />
        <Route path="/home" element={<Home />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/stores/:storeId" element={<StoreDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/order-status" element={<OrderStatus />} />
        <Route path="/retailer-contract" element={<RetailerContract />} />
        <Route path="/retailer-onboarding" element={<RetailerSetup />} />
        <Route path="/safety-training" element={<AlcoholSafetyTraining />} />
        {/* Retailer-only area — requires a Store record or admin role */}
        <Route element={<StoreRoute />}>
          <Route path="/Retailer/dashboard" element={<PartnerDashboard />} />
          <Route path="/store/dashboard" element={<StoreOwnerDashboard />} />
          <Route path="/store/clover-connect" element={<CloverConnect />} />
        </Route>
        <Route path="/legal" element={<LegalDocuments />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/support" element={<PublicLanding />} />
        <Route path="/early-signup" element={<EarlySignup />} />
        <Route path="/abc-compliance" element={<ABCComplianceOverview />} />
        <Route path="/driver-training-overview" element={<DriverTrainingOverview />} />
        <Route path="/qr" element={<QRCode />} />
        <Route path="/rate-delivery" element={<RateDelivery />} />
        <Route path="/store-map" element={<StoreMap />} />
        <Route path="/driver/signup" element={<DriverSignup />} />
        <Route path="/membership" element={<Membership />} />
        <Route path="/stripe-express" element={<StripeExpress />} />
        <Route path="/drive" element={<DriverRecruitment />} />

        {/* Admin-only area — requires admin login */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/drivers" element={<AdminDrivers />} />
          <Route path="/admin/stores" element={<AdminStores />} />
          <Route path="/admin/zones" element={<AdminZones />} />
          <Route path="/admin/compliance" element={<Compliance />} />
          <Route path="/admin/product-sync" element={<ProductSync />} />
          <Route path="/admin/deliveries" element={<ActiveDeliveries />} />
          <Route path="/admin/performance" element={<Performance />} />
          <Route path="/admin/driver-management" element={<DriverManagement />} />
          <Route path="/admin/sales-reports" element={<SalesReports />} />
          <Route path="/admin/store-performance" element={<StorePerformance />} />
          <Route path="/admin/store-comparison" element={<StoreComparison />} />
          <Route path="/admin/dispatch" element={<AutoDispatch />} />
          <Route path="/admin/zones/editor" element={<ZoneEditor />} />
          <Route path="/admin/comments" element={<CustomerComments />} />
          <Route path="/admin/live-map" element={<LiveMap />} />
          <Route path="/admin/demand-heatmap" element={<DemandHeatmap />} />
          <Route path="/admin/driver-analytics" element={<DriverAnalytics />} />
          <Route path="/admin/early-signups" element={<EarlySignups />} />
          <Route path="/admin/inventory-sync" element={<StoreInventorySync />} />
          <Route path="/admin/inventory-upload" element={<StoreInventoryUpload />} />
          <Route path="/admin/inventory-alerts" element={<InventoryAlerts />} />
          <Route path="/admin/store-revenue" element={<StoreRevenueDashboard />} />
          <Route path="/admin/driver-leaderboard" element={<DriverLeaderboard />} />
          <Route path="/admin/abc-presentation" element={<ABCPresentation />} />
          <Route path="/admin/retailer-onboarding" element={<RetailerOnboarding />} />
          <Route path="/admin/dispatch-map" element={<DispatchMap />} />
          <Route path="/admin/google-sheet-sync" element={<GoogleSheetInventorySync />} />
          <Route path="/admin/compliance-incidents" element={<ComplianceIncidents />} />
          <Route path="/admin/store-onboarding-upload" element={<StoreOnboardingUpload />} />
          <Route path="/admin/launch-readiness" element={<LaunchReadiness />} />
          <Route path="/admin/ad-creatives" element={<AdCreatives />} />
          <Route path="/admin/call-sheet" element={<RetailerCallSheet />} />
          <Route path="/admin/clover-stripe-sync" element={<CloverStripeSync />} />
          <Route path="/admin/beverage-king-clover" element={<BeverageKingCloverConnect />} />
          <Route path="/admin/beverage-king-golive" element={<BeverageKingGoLive />} />
          <Route path="/admin/abc-permit-reports" element={<AbcPermitReports />} />
          <Route path="/admin/customer-ads" element={<CustomerAdCampaign />} />
          <Route path="/admin/driver-ads" element={<DriverAdCampaign />} />
          <Route path="/admin/stripe" element={<StripeDashboard />} />
          <Route path="/admin/connect-status" element={<ConnectOnboardingTracker />} />
          <Route path="/admin/clover-connect" element={<CloverRetailerConnect />} />
          <Route path="/admin/clover-sales" element={<CloverSalesDashboard />} />
          <Route path="/admin/driver-vetting" element={<DriverVettingWatchlist />} />
          <Route path="/admin/operations" element={<OperationsDashboard />} />
          <Route path="/admin/integrations" element={<IntegrationsDashboard />} />
          <Route path="/admin/bulk-email" element={<BulkRetailerEmail />} />
          <Route path="/admin/retailer-documents" element={<RetailerDocuments />} />
          <Route path="/onboarding-hub" element={<StripeOnboardingHub />} />
        </Route>

        {/* Driver-only area — requires a Driver record or admin role */}
        <Route element={<DriverRoute />}>
          <Route path="/driver" element={<DriverPortal />} />
          <Route path="/driver/earnings" element={<DriverEarnings />} />
          <Route path="/driver-agreement" element={<DriverAgreement />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SonnerToaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App