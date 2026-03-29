import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';

const HousingRequestsPage = () => (
  <div className="min-h-screen bg-background pb-20 font-tajawal">
    <PageHeader title="طلبات السكن" />
    <div className="p-4"><p className="text-center text-muted-foreground">طلبات السكن</p></div>
    <BottomNav />
  </div>
);
export default HousingRequestsPage;
