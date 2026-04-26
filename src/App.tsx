import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DistrictsProvider } from "@/contexts/DistrictsContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MainLayout } from "@/components/layouts/MainLayout";

// Eager: landing + listings (most visited)
import HomePage from "./pages/HomePage";
import ListingsPage from "./pages/ListingsPage";

// Lazy-loaded pages
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const HousingRequestsPage = lazy(() => import("./pages/HousingRequestsPage"));
const RequestDetailPage = lazy(() => import("./pages/RequestDetailPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
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
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ConversationPage = lazy(() => import("./pages/ConversationPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const LazyFallback = () => <LoadingSpinner />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DistrictsProvider>
            <PresenceProvider>
              <Suspense fallback={<LazyFallback />}>
                <Routes>
                  {/* Auth page - no sidebar */}
                  <Route path="/auth" element={<AuthPage />} />

                  {/* All other pages wrapped in MainLayout with sidebar */}
                  <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />
                  <Route path="/listings" element={<MainLayout><ListingsPage /></MainLayout>} />
                  <Route path="/listings/:id" element={<MainLayout><ListingDetailPage /></MainLayout>} />
                  <Route path="/requests" element={<MainLayout><HousingRequestsPage /></MainLayout>} />
                  <Route path="/requests/:id" element={<MainLayout><RequestDetailPage /></MainLayout>} />
                  <Route path="/profile/:id" element={<MainLayout><PublicProfilePage /></MainLayout>} />
                  <Route path="/notifications" element={<MainLayout><AuthGuard><NotificationsPage /></AuthGuard></MainLayout>} />
                  <Route path="/favorites" element={<MainLayout><AuthGuard><FavoritesPage /></AuthGuard></MainLayout>} />
                  <Route path="/settings" element={<MainLayout><AuthGuard><SettingsPage /></AuthGuard></MainLayout>} />
                  <Route path="/verify" element={<MainLayout><AuthGuard><VerificationPage /></AuthGuard></MainLayout>} />
                  <Route path="/terms" element={<MainLayout><TermsPage /></MainLayout>} />
                  <Route path="/privacy" element={<MainLayout><PrivacyPage /></MainLayout>} />
                  <Route path="/chat" element={<MainLayout><AuthGuard><ChatPage /></AuthGuard></MainLayout>} />
                  <Route path="/chat/:id" element={<MainLayout><AuthGuard><ConversationPage /></AuthGuard></MainLayout>} />

                  {/* Protected routes */}
                  <Route path="/dashboard" element={<MainLayout><AuthGuard><DashboardRedirect /></AuthGuard></MainLayout>} />
                  <Route path="/dashboard/renter" element={<MainLayout><AuthGuard><RenterDashboard /></AuthGuard></MainLayout>} />
                  <Route path="/dashboard/owner" element={<MainLayout><AuthGuard><OwnerDashboard /></AuthGuard></MainLayout>} />
                  <Route path="/dashboard/broker" element={<MainLayout><AuthGuard><BrokerDashboard /></AuthGuard></MainLayout>} />

                  {/* Admin routes */}
                  <Route path="/dashboard/admin" element={<MainLayout><AdminGuard><AdminDashboardPage /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/listings" element={<MainLayout><AdminGuard><ListingsModeration /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/reports" element={<MainLayout><AdminGuard><ReportsManagement /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/users" element={<MainLayout><AdminGuard><UsersManagement /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/verifications" element={<MainLayout><AdminGuard><VerificationsManagement /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/requests" element={<MainLayout><AdminGuard><RequestsManagement /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/districts" element={<MainLayout><AdminGuard><DistrictsManagement /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/audit-logs" element={<MainLayout><AdminGuard><AuditLogsPage /></AdminGuard></MainLayout>} />
                  <Route path="/dashboard/admin/rentals" element={<MainLayout><AdminGuard><RentalsReview /></AdminGuard></MainLayout>} />

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
  </QueryClientProvider>
);

export default App;
