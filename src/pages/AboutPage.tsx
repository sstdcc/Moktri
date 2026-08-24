import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { Building2, KeyRound, Handshake, Target, Sparkles } from 'lucide-react';

const AUDIENCES = [
  {
    icon: Building2,
    title: 'المالك',
    desc: 'اعرض عقارك بسهولة، واستقبل طلبات المستأجرين، وتواصل معهم مباشرة حتى إتمام التأجير.',
  },
  {
    icon: Handshake,
    title: 'الدلال / الوسيط',
    desc: 'أدر عروض العقارات نيابة عن الملاك، ووسّط بين الأطراف باحترافية وثقة.',
  },
  {
    icon: KeyRound,
    title: 'المستأجر',
    desc: 'ابحث عن السكن المناسب حسب المنطقة والسعر، أو انشر طلب سكن ودع الملاك يقدمون عروضهم لك.',
  },
];

const FEATURES = [
  'إعلانات عقارات موثوقة مع الصور والتفاصيل والأسعار',
  'طلبات سكن تتيح للمستأجر وصف ما يبحث عنه',
  'محادثات مباشرة بين الأطراف للتفاوض وإتمام الاتفاق',
  'توثيق الحسابات لتعزيز الثقة بين المستخدمين',
  'لوحات تحكم خاصة بكل دور: المالك والدلال والمستأجر',
];

const AboutPage = () => {
  usePageTitle();

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <PageHeader title="من نحن" showBack fallbackPath="/settings" />
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* ما هو مكتري؟ */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-bold mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            ما هو مُكتري؟
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            مُكتري منصة يمنية متخصصة في تأجير العقارات، تجمع الملاك والدلالين والمستأجرين في مكان واحد،
            وتجعل عملية البحث عن سكن أو تأجير عقار أسهل وأسرع وأكثر شفافية.
          </p>
        </section>

        {/* الفكرة والهدف */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-bold mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            فكرتنا وهدفنا
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            هدفنا تبسيط رحلة التأجير من البحث وحتى الاتفاق، بإزالة الوساطة العشوائية وطول الطريق بين
            صاحب العقار ومستأجره. نوفر بيئة منظمة يعرض فيها كل طرف احتياجه بوضوح، ويتواصل الأطراف
            مباشرة، ويتم التوثيق والتقييم لتعزيز الثقة.
          </p>
        </section>

        {/* ماذا نقدم؟ */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-bold mb-3">ماذا نقدم؟</h2>
          <ul className="space-y-2 text-sm text-foreground leading-relaxed">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* الفئات المستفيدة */}
        <section>
          <h2 className="text-base font-bold mb-3">الفئات المستفيدة</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {AUDIENCES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col items-start gap-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* الجهة المشغلة */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-bold mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            الجهة المشغلة
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            مُكتري هو تطبيق تابع لشركة SSTD ويتم تشغيله وإدارته بواسطة الشركة.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground">
            <li className="font-bold" dir="ltr">SSTD</li>
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

        <p className="text-xs text-muted-foreground text-center pb-2">
          مُكتري — منصة تأجير العقارات. جميع الحقوق محفوظة © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
