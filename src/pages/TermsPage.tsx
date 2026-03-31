import { usePageTitle } from '@/hooks/usePageTitle';

const TermsPage = () => {
  usePageTitle();

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-foreground">الشروط والأحكام</h1>
        <p className="text-xs text-muted-foreground">آخر تحديث: مارس 2026</p>

        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-bold mb-2">1. مقدمة</h2>
            <p>مرحباً بك في منصة مفتاح. باستخدامك للمنصة فإنك توافق على هذه الشروط والأحكام. يرجى قراءتها بعناية قبل الاستخدام.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">2. التعريفات</h2>
            <p>"المنصة" تشير إلى تطبيق مفتاح لتأجير العقارات. "المستخدم" يشير إلى أي شخص يستخدم المنصة سواء كمستأجر أو مالك أو وسيط.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">3. استخدام المنصة</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>يجب أن تكون المعلومات المقدمة صحيحة ودقيقة</li>
              <li>يُحظر نشر إعلانات وهمية أو مضللة</li>
              <li>يُحظر استخدام المنصة لأغراض غير مشروعة</li>
              <li>المنصة تعمل كوسيط إلكتروني وليست طرفاً في عقود الإيجار</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">4. المسؤولية</h2>
            <p>المنصة غير مسؤولة عن دقة المعلومات المنشورة من قبل المستخدمين. يتحمل كل مستخدم مسؤولية التحقق من صحة المعلومات قبل إتمام أي اتفاق.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">5. حقوق الملكية</h2>
            <p>جميع حقوق الملكية الفكرية للمنصة محفوظة. لا يجوز نسخ أو إعادة إنتاج أي جزء من المنصة بدون إذن مسبق.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">6. إنهاء الحساب</h2>
            <p>يحق للمنصة تعليق أو إنهاء حساب أي مستخدم يخالف هذه الشروط دون إشعار مسبق.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">7. التعديلات</h2>
            <p>يحق للمنصة تعديل هذه الشروط في أي وقت. سيتم إخطار المستخدمين بالتعديلات الجوهرية.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
