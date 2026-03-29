import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';
const FavoritesPage = () => (
  <div className="min-h-screen bg-background pb-20 font-tajawal">
    <PageHeader title="المفضلة" />
    <div className="p-4"><p className="text-center text-muted-foreground">القائمة المفضلة</p></div>
    <BottomNav />
  </div>
);
export default FavoritesPage;
