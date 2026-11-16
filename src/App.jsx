import React, { Suspense, lazy } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { Toaster as ActionToaster } from '@/components/ui/sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginRedirect from '@/components/auth/LoginRedirect';
import ErrorBoundary from '@/components/ErrorBoundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';

// Lazy-loaded pages for faster startup
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const Receipt = lazy(() => import('./pages/Receipt'));

const Welcome = lazy(() => import('./pages/Welcome'));
const Home = lazy(() => import('./pages/Home'));
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
const RetailerContactDirectory = lazy(() => import('./pages/admin/RetailerContactDirectory'));
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
const StoreStripeConnect = lazy(() => import('./pages/partner/StoreStripeConnect'));
const EarlySignups = lazy(() => import('./pages/admin/EarlySignups'));
const ABCComplianceOverview = lazy(() => import('./pages/ABCComplianceOverview'));
const DriverTrainingOverview = lazy(() => import('./pages/DriverTrainingOverview'));
const QRCode = lazy(() => import('./pages/QRCode'));
const RateDelivery = lazy(() => import('./pages/RateDelivery'));
const StoreInventorySync = lazy(() => import('./pages/admin/StoreInventorySync'));
const RealTimeInventory = lazy(() => import('./pages/admin/RealTimeInventory'));
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
const BeverageKingGoLive = lazy(() => import('./pages/admin/BeverageKingGoLive'));
const GitHubWorkspace = lazy(() => import('./pages/admin/GitHubWorkspace'));
const FoundingMembership = lazy(() => import('./pages/FoundingMembership'));
const RoleDashboard = lazy(() => import('./pages/RoleDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const RetailerDashboard = lazy(() => import('./pages/RetailerDashboard'));
const RetailerInventory = lazy(() => import('@/pages/RetailerInventory'));
const PayoutsOverview = lazy(() => import('./pages/admin/PayoutsOverview'));
const DriverOnboarding = lazy(() => import('./pages/admin/DriverOnboarding'));
const ComplianceLog = lazy(() => import('./pages/admin/ComplianceLog'));
const RetailerPortal = lazy(() => import('./pages/RetailerPortal'));
const RetailerSignup = lazy(() => import('./pages/RetailerSignup'));
const RetailerSignups = lazy(() => import('./pages/admin/RetailerSignups'));
const RetailerPitch = lazy(() => import('./pages/RetailerPitch'));
const RetailerOnboardingHub = lazy(() => import('./pages/RetailerOnboardingHub'));
const BKStaffLanding = lazy(() => import('./pages/BKStaffLanding'));
const ComplianceDashboard = lazy(() => import('./pages/admin/ComplianceDashboard'));
const StoreComplianceDashboard = lazy(() => import('./pages/admin/StoreComplianceDashboard'));
const StoreLaunchProgress = lazy(() => import('@/pages/admin/StoreLaunchProgress'));
const FinalApprovals = lazy(() => import('@/pages/admin/FinalApprovals'));
const FirebaseConsole = lazy(() => import('@/pages/admin/FirebaseConsole'));
const CityHiveLogin = lazy(() => import('@/pages/CityHiveLogin'));
const RetailerApplications = lazy(() => import('@/pages/admin/RetailerApplications'));
const RetailerOnboardingAssistant = lazy(() => import('@/pages/RetailerOnboardingAssistant'));
const CheckrDashboard = lazy(() => import('@/pages/admin/CheckrDashboard'));
const ABCPermitDashboard = lazy(() => import('@/pages/admin/ABCPermitDashboard'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Welcome />} />
          <Route path="/dashboard" element={<RoleDashboard />} />
          <Route path="/home" element={<Home />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/stores/:storeId" element={<StoreDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
            <Route path="/driver" element={<DriverPortal />} />
            <Route path="/store/dashboard" element={<StoreOwnerDashboard />} />
            <Route path="/retailer-dashboard" element={<RetailerDashboard />} />
            <Route path="/retailer-inventory" element={<RetailerInventory />} />
            <Route path="/retailer-portal" element={<RetailerPortal />} />
          </Route>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/drivers" element={<AdminDrivers />} />
          <Route path="/admin/stores" element={<AdminStores />} />
          <Route path="/admin/retailer-contacts" element={<RetailerContactDirectory />} />
          <Route path="/admin/zones" element={<AdminZones />} />
          <Route path="/admin/compliance" element={<Compliance />} />
          <Route path="/admin/product-sync" element={<ProductSync />} />
          <Route path="/admin/deliveries" element={<ActiveDeliveries />} />
          <Route path="/admin/performance" element={<Performance />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/membership" element={<FoundingMembership />} />
          <Route path="/order-status" element={<OrderStatus />} />
          <Route path="/admin/driver-management" element={<DriverManagement />} />
          <Route path="/admin/sales-reports" element={<SalesReports />} />
          <Route path="/admin/store-performance" element={<StorePerformance />} />
          <Route path="/admin/store-comparison" element={<StoreComparison />} />
          <Route path="/driver/signup" element={<DriverSignup />} />
          <Route path="/apply-to-drive" element={<Navigate to="/driver/signup" replace />} />
          <Route path="/driver/apply" element={<Navigate to="/driver/signup" replace />} />
          <Route path="/admin/dispatch" element={<AutoDispatch />} />
          <Route path="/admin/zones/editor" element={<ZoneEditor />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
            <Route path="/retailer-contract" element={<RetailerContract />} />
          </Route>
          <Route path="/driver/earnings" element={<DriverEarnings />} />
          <Route path="/admin/comments" element={<CustomerComments />} />
          <Route path="/safety-training" element={<AlcoholSafetyTraining />} />
          <Route path="/partner/dashboard" element={<PartnerDashboard />} />
          <Route path="/admin/live-map" element={<LiveMap />} />
          <Route path="/admin/demand-heatmap" element={<DemandHeatmap />} />
          <Route path="/admin/driver-analytics" element={<DriverAnalytics />} />
          <Route path="/legal" element={<LegalDocuments />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/early-signup" element={<EarlySignup />} />

          <Route path="/store/clover-connect" element={<StoreStripeConnect />} />
          <Route path="/admin/early-signups" element={<EarlySignups />} />
          <Route path="/abc-compliance" element={<ABCComplianceOverview />} />
          <Route path="/driver-training-overview" element={<DriverTrainingOverview />} />
          <Route path="/qr" element={<QRCode />} />
          <Route path="/rate-delivery" element={<RateDelivery />} />
          <Route path="/admin/inventory-sync" element={<StoreInventorySync />} />
          <Route path="/admin/real-time-inventory" element={<RealTimeInventory />} />
          <Route path="/admin/inventory-upload" element={<StoreInventoryUpload />} />
          <Route path="/admin/inventory-alerts" element={<InventoryAlerts />} />
          <Route path="/admin/store-revenue" element={<StoreRevenueDashboard />} />
          <Route path="/admin/driver-leaderboard" element={<DriverLeaderboard />} />
          <Route path="/driver-agreement" element={<DriverAgreement />} />
          <Route path="/admin/abc-presentation" element={<ABCPresentation />} />
          <Route path="/admin/retailer-onboarding" element={<RetailerOnboarding />} />
          <Route path="/admin/retailer-applications" element={<RetailerApplications />} />
          <Route path="/admin/onboarding-assistant" element={<RetailerOnboardingAssistant />} />
          <Route path="/admin/dispatch-map" element={<DispatchMap />} />
          <Route path="/admin/google-sheet-sync" element={<GoogleSheetInventorySync />} />
          <Route path="/store-map" element={<StoreMap />} />
          <Route path="/admin/compliance-incidents" element={<ComplianceIncidents />} />
          <Route path="/admin/store-onboarding-upload" element={<StoreOnboardingUpload />} />
          <Route path="/admin/beverage-king-golive" element={<BeverageKingGoLive />} />
          <Route path="/admin/github" element={<GitHubWorkspace />} />
          <Route path="/admin/users" element={<AdminUsers />} />

          <Route path="/payouts" element={<PayoutsOverview />} />
          <Route path="/driver-onboarding" element={<DriverOnboarding />} />
          <Route path="/compliance-log" element={<ComplianceLog />} />

          <Route path="/retailer-signup" element={<RetailerSignup />} />
          <Route path="/admin/retailer-signups" element={<RetailerSignups />} />
          <Route path="/retailer-pitch" element={<RetailerPitch />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
            <Route path="/onboarding" element={<RetailerOnboardingHub />} />
          </Route>
          <Route path="/bk-onboarding" element={<BKStaffLanding />} />
          <Route path="/compliance-dashboard" element={<ComplianceDashboard />} />
          <Route path="/admin/store-compliance" element={<StoreComplianceDashboard />} />
          <Route path="/admin/store-launch-progress" element={<StoreLaunchProgress />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
            <Route path="/admin/final-approvals" element={<FinalApprovals />} />
            <Route path="/admin/firebase" element={<FirebaseConsole />} />
            <Route path="/cityhive-login" element={<CityHiveLogin />} />
            <Route path="/admin/checkr" element={<CheckrDashboard />} />
            <Route path="/admin/abc-permits" element={<ABCPermitDashboard />} />
            <Route path="/assistant" element={<AIAssistant />} />
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
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/oauth/consent" element={<OAuthConsent />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/receipt/:orderNumber" element={<Receipt />} />
                <Route path="/receipt" element={<Receipt />} />
                <Route path="*" element={<AuthenticatedApp />} />
              </Routes>
            </Suspense>
          </Router>
          <Toaster />
          <ActionToaster position="top-center" closeButton />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App