import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminGuard } from "@/components/guards/AdminGuard";

import HomePage from "./pages/HomePage";
import ListingsPage from "./pages/ListingsPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import HousingRequestsPage from "./pages/HousingRequestsPage";
import RequestDetailPage from "./pages/RequestDetailPage";
import AuthPage from "./pages/AuthPage";
import DashboardRedirect from "./pages/DashboardRedirect";
import RenterDashboard from "./pages/dashboards/RenterDashboard";
import OwnerDashboard from "./pages/dashboards/OwnerDashboard";
import BrokerDashboard from "./pages/dashboards/BrokerDashboard";
import AdminDashboardPage from "./pages/dashboards/admin/AdminDashboardPage";
import ListingsModeration from "./pages/dashboards/admin/ListingsModeration";
import ReportsManagement from "./pages/dashboards/admin/ReportsManagement";
import UsersManagement from "./pages/dashboards/admin/UsersManagement";
import VerificationsManagement from "./pages/dashboards/admin/VerificationsManagement";
import DistrictsManagement from "./pages/dashboards/admin/DistrictsManagement";
import CreateListingPage from "./pages/CreateListingPage";
import EditListingPage from "./pages/EditListingPage";
import PublicProfilePage from "./pages/PublicProfilePage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import FavoritesPage from "./pages/FavoritesPage";
import VerificationPage from "./pages/VerificationPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/dashboard/admin/districts" element={<AdminGuard><DistrictsManagement /></AdminGuard>} />

            <Route path="/listings/new" element={<AuthGuard><CreateListingPage /></AuthGuard>} />
            <Route path="/listings/:id/edit" element={<AuthGuard><EditListingPage /></AuthGuard>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
