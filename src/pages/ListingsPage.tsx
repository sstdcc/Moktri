import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';

const ListingsPage = () => (
  <div className="min-h-screen bg-background pb-20 font-tajawal">
    <PageHeader title="البحث عن سكن" />
    <div className="p-4"><p className="text-center text-muted-foreground">قائمة العروض</p></div>
    <BottomNav />
  </div>
);
export default ListingsPage;
