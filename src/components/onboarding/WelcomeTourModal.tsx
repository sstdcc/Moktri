import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Search, Heart, MessageCircle, FileText,
  Building2, PlusCircle, Inbox, BadgeCheck,
  Handshake, Users, Send, TrendingUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Role = 'renter' | 'owner' | 'broker' | 'admin' | 'moderator' | 'guest';

interface Slide {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const TOURS: Record<Role, { title: string; subtitle: string; slides: Slide[] }> = {
  renter: {
    title: 'مرحباً بك في مُكتري 👋',
    subtitle: 'دليل سريع للعثور على سكنك المثالي',
    slides: [
      { icon: Search, title: 'ابحث عن سكن', description: 'تصفّح آلاف الإعلانات في تعز مع فلترة حسب الحي والسعر والنوع.' },
      { icon: Heart, title: 'احفظ المفضلة', description: 'احتفظ بالعقارات التي تعجبك للرجوع إليها لاحقاً.' },
      { icon: FileText, title: 'انشر طلب سكن', description: 'اكتب احتياجك وسيتواصل معك الملاك والوسطاء مباشرة.' },
      { icon: MessageCircle, title: 'تواصل بأمان', description: 'دردش مع المالك أو الوسيط داخل التطبيق دون مشاركة رقمك.' },
    ],
  },
  owner: {
    title: 'مرحباً بك في مُكتري 🏠',
    subtitle: 'دليل سريع لتأجير عقارك بسرعة',
    slides: [
      { icon: PlusCircle, title: 'انشر إعلانك', description: 'أضف صور وتفاصيل العقار في خطوات بسيطة مع حفظ تلقائي.' },
      { icon: Inbox, title: 'استقبل الطلبات', description: 'تابع طلبات السكن المتاحة وقدّم عرضك للمستأجرين المناسبين.' },
      { icon: MessageCircle, title: 'تواصل مع المستأجرين', description: 'رد على الاستفسارات عبر الدردشة الآمنة داخل التطبيق.' },
      { icon: BadgeCheck, title: 'فعّل التوثيق', description: 'وثّق حسابك لزيادة الثقة وعرض إعلاناتك في المقدمة.' },
    ],
  },
  broker: {
    title: 'مرحباً بك في مُكتري 🤝',
    subtitle: 'دليل سريع للعمل كوسيط محترف',
    slides: [
      { icon: Building2, title: 'أدر إعلاناتك', description: 'انشر وأدر إعلانات متعددة من لوحة تحكم احترافية.' },
      { icon: Users, title: 'تصفّح طلبات السكن', description: 'اطلع على طلبات الباحثين عن السكن وقدّم العروض المناسبة.' },
      { icon: Send, title: 'أرسل عروضاً خاصة', description: 'ابعث عروض مخصصة للمستأجرين بناءً على احتياجاتهم.' },
      { icon: TrendingUp, title: 'ابنِ سمعتك', description: 'احصل على تقييمات وشارة التوثيق لزيادة عملائك.' },
    ],
  },
  admin: {
    title: 'مرحباً بك في لوحة الإدارة',
    subtitle: 'أدوات الإشراف والمراجعة',
    slides: [
      { icon: Building2, title: 'مراجعة الإعلانات', description: 'راجع الإعلانات الجديدة واعتمدها أو ارفضها.' },
      { icon: Users, title: 'إدارة المستخدمين', description: 'تابع حسابات المستخدمين وصلاحياتهم.' },
      { icon: BadgeCheck, title: 'طلبات التوثيق', description: 'راجع طلبات التوثيق والوثائق المرفقة.' },
    ],
  },
  moderator: {
    title: 'مرحباً بك في لوحة الإشراف',
    subtitle: 'أدوات المراجعة',
    slides: [
      { icon: Building2, title: 'مراجعة الإعلانات', description: 'راجع الإعلانات الجديدة قبل النشر.' },
      { icon: Inbox, title: 'البلاغات', description: 'تابع البلاغات المقدمة من المستخدمين.' },
    ],
  },
  guest: {
    title: 'مرحباً بك في مُكتري 👋',
    subtitle: 'منصة العقارات الأولى في تعز',
    slides: [
      { icon: Search, title: 'تصفّح بحرية', description: 'استكشف الإعلانات والعقارات المتاحة بدون تسجيل.' },
      { icon: Heart, title: 'سجّل حساباً', description: 'أنشئ حساباً للحفظ في المفضلة والتواصل مع المعلنين.' },
      { icon: Handshake, title: 'مالك أو وسيط؟', description: 'سجّل وانشر إعلاناتك بسهولة ووصل لآلاف الباحثين.' },
    ],
  },
};

const STORAGE_PREFIX = 'moktari_welcome_tour_v1_';

export const WelcomeTourModal = () => {
  const { user, profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const role: Role = useMemo(() => {
    if (!user) return 'guest';
    return (profile?.role as Role) || 'renter';
  }, [user, profile]);

  const tour = TOURS[role] ?? TOURS.guest;

  useEffect(() => {
    if (loading) return;
    if (!user) return; // only show after login
    // wait until profile loaded for signed-in users
    if (user && !profile) return;
    try {
      const key = `${STORAGE_PREFIX}${user ? user.id : 'guest'}_${role}`;
      if (!localStorage.getItem(key)) {
        // small delay so it doesn't fight first paint
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [loading, user, profile, role]);

  const markSeen = () => {
    try {
      const key = `${STORAGE_PREFIX}${user ? user.id : 'guest'}_${role}`;
      localStorage.setItem(key, '1');
    } catch { /* ignore */ }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      markSeen();
      setOpen(false);
      setIndex(0);
    } else {
      setOpen(true);
    }
  };

  const isLast = index === tour.slides.length - 1;
  const slide = tour.slides[index];
  const Icon = slide.icon;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-border bg-card sm:rounded-2xl"
        dir="rtl"
      >
        <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-transparent px-6 pt-8 pb-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
            <Icon className="h-8 w-8" />
          </div>
          <DialogHeader className="space-y-1.5 text-center sm:text-center pr-0">
            <DialogTitle className="text-xl font-bold text-foreground">
              {index === 0 ? tour.title : slide.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {index === 0 ? tour.subtitle : slide.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {index > 0 && (
          <div className="px-6 pb-2 text-center">
            <h3 className="text-base font-semibold text-foreground">{slide.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{slide.description}</p>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 px-6 py-4">
          {tour.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`الشريحة ${i + 1}`}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === index ? 'w-6 bg-primary' : 'w-2 bg-muted hover:bg-muted-foreground/40'
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 px-6 pb-6 pt-0 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            تخطي
          </Button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="السابق"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {isLast ? (
              <Button onClick={() => handleClose(false)} className="min-w-[110px]">
                ابدأ الآن
              </Button>
            ) : (
              <Button onClick={() => setIndex((i) => i + 1)} className="min-w-[110px] gap-1">
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeTourModal;
