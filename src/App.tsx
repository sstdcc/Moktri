import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DistrictsProvider } from "@/contexts/DistrictsContext";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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
const CreateListingPage = lazy(() => import("./pages/CreateListingPage"));
const CreateRequestPage = lazy(() => import("./pages/CreateRequestPage"));
const EditListingPage = lazy(() => import("./pages/EditListingPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
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
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/listings/:id" element={<ListingDetailPage />} />
                <Route path="/requests" element={<HousingRequestsPage />} />
                <Route path="/requests/:id" element={<RequestDetailPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/profile/:id" element={<PublicProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/verify" element={<VerificationPage />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={<AuthGuard><DashboardRedirect /></AuthGuard>} />
                <Route path="/dashboard/renter" element={<AuthGuard><RenterDashboard /></AuthGuard>} />
                <Route path="/dashboard/owner" element={<AuthGuard><OwnerDashboard /></AuthGuard>} />
                <Route path="/dashboard/broker" element={<AuthGuard><BrokerDashboard /></AuthGuard>} />

                {/* Admin routes */}
                <Route path="/dashboard/admin" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
                <Route path="/dashboard/admin/listings" element={<AdminGuard><ListingsModeration /></AdminGuard>} />
                <Route path="/dashboard/admin/reports" element={<AdminGuard><ReportsManagement /></AdminGuard>} />
                <Route path="/dashboard/admin/users" element={<AdminGuard><UsersManagement /></AdminGuard>} />
                <Route path="/dashboard/admin/verifications" element={<AdminGuard><VerificationsManagement /></AdminGuard>} />
                <Route path="/dashboard/admin/requests" element={<AdminGuard><RequestsManagement /></AdminGuard>} />
                <Route path="/dashboard/admin/districts" element={<AdminGuard><DistrictsManagement /></AdminGuard>} />

                <Route path="/listings/new" element={<AuthGuard><CreateListingPage /></AuthGuard>} />
                <Route path="/listings/:id/edit" element={<AuthGuard><EditListingPage /></AuthGuard>} />
                <Route path="/requests/new" element={<AuthGuard><CreateRequestPage /></AuthGuard>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </DistrictsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
