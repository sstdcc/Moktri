import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, SendHorizonal, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { subject?: string; email?: string; message?: string };

const ContactPage = () => {
  usePageTitle();

  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!subject.trim()) next.subject = 'يرجى كتابة عنوان المشكلة أو سبب التواصل';
    else if (subject.trim().length > 150) next.subject = 'العنوان طويل جدًا (الحد 150 حرفًا)';
    if (!email.trim()) next.email = 'يرجى إدخال البريد الإلكتروني';
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'صيغة البريد الإلكتروني غير صحيحة';
    if (!message.trim()) next.message = 'يرجى كتابة شرح المشكلة';
    else if (message.trim().length > MAX_MESSAGE_LENGTH)
      next.message = `الشرح طويل جدًا (الحد ${MAX_MESSAGE_LENGTH} حرفًا)`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Transport: Supabase Edge Function `contact-support`.
   * NOTE: the function is not deployed yet — until it is approved and
   * created server-side, submission will fail safely with a clear error.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || sent) return;
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('contact-support', {
        body: {
          subject: subject.trim(),
          email: email.trim().toLowerCase(),
          message: message.trim(),
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setSubmitError('تعذر إرسال الرسالة حاليًا. حاول مرة أخرى لاحقًا.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <PageHeader title="تواصل معنا" showBack fallbackPath="/settings" />
      <div className="p-4 max-w-2xl mx-auto">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <h2 className="text-base font-bold text-foreground">تم إرسال رسالتك بنجاح</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                شكرًا لتواصلك معنا. سيتم مراجعة رسالتك والرد عليك في أقرب وقت ممكن.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="contact-subject" className="block text-[13px] font-bold text-foreground mb-1.5">
                  عنوان المشكلة أو سبب التواصل
                </label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (errors.subject) setErrors((p) => ({ ...p, subject: undefined }));
                  }}
                  placeholder="مثال: مشكلة في نشر إعلان"
                  maxLength={150}
                  aria-invalid={!!errors.subject}
                  className={errors.subject ? 'border-destructive' : undefined}
                />
                {errors.subject && (
                  <p className="mt-1.5 text-xs font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.subject}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-[13px] font-bold text-foreground mb-1.5">
                  البريد الإلكتروني
                </label>
                <Input
                  id="contact-email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  placeholder="example@mail.com"
                  maxLength={254}
                  aria-invalid={!!errors.email}
                  className={errors.email ? 'border-destructive' : undefined}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-[13px] font-bold text-foreground mb-1.5">
                  شرح المشكلة
                </label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) setErrors((p) => ({ ...p, message: undefined }));
                  }}
                  placeholder="اشرح المشكلة بالتفصيل..."
                  rows={6}
                  maxLength={MAX_MESSAGE_LENGTH}
                  aria-invalid={!!errors.message}
                  className={errors.message ? 'border-destructive' : undefined}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  {errors.message ? (
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.message}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="text-[10px] text-muted-foreground shrink-0" dir="ltr">
                    {message.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-[13px] font-medium text-destructive">{submitError}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl font-tajawal"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <SendHorizonal className="h-4 w-4" />
                    إرسال
                  </>
                )}
              </Button>
            </form>
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center mt-4 pb-2">
          منصة مُكتري لتأجير العقارات
        </p>
      </div>
    </div>
  );
};

export default ContactPage;
