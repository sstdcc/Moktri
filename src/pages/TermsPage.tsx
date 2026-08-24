import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';

const TermsPage = () => {
  usePageTitle();

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <PageHeader title="الشروط والأحكام" showBack fallbackPath="/settings" />
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <p className="text-xs text-muted-foreground">آخر تحديث: أغسطس 2026</p>

        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-bold mb-2">1. المقدمة</h2>
            <p>
              مرحبًا بك في منصة Moktari (مُكتري). باستخدامك للمنصة فإنك توافق على هذه الشروط والأحكام.
              يرجى قراءتها بعناية قبل الاستخدام، وعدم استخدام المنصة إذا كنت لا توافق على أي بند منها.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">2. التعريفات</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>"المنصة": تطبيق Moktari (مُكتري) لتأجير العقارات بموقعها وتطبيقها.</li>
              <li>"المستخدم": أي شخص يستخدم المنصة سواء كمستأجر أو مالك عقار أو وسيط أو زائر.</li>
              <li>"الجهة المشغلة": شركة SSTD التي تدير وتشغّل المنصة.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">3. الجهة المشغلة</h2>
            <p>Moktari منصة تابعة لشركة SSTD ويتم تشغيلها وإدارتها بواسطة الشركة.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">4. إنشاء الحساب</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>يجب تقديم معلومات صحيحة ودقيقة عند إنشاء الحساب أو تحديثه</li>
              <li>المستخدم مسؤول عن المحافظة على بيانات الدخول الخاصة به وعن ما يتم عبر حسابه</li>
              <li>يمنع إنشاء الحسابات أو استخدامها بطريقة احتيالية أو انتحالية</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">5. استخدام المنصة</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>يجب استخدام المنصة للأغراض المشروعة فقط</li>
              <li>يمنع الاحتيال والخداع وانتحال هوية الآخرين</li>
              <li>يمنع نشر إعلانات وهمية أو مضللة</li>
              <li>يمنع نشر محتوى مخالف للأنظمة النافذة أو حقوق الآخرين</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">6. الإعلانات</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>المستخدم مسؤول عن صحة المعلومات والصور والبيانات التي ينشرها في إعلانه</li>
              <li>يجب أن يكون للمعلن الحق في نشر المحتوى الذي ينشره</li>
              <li>يمنع نشر معلومات مضللة أو منسوبة لغير صاحبها</li>
              <li>يحق للمنصة إزالة أو إخفاء الإعلان المخالف وفق سياساتها</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">7. طلبات السكن والتواصل</h2>
            <p>
              المستخدم مسؤول عن المعلومات التي يقدمها في طلبات السكن، وعن التواصل الناتج عنها مع
              الأطراف الأخرى عبر المنصة أو خارجها.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">8. دور Moktari</h2>
            <p>
              تعمل Moktari كمنصة إلكترونية لعرض الإعلانات وربط المستخدمين، ولا تُعد طرفًا في عقد
              الإيجار المبرم بين المستخدمين.
            </p>
            <p className="mt-1">
              يتحمل الأطراف مسؤولية التحقق من صحة المعلومات والوثائق والتفاصيل المتعلقة بالعقار
              والطرف الآخر قبل إتمام أي اتفاق.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">9. حدود المسؤولية</h2>
            <p>
              تعتمد المنصة على البيانات التي يقدمها المستخدمون، ولا تتحقق منها بشكل مستمر. وبناءً عليه،
              لا تتحمل المنصة مسؤولية دقة أو اكتمال المحتوى المنشور من قبل المستخدمين أو الاتفاقات
              التي تتم بينهم. تبقى هذه الحدود مطبقة بالقدر الذي لا يتعارض فيه مع الحقوق والالتزامات
              التي تقررها الأنظمة النافذة ذات الصلة.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">10. الملكية الفكرية</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>علامتا Moktari وSSTD وشعاراتهما مملوكتان لأصحابهما</li>
              <li>تصميم المنصة وبرمجياتها والمحتوى المملوك لها محمي بموجب الأنظمة النافذة</li>
              <li>يمنع نسخ المنصة أو إعادة استخدام أي جزء منها دون إذن مسبق من الجهة المشغلة</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">11. الحسابات المخالفة</h2>
            <p>
              يحق للمنصة اتخاذ إجراءات مناسبة تجاه الحسابات أو المحتوى المخالف لهذه الشروط أو للسياسات
              أو للأنظمة النافذة، بما في ذلك إزالة المحتوى أو تعليق الحساب أو إنهاؤه.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">12. توفر الخدمة</h2>
            <p>
              نسعى لتوفير الخدمة بشكل مستمر، إلا أننا لا نضمن أن المنصة ستعمل دون انقطاع أو أخطاء في
              جميع الأوقات بسبب الصيانة أو الأعطال أو الظروف التقنية الخارجة عن سيطرتنا.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">13. التعديلات</h2>
            <p>
              يحق للمنصة تحديث هذه الشروط من وقت لآخر، ويظهر تاريخ آخر تحديث أعلى الصفحة. ستوضع
              التغييرات الجوهرية موضع إظهار للمستخدمين بالطريقة المناسبة، ويعد استمرار استخدام المنصة
              بعد التحديث موافقة على النسخة المحدثة.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">14. التواصل والشكاوى</h2>
            <p>لأي استفسار أو شكوى تتعلق بالمنصة أو بهذه الشروط، تواصل معنا عبر:</p>
            <ul className="mt-1 space-y-1">
              <li dir="ltr">
                <a href="mailto:support@sstd.cc" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">support@sstd.cc</a>
              </li>
              <li dir="ltr">
                <a href="mailto:hello@sstd.cc" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">hello@sstd.cc</a>
              </li>
              <li dir="ltr">
                <a href="tel:730122233" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">730122233</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">15. القانون والاختصاص</h2>
            <p>
              تخضع هذه الشروط وتُفسَّر وفقًا للأنظمة اليمنية النافذة ذات الصلة، وما لم يرد فيه نص في
              هذه الشروط تسري عليه الأحكام العامة في تلك الأنظمة.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
