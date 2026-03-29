import { PageHeader } from '@/components/ui/PageHeader';
const AdminDashboard = () => (
  <div className="min-h-screen bg-background font-tajawal">
    <PageHeader title="لوحة المدير" showBack />
    <div className="p-4"><p className="text-center text-muted-foreground">لوحة تحكم المدير</p></div>
  </div>
);
export default AdminDashboard;
