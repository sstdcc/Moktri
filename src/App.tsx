import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DistrictsProvider } from "@/contexts/DistrictsContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LazyRouteFallback } from "@/components/ui/LazyRouteFallback";
import { MainLayout } from "@/components/layouts/MainLayout";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { PersistentBottomTabs } from "@/components/layouts/PersistentBottomTabs";
import ScrollToTop from "@/components/ScrollToTop";
import WelcomeTourModal from "@/components/onboarding/WelcomeTourModal";

// Lazy-loaded pages
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));

const ListingRequestsPage = lazy(() => import("./pages/ListingRequestsPage"));
const RequestDetailPage = lazy(() => import("./pages/RequestDetailPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const DashboardRedirect = lazy(() => import("./pages/DashboardRedirect"));
const RenterDashboard = lazy(() => import("./pages/dashboards/RenterDashboard"));
const OwnerDashboard = lazy(() => import("./pages/dashboards/OwnerDashboard"));
const BrokerDashboard = lazy(() => import("./pages/dashboards/BrokerDashboard"));
const AdminDashboardPage = lazy(() => import("./pages/dashboards/admin/AdminDashboardPage"));
const ListingsModeration = lazy(() => import("./pages/dashboards/admin/ListingsModeration"));
const ReportsManagement = lazy(() => import("./pages/dashboards/admin/ReportsManagement"));
const UsersManagement = lazy(() => import("./pages/dashboards/admin/UsersManagement"));
const VerificationsManagement = lazy(() => import("./pages/dashboards/admin/VerificationsManagement"));
const RequestsManagement = lazy(() => import("./pages/dashboards/admin/RequestsManagement"));
const DistrictsManagement = lazy(() => import("./pages/dashboards/admin/DistrictsManagement"));
const RentalsReview = lazy(() => import("./pages/dashboards/admin/RentalsReview"));
const AuditLogsPage = lazy(() => import("./pages/dashboards/admin/AuditLogsPage"));
const CreateListingPage = lazy(() => import("./pages/CreateListingPage"));
const CreateRequestPage = lazy(() => import("./pages/CreateRequestPage"));
const EditListingPage = lazy(() => import("./pages/EditListingPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ChatUserPage = lazy(() => import("./pages/ChatUserPage"));
const ConversationPage = lazy(() => import("./pages/ConversationPage"));
const RequestConversationPage = lazy(() => import("./pages/RequestConversationPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const LazyFallback = () => <LazyRouteFallback />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <WelcomeTourModal />
          <DistrictsProvider>
            <PresenceProvider>
              <Suspense fallback={<LazyFallback />}>
                <Routes>
                  {/* Auth flow — wrapped in AuthLayout (header with back + menu) */}
                  <Route path="/auth" element={<AuthLayout><AuthPage /></AuthLayout>} />
                  <Route path="/signup" element={<AuthLayout><SignUpPage /></AuthLayout>} />
                  <Route path="/forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />
                  <Route path="/reset-password" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />
                  <Route path="/complete-profile" element={<AuthLayout><CompleteProfilePage /></AuthLayout>} />
                  <Route path="/onboarding" element={<AuthLayout><OnboardingPage /></AuthLayout>} />

                  {/* All other pages wrapped in MainLayout with sidebar */}
                  <Route element={<MainLayout><PersistentBottomTabs /></MainLayout>}>
                    <Route path="/" element={null} />
                    <Route path="/listings" element={null} />
                    <Route path="/requests" element={null} />
                    <Route path="/favorites" element={null} />
                    <Route path="/notifications" element={null} />
                    <Route path="/settings" element={null} />
                  </Route>
                  <Route path="/listings/:id" element={<MainLayout><ListingDetailPage /></MainLayout>} />
                  <Route path="/listing-requests" element={<MainLayout><AuthGuard><ListingRequestsPage /></AuthGuard></MainLayout>} />
                  <Route path="/requests/:id" element={<MainLayout><RequestDetailPage /></MainLayout>} />
                  <Route path="/profile/:id" element={<MainLayout><PublicProfilePage /></MainLayout>} />
                  <Route path="/change-password" element={<MainLayout><AuthGuard><ChangePasswordPage /></AuthGuard></MainLayout>} />
                  <Route path="/verify" element={<MainLayout><AuthGuard><VerificationPage /></AuthGuard></MainLayout>} />
                  <Route path="/terms" element={<MainLayout><TermsPage /></MainLayout>} />
                  <Route path="/privacy" element={<MainLayout><PrivacyPage /></MainLayout>} />
                  <Route path="/chat" element={<MainLayout><AuthGuard><ChatPage /></AuthGuard></MainLayout>} />
                  <Route path="/chat/user/:userId" element={<MainLayout><AuthGuard><ChatUserPage /></AuthGuard></MainLayout>} />
                  <Route path="/chat/:id" element={<MainLayout><AuthGuard><ConversationPage /></AuthGuard></MainLayout>} />
                  <Route path="/request-chat/:id" element={<MainLayout><AuthGuard><RequestConversationPage /></AuthGuard></MainLayout>} />

                  {/* Protected routes */}
                  <Route path="/dashboard" element={<MainLayout><AuthGuard><DashboardRedirect /></AuthGuard></MainLayout>} />
                  <Route path="/dashboard/renter" element={<MainLayout><AuthGuard><RenterDashboard /></AuthGuard></MainLayout>} />
                  <Route path="/dashboard/owner" element={<MainLayout><AuthGuard><OwnerDashboard /></AuthGuard></MainLayout>} />
                  <Route path="/dashboard/broker" element={<MainLayout><AuthGuard><BrokerDashboard /></AuthGuard></MainLayout>} />

                  {/* Admin routes — wrapped in AdminLayout (its own persistent navigation) */}
                  <Route path="/dashboard/admin" element={<AdminGuard><AdminLayout><AdminDashboardPage /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/listings" element={<AdminGuard><AdminLayout><ListingsModeration /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/reports" element={<AdminGuard><AdminLayout><ReportsManagement /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/users" element={<AdminGuard><AdminLayout><UsersManagement /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/verifications" element={<AdminGuard><AdminLayout><VerificationsManagement /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/requests" element={<AdminGuard><AdminLayout><RequestsManagement /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/districts" element={<AdminGuard><AdminLayout><DistrictsManagement /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/audit-logs" element={<AdminGuard><AdminLayout><AuditLogsPage /></AdminLayout></AdminGuard>} />
                  <Route path="/dashboard/admin/rentals" element={<AdminGuard><AdminLayout><RentalsReview /></AdminLayout></AdminGuard>} />

                  <Route path="/listings/new" element={<MainLayout><AuthGuard><CreateListingPage /></AuthGuard></MainLayout>} />
                  <Route path="/listings/:id/edit" element={<MainLayout><AuthGuard><EditListingPage /></AuthGuard></MainLayout>} />
                  <Route path="/requests/new" element={<MainLayout><AuthGuard><CreateRequestPage /></AuthGuard></MainLayout>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PresenceProvider>
          </DistrictsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
