import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { BadgeCheck, Clock, XCircle, Upload, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const roleToVerification = (role?: string): 'renter' | 'owner' | 'broker' => {
  if (role === 'owner') return 'owner';
  if (role === 'broker') return 'broker';
  return 'renter';
};

const roleLabelMap: Record<string, string> = {
  renter: 'مستأجر عقار',
  owner: 'مالك عقار',
  broker: 'دلال عقارات',
};

const VerificationPage = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const verificationRole = roleToVerification(profile?.role);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [businessFile, setBusinessFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const idInputRef = useRef<HTMLInputElement>(null);
  const bizInputRef = useRef<HTMLInputElement>(null);

  const fetchExisting = useCallback(async () => {
    if (!user) return;
    setError(false);
    setLoading(true);
    const { data, error: err } = await supabase
      .from('verification_applications')
      .select('*')
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (err) {
      setError(true);
    } else {
      setExistingApp(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchExisting(); }, [fetchExisting]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'نوع الملف غير مدعوم. استخدم JPG, PNG, WEBP أو PDF';
    if (file.size > MAX_FILE_SIZE) return 'حجم الملف يتجاوز 5 ميغابايت';
    return null;
  };

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from('verifications')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return data.path;
  };

  const handleSubmit = async () => {
    if (!user || !idFile) return;
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    const idErr = validateFile(idFile);
    if (idErr) { toast.error(idErr); return; }
    if (businessFile) {
      const bizErr = validateFile(businessFile);
      if (bizErr) { toast.error(bizErr); return; }
    }

    setSubmitting(true);
    setUploadProgress(20);
    try {
      const timestamp = Date.now();
      const idPath = `${user.id}/id_${timestamp}.${idFile.name.split('.').pop()}`;
      await uploadFile(idFile, idPath);
      setUploadProgress(50);

      let bizPath: string | null = null;
      if (businessFile) {
        bizPath = `${user.id}/biz_${timestamp}.${businessFile.name.split('.').pop()}`;
        await uploadFile(businessFile, bizPath);
      }
      setUploadProgress(75);

      // Store private storage paths only — NOT public URLs
      const { error: insertErr } = await supabase.from('verification_applications').insert({
        applicant_id: user.id,
        role: verificationRole,
        id_document_url: idPath,
        business_document_url: bizPath,
        notes: notes.trim() || null,
        email: email.trim() || null,
      } as any);
      if (insertErr) throw insertErr;

      // Do NOT update profiles.verification_badge directly from client.
      // The DB trigger on_verification_application_insert handles this safely.

      setUploadProgress(100);
      toast.success('تم إرسال طلب التوثيق بنجاح');
      fetchExisting();
    } catch {
      toast.error('تعذر إكمال العملية، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Derive effective verification state from latest application + profile badge
  const badge = profile?.verification_badge;
  const latestAppStatus = existingApp?.status;

  const isVerified = badge === 'verified';
  const isPending = !isVerified && (latestAppStatus === 'pending');
  const isRejected = !isVerified && !isPending && (latestAppStatus === 'rejected');
  const showForm = !isVerified && !isPending;

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader title="التوثيق" showBack />

      <div className="p-4 max-w-lg mx-auto md:max-w-none md:mx-0">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive text-sm">تعذر تحميل البيانات</p>
            <Button variant="outline" size="sm" onClick={fetchExisting}>
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <>
            {isVerified && (
              <Card className="border-success/30 bg-success/5 mb-6">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                    <BadgeCheck className="h-7 w-7 text-success" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-success">حسابك موثّق</h2>
                    <p className="text-sm text-muted-foreground mt-1">تم التحقق من هويتك بنجاح</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isPending && (
              <Card className="border-accent/30 bg-accent/5 mb-6">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                    <Clock className="h-7 w-7 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-accent">قيد المراجعة</h2>
                    <p className="text-sm text-muted-foreground mt-1">طلبك تحت المراجعة من فريق مُكتري</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isRejected && (
              <Card className="border-destructive/30 bg-destructive/5 mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                      <XCircle className="h-7 w-7 text-destructive" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-destructive">تم رفض الطلب</h2>
                      <p className="text-sm text-muted-foreground mt-1">يمكنك إعادة التقديم</p>
                    </div>
                  </div>
                  {existingApp?.review_note && (
                    <p className="mt-3 text-sm bg-destructive/5 rounded-lg p-3 text-foreground">
                      <strong>سبب الرفض:</strong> {existingApp.review_note}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {showForm && (
              <>
                {!isRejected && badge === 'none' && (
                  <Card className="mb-6">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        <h2 className="text-base font-bold">وثّق حسابك</h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        التوثيق يزيد من ثقة المستأجرين ويميّز إعلاناتك بشارة التحقق.
                        أرسل وثيقة الهوية وسنراجع طلبك خلال 24 ساعة.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-5">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">نوع التوثيق</Label>
                    <div className="bg-muted rounded-xl px-4 py-3 text-sm font-medium text-foreground">
                      {roleLabelMap[verificationRole]}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">
                      البريد الإلكتروني <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="email"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      className="text-left"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">
                      وثيقة الهوية <span className="text-destructive">*</span>
                    </Label>
                    <input
                      ref={idInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      className="hidden"
                      onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                    />
                    <button
                      onClick={() => idInputRef.current?.click()}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors',
                        idFile ? 'border-success/50 bg-success/5' : 'border-border hover:border-accent/50'
                      )}
                    >
                      {idFile ? (
                        <>
                          <FileText className="h-5 w-5 text-success shrink-0" />
                          <span className="text-sm truncate">{idFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground">اختر ملف (JPG, PNG, PDF — حد 5MB)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">وثيقة تجارية (اختياري)</Label>
                    <input
                      ref={bizInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      className="hidden"
                      onChange={(e) => setBusinessFile(e.target.files?.[0] || null)}
                    />
                    <button
                      onClick={() => bizInputRef.current?.click()}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors',
                        businessFile ? 'border-success/50 bg-success/5' : 'border-border hover:border-accent/50'
                      )}
                    >
                      {businessFile ? (
                        <>
                          <FileText className="h-5 w-5 text-success shrink-0" />
                          <span className="text-sm truncate">{businessFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground">سجل تجاري أو رخصة مهنية</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">ملاحظات إضافية</Label>
                    <Textarea
                      placeholder="أي معلومات إضافية تساعد في المراجعة..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      rows={3}
                    />
                  </div>

                  {uploadProgress > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-accent h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !idFile || !email.trim()}
                    className="w-full"
                  >
                    {submitting ? 'جاري الإرسال...' : 'إرسال طلب التوثيق'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default VerificationPage;
