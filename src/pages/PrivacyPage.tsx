import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';

const PrivacyPage = () => {
  usePageTitle();

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <PageHeader title="سياسة الخصوصية" showBack fallbackPath="/settings" />
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <p className="text-xs text-muted-foreground">آخر تحديث: أغسطس 2026</p>

        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-bold mb-2">1. مقدمة ونطاق السياسة</h2>
            <p>
              تصف هذه السياسة كيفية تعامل منصة Moktari (مُكتري) مع البيانات الشخصية لمن يستخدم المنصة،
              سواء كمستأجر أو مالك عقار أو وسيط أو زائر. تنطبق السياسة على جميع الصفحات والخدمات التي
              تقدمها المنصة عبر الموقع والتطبيق. باستخدامك للمنصة فأنت توافق على ما ورد في هذه السياسة.
              تُطبّق على معالجة البيانات والخصوصية الأحكام والأنظمة اليمنية النافذة ذات الصلة.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">2. الجهة المشغلة</h2>
            <p>منصة Moktari تابعة لشركة SSTD ويتم تشغيلها وإدارتها بواسطة الشركة، ويمكن التواصل معها عبر:</p>
            <ul className="mt-1 space-y-1">
              <li dir="ltr" className="font-bold">SSTD</li>
              <li dir="ltr">
                <a href="mailto:hello@sstd.cc" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">hello@sstd.cc</a>
              </li>
              <li dir="ltr">
                <a href="mailto:support@sstd.cc" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">support@sstd.cc</a>
              </li>
              <li dir="ltr">
                <a href="tel:730122233" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">730122233</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">3. البيانات التي نجمعها</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>رقم الهاتف (للتسجيل والتحقق)</li>
              <li>البريد الإلكتروني</li>
              <li>الاسم الكامل</li>
              <li>رقم الواتساب إذا أدخله المستخدم (اختياري)</li>
              <li>الصورة الشخصية إذا رفعها المستخدم (اختياري)</li>
              <li>بيانات الإعلانات التي ينشرها المستخدم (تفاصيل العقار والسعر والموقع وغيرها)</li>
              <li>بيانات طلبات السكن التي ينشئها المستخدم</li>
              <li>الصور والمحتوى الذي يرفعه المستخدم إلى المنصة</li>
              <li>رموز الإشعارات على الأجهزة لأغراض تسليم الإشعارات للمستخدم الذي فعّلها</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">4. كيف نستخدم البيانات</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>إنشاء وإدارة حساب المستخدم</li>
              <li>تسجيل الدخول والتحقق من هوية المستخدم</li>
              <li>استعادة الحساب عند توفر هذه الميزة</li>
              <li>تقديم خدمات المنصة</li>
              <li>إدارة الإعلانات وطلبات السكن المنشورة</li>
              <li>إرسال الإشعارات المتعلقة بالحساب والخدمات</li>
              <li>تحسين المنصة وأمنها وتشغيلها</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">5. ظهور معلومات التواصل لمستخدمين آخرين</h2>
            <p>
              بعض معلومات التواصل التي يختار المستخدم نشرها قد تظهر للمستخدمين الآخرين عندما تكون
              مطلوبة للتواصل بخصوص إعلان أو طلب سكن نشره، مثل رقم الهاتف أو رقم الواتساب المرتبط بإعلان.
              ولا تظهر أي معلومات إلا ضمن هذا الغرض.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">6. مقدمو الخدمات الخارجيون</h2>
            <p>
              قد نشارك بيانات محدودة وبالحد اللازم مع مزودي خدمات يدعمون تشغيل المنصة، مثل:
            </p>
            <ul className="list-disc pr-5 space-y-1 mt-1">
              <li>خدمات الرسائل والتحقق ( لإرسال رموز التحقق )</li>
              <li>خدمات البريد الإلكتروني (لرسائل استعادة الحساب وما شابه)</li>
              <li>خدمات الإشعارات</li>
              <li>الاستضافة وقواعد البيانات والبنية التحتية التقنية</li>
            </ul>
            <p className="mt-1">
              لا نبيع بياناتك الشخصية لأي طرف ثالث، وقد نشارك البيانات مع الجهات الرسمية عند وجود طلب
              نظامي رسمي وفق الأنظمة النافذة.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">7. أمن البيانات</h2>
            <p>
              نستخدم إجراءات تقنية وتنظيمية مناسبة لحماية البيانات من الوصول غير المصرح به أو التعديل
              أو الفقدان أو الاستخدام غير المشروع. ومع ذلك، لا توجد وسيلة حفظ أو نقل عبر الإنترنت آمنة
              بشكل مطلق، ولا يمكننا ضمان أمان كامل بنسبة 100%.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">8. الاحتفاظ بالبيانات</h2>
            <p>
              نحتفظ بالبيانات للمدة اللازمة لتحقيق الأغراض التي جمعت من أجلها أو حسب ما تقتضيه
              الالتزامات النظامية، ثم نحذفها أو نتخلص منها بطريقة مناسبة عندما تنتفي الحاجة إليها،
              ما لم يوجد سبب مشروع للاحتفاظ بها.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">9. حذف الحساب والبيانات</h2>
            <p>
              يمكنك حذف حسابك نهائيًا في أي وقت من داخل التطبيق: الإعدادات ← حذف الحساب.
            </p>
            <ul className="list-disc pr-5 space-y-1 mt-2">
              <li>
                عند تأكيد الحذف يُحذف الحساب نهائيًا، وتُحذف جميع البيانات المرتبطة به: بيانات
                الملف الشخصي، الإعلانات وصورها، طلبات السكن والردود والعروض، المفضلة، المحادثات
                والرسائل، الإشعارات، رموز الأجهزة المستخدمة للإشعارات، التقييمات، البلاغات، وطلبات
                التوثيق وملفات صورها المرفوعة.
              </li>
              <li>العملية نهائية ولا يمكن التراجع عنها، ولا يمكن استعادة الحساب أو بياناته.</li>
              <li>
                استثناء: إذا كان الحساب مرتبطًا بعقد إيجار نشط بصفة مالك أو مستأجر، فلا يمكن حذف
                الحساب تلقائيًا من التطبيق حفاظًا على حقوق جميع الأطراف. في هذه الحالة تُعرض رسالة
                توضح ذلك، ويجب إنهاء العقد أو التواصل مع الدعم لإتمام الحذف يدويًا.
              </li>
              <li>
                إذا تعذّر عليك تسجيل الدخول، يمكنك طلب حذف الحساب من صفحة «حذف الحساب» على
                <a href="/account-deletion" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors"> {''}moktari.app</a>
                ، أو عبر التواصل على <a href="mailto:support@sstd.cc" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">{''}support@sstd.cc</a>.
                تُعالَج هذه الطلبات يدويًا من قبل فريق الدعم خلال مدة معقولة.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">10. حقوقك</h2>
            <ul className="list-disc pr-5 space-y-1">
              <li>طلب الاطلاع على بياناتك وفق ما تسمح به الأنظمة</li>
              <li>تصحيح أو تحديث بياناتك</li>
              <li>حذف حسابك وبياناتك نهائيًا (راجع القسم 9 أعلاه)</li>
              <li>التواصل مع SSTD بشأن الخصوصية عبر وسائل التواصل أدناه</li>
            </ul>
          </section>


          <section>
            <h2 className="text-base font-bold mb-2">11. التواصل بخصوص الخصوصية</h2>
            <p>لأي استفسار أو طلب يتعلق بالخصوصية، تواصل معنا عبر:</p>
            <ul className="mt-1 space-y-1">
              <li dir="ltr">
                <a href="mailto:support@sstd.cc" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">support@sstd.cc</a>
              </li>
              <li dir="ltr">
                <a href="tel:730122233" className="underline decoration-primary/40 underline-offset-4 hover:text-primary transition-colors">730122233</a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
