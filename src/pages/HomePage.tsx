import { BottomNav } from '@/components/ui/BottomNav';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal">
      <div className="bg-primary px-4 pb-6 pt-10">
        <h1 className="text-2xl font-bold text-primary-foreground">مفتاح</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">سوق الإيجارات في تعز</p>
      </div>
      <div className="px-4 py-6">
        <p className="text-center text-muted-foreground">مرحباً بك في مفتاح</p>
      </div>
      <BottomNav />
    </div>
  );
};

export default HomePage;
