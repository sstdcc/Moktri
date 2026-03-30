import { useNavigate } from "react-router-dom";
import { Home, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-tajawal px-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-5xl font-bold text-foreground">404</h1>
        <p className="mb-1 text-lg font-semibold text-foreground">الصفحة غير موجودة</p>
        <p className="mb-6 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Button onClick={() => navigate('/')} className="gap-2 min-h-[44px]">
          <Home className="h-4 w-4" />
          العودة للرئيسية
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
