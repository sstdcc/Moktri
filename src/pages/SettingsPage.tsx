import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';
const SettingsPage = () => (
  <div className="min-h-screen bg-background pb-20 font-tajawal">
    <PageHeader title="الإعدادات" />
    <div className="p-4"><p className="text-center text-muted-foreground">إعدادات الحساب</p></div>
    <BottomNav />
  </div>
);
export default SettingsPage;
