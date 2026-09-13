import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Trash2, Mail, ArrowLeft } from 'lucide-react';

/**
 * Public page describing how to delete a Moktari account.
 * - In-app (logged in): Settings → Delete account → permanent deletion.
 * - Outside the app (logged out): request via the existing support channel;
 *   these requests are processed manually by the support team.
 */
const AccountDeletionPage = () => {
  usePageTitle();

  return (
    <div className="min-h-screen bg-background pb-16 font-tajawal" dir="rtl">
      <PageHeader title="حذف الحساب" showBack fallbackPath="/" />

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
              <Trash2 className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h2 className="text-base font-bold text-foreground">كيف أحذف حسابي في مكتري؟</h2>
          </div>

          <div className="space-y-3 text-sm text-foreground leading-relaxed">
            <p>
              إذا كنت مسجّل الدخول في التطبيق، يمكنك حذف حسابك نهائيًا بأنفسك في أي وقت من داخل
              التطبيق:
            </p>
            <ol className="list-decimal pr-5 space-y-1">
              <li>افتح <strong>الإعدادات</strong> من القائمة.</li>
              <li>اضغط <strong>حذف الحساب</strong> أسفل الصفحة.</li>
              <li>اقرأ التحذير وأكّد اختيارك.</li>
            </ol>
            <p>
              عند تأكيد الحذف يُحذف الحساب وبياناته نهائيًا (الملف الشخصي، الإعلانات وصورها، طلبات
              السكن، المفضلة، المحادثات، الإشعارات، التقييمات وغيرها). لا يمكن التراجع عن هذه
              العملية.
            </p>
            <p className="text-sm text-muted-foreground">
              أحفظ بيانات تحذير مهمة: إذا كان حسابك مرتبطًا بعقد إيجار نشط بصفة مالك أو مستأجر، فلن
              يتمكن التطبيق من حذفه تلقائيًا حفاظًا على حقوق جميع الأطراف؛ فستحتاج إلى إنهاء العقد
              أو التواصل مع الدعم لإتمام الحذف.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Mail className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h2 className="text-base font-bold text-foreground">لا يمكنك تسجيل الدخول؟</h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            إذا تعذّر عليك الوصول إلى حسابك لطلب الحذف من داخل التطبيق، يمكنك إرسال طلب حذف عبر
            <span className="mx-1">صفحة «تواصل معنا»</span>أو البريد الإلكتروني
            <a href="mailto:support@sstd.cc" className="mx-1 underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">support@sstd.cc</a>
            وسيتم معالجة طلبك يدويًا من قبل فريق الدعم خلال مدة معقولة.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="/contact">
              <Button className="rounded-xl font-tajawal">
                <ArrowLeft className="h-4 w-4" />
                تقديم طلب عبر تواصل معنا
              </Button>
            </Link>
            <a href="mailto:support@sstd.cc">
              <Button variant="outline" className="rounded-xl font-tajawal">
                <Mail className="h-4 w-4" />
                مراسلة الدعم
              </Button>
            </a>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center pt-2">
          للمزيد راجع <Link to="/privacy" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">سياسة الخصوصية</Link> — قسم «حذف الحساب والبيانات».
        </p>
      </div>
    </div>
  );
};

export default AccountDeletionPage;