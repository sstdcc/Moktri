import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Check, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type TabStatus = 'pending' | 'approved' | 'rejected';

const tabList: { label: string; status: TabStatus }[] = [
  { label: 'معلقة', status: 'pending' },
  { label: 'مقبولة', status: 'approved' },
  { label: 'مرفوضة', status: 'rejected' },
];

const roleLabel: Record<string, string> = { renter: 'مستأجر عقار', owner: 'مالك عقار', broker: 'دلال عقارات' };

const PdfDocumentPreview = ({ url, title }: { url: string; title: string }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(720);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const loadPdf = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('PDF fetch failed');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPdfFile(objectUrl);
      } catch (error) {
        console.error('PDF preview error:', error);
        if (!cancelled) setPdfFile(url);
      }
    };

    setPdfFile(null);
    setNumPages(0);
    loadPdf();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pageWidth = Math.max(280, Math.min(containerWidth - 24, 860));

  return (
    <div
      ref={containerRef}
      className="h-[75vh] w-full overflow-y-auto rounded-lg border border-border bg-muted/30 p-3"
      aria-label={title}
    >
      {!pdfFile ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">جاري تحميل المعاينة…</div>
      ) : (
        <Document
          file={pdfFile}
          onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
          loading={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">جاري عرض المستند…</div>}
          error={<div className="py-10 text-center text-sm text-muted-foreground">تعذر عرض المستند داخل النافذة</div>}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: numPages }, (_, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              width={pageWidth}
              renderAnnotationLayer
              renderTextLayer
              className="overflow-hidden rounded-md border border-border bg-background shadow-sm"
            />
          ))}
        </Document>
      )}
    </div>
  );
};

/** Generate a short-lived signed URL for a private verification document */
const getSignedUrl = async (path: string): Promise<string | null> => {
  if (!path) return null;
  // If path is already an absolute URL (legacy public URL), return as-is
  if (path.startsWith('http')) return path;
  const { data, error } = await supabase.storage
    .from('verifications')
    .createSignedUrl(path, 300); // 5 min expiry
  if (error) {
    console.error('Signed URL error:', error.message);
    return null;
  }
  return data.signedUrl;
};

const VerificationsManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; app: any | null }>({ open: false, app: null });
  const [rejectReason, setRejectReason] = useState('');
  const [imageViewer, setImageViewer] = useState<{ open: boolean; url: string | null; title: string }>({ open: false, url: null, title: '' });

  const fetchApps = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('verification_applications')
      .select('*, applicant:profiles!verification_applications_applicant_id_fkey(full_name, role, verification_badge)')
      .eq('status', activeTab)
      .order('created_at', { ascending: false });
    setApps(data ?? []);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const openDocument = async (path: string, title: string) => {
    const url = await getSignedUrl(path);
    if (url) {
      setImageViewer({ open: true, url, title });
    } else {
      toast.error('تعذر فتح الملف');
    }
  };

  const approve = async (app: any) => {
    await supabase.from('profiles').update({ is_verified: true, verification_badge: 'verified' as any }).eq('id', app.applicant_id);
    await supabase.from('verification_applications').update({ status: 'approved' as any, reviewed_by: user!.id }).eq('id', app.id);
    await supabase.from('notifications').insert({
      type: 'verification_update' as any,
      user_id: app.applicant_id,
      title_ar: 'تم توثيق حسابك ✓',
      body_ar: 'تهانينا! تم التحقق من هويتك وأصبح حسابك موثقاً',
    });
    toast.success('تم قبول التوثيق');
    fetchApps();
  };

  const confirmReject = async () => {
    if (!rejectModal.app) return;
    const app = rejectModal.app;
    await supabase.from('profiles').update({ verification_badge: 'rejected' as any }).eq('id', app.applicant_id);
    await supabase.from('verification_applications').update({
      status: 'rejected' as any,
      review_note: rejectReason,
      reviewed_by: user!.id,
    }).eq('id', app.id);
    await supabase.from('notifications').insert({
      type: 'verification_update' as any,
      user_id: app.applicant_id,
      title_ar: 'تم رفض طلب التوثيق',
      body_ar: `للأسف، تم رفض طلب توثيق حسابك — السبب: ${rejectReason}`,
    });
    toast.success('تم رفض التوثيق');
    setRejectModal({ open: false, app: null });
    setRejectReason('');
    fetchApps();
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-4">إدارة التوثيق</h1>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {tabList.map((t) => (
          <button
            key={t.status}
            onClick={() => setActiveTab(t.status)}
            className={cn(
              'px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors',
              activeTab === t.status ? 'bg-accent text-accent-foreground font-semibold' : 'bg-muted text-muted-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : apps.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد طلبات</p>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-foreground">{a.applicant?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel[a.role] ?? a.role}</p>
                </div>
                <Badge variant="outline" className="text-xs">{roleLabel[a.role] ?? a.role}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {a.created_at ? format(new Date(a.created_at), 'dd MMM yyyy', { locale: ar }) : ''}
              </p>
              {(a as any).email && (
                <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{(a as any).email}</p>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                {a.id_document_url && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDocument(a.id_document_url, 'صورة الهوية')}>
                    <Eye className="h-3 w-3" /> صورة الهوية
                  </Button>
                )}
                {a.business_document_url && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDocument(a.business_document_url, 'وثيقة إضافية')}>
                    <Eye className="h-3 w-3" /> وثيقة إضافية
                  </Button>
                )}
              </div>
              {a.notes && <p className="text-sm text-muted-foreground mt-2">{a.notes}</p>}
              {a.review_note && <p className="text-sm text-red-500 mt-2">ملاحظة: {a.review_note}</p>}

              {activeTab === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-success text-success-foreground h-8" onClick={() => approve(a)}>
                    <Check className="h-4 w-4" /> قبول التوثيق
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8" onClick={() => setRejectModal({ open: true, app: a })}>
                    <X className="h-4 w-4" /> رفض
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={rejectModal.open} onOpenChange={(o) => !o && setRejectModal({ open: false, app: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>رفض طلب التوثيق</DialogTitle></DialogHeader>
          <Textarea placeholder="سبب الرفض" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={imageViewer.open} onOpenChange={(o) => !o && setImageViewer({ open: false, url: null, title: '' })}>
        <DialogContent className="max-w-4xl p-2">
          <DialogHeader className="px-4 pt-2">
            <DialogTitle>{imageViewer.title}</DialogTitle>
          </DialogHeader>
          {imageViewer.url && (() => {
            const url = imageViewer.url;
            const lower = url.split('?')[0].toLowerCase();
            const isPdf = lower.endsWith('.pdf');
            const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|heic|heif)$/.test(lower);
            return (
              <div className="flex flex-col items-center justify-center gap-2 p-2">
                {isPdf ? (
                  <PdfDocumentPreview url={url} title={imageViewer.title} />
                ) : isImage ? (
                  <img
                    src={url}
                    alt={imageViewer.title}
                    className="max-h-[75vh] max-w-full rounded-lg object-contain"
                  />
                ) : (
                  // Unknown type — try iframe, browser will render or offer download
                  <iframe
                    src={url}
                    title={imageViewer.title}
                    className="w-full h-[75vh] rounded-lg border border-border bg-background"
                  />
                )}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  فتح في نافذة جديدة / تحميل
                </a>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VerificationsManagement;
