import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const DashboardRedirect = () => {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  const role = profile?.role || 'renter';
  return <Navigate to={`/dashboard/${role}`} replace />;
};
export default DashboardRedirect;
