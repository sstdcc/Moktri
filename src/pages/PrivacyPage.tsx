import { usePageTitle } from '@/hooks/usePageTitle';

const PrivacyPage = () => {
  usePageTitle();

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-foreground">سياسة الخصوصية</h1>
        <p className="text-xs text-muted-foreground">آخر تحديث: مارس 2026</p>

        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-bold mb-2">1. البيانات التي نجمعها</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>رقم الهاتف (للتسجيل والتحقق)</li>
              <li>الاسم الكامل</li>
              <li>رقم الواتساب (اختياري)</li>
              <li>الصورة الشخصية (اختياري)</li>
              <li>بيانات الإعلانات والطلبات المنشورة</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">2. كيف نستخدم بياناتك</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>تقديم خدمات المنصة وتحسينها</li>
              <li>التحقق من هوية المستخدمين</li>
              <li>إرسال إشعارات متعلقة بحسابك</li>
              <li>عرض معلومات التواصل للمستخدمين المهتمين</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">3. مشاركة البيانات</h2>
            <p>لا نبيع بياناتك الشخصية لأطراف ثالثة. قد نشارك بيانات محدودة مع:</p>
            <ul className="list-disc pr-5 space-y-1 mt-1">
              <li>مقدمي خدمات الرسائل النصية (لإرسال رموز التحقق)</li>
              <li>الجهات القانونية عند الطلب الرسمي</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">4. أمان البيانات</h2>
            <p>نستخدم تقنيات تشفير حديثة لحماية بياناتك. رموز التحقق مشفرة ولا يمكن الوصول إليها.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">5. حقوقك</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>الاطلاع على بياناتك الشخصية</li>
              <li>تعديل أو تحديث معلوماتك</li>
              <li>طلب حذف حسابك وبياناتك</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">6. التواصل</h2>
            <p>لأي استفسار حول سياسة الخصوصية، تواصل معنا عبر واتساب على الرقم المتاح في صفحة الإعدادات.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
