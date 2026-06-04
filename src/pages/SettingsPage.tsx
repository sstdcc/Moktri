import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginRequired } from '@/components/ui/LoginRequired';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  User, Camera, Phone, Mail, LogOut, MessageCircle, Shield,
  Info, FileText, Bell, Sun, Moon, Monitor, ChevronLeft, ChevronRight,
  Lock, ArrowRight, ArrowLeft, UserCircle2, BellRing, Palette, ShieldCheck, LifeBuoy, Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLanguage } from '@/i18n';

const NOTIF_PREFS_KEY = 'miftah_notif_prefs';

const defaultNotifPrefs = {
  new_response: true,
  listing_expiring: true,
  listing_approved: true,
  listing_rejected: true,
  verification_update: true,
  new_report: true,
  system: true,
};

const notifLabels: Record<string, string> = {
  new_response: 'ردود جديدة',
  listing_expiring: 'انتهاء صلاحية الإعلان',
  listing_approved: 'موافقة على الإعلان',
  listing_rejected: 'رفض الإعلان',
  verification_update: 'تحديثات التوثيق',
  new_report: 'بلاغات جديدة',
  system: 'إشعارات النظام',
};

/* ---------- Reusable premium row primitives ---------- */

const SectionLabel = ({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) => (
  <h2 className="px-1 mb-2.5 flex items-center gap-1.5 text-[12px] font-normal text-muted-foreground/80 tracking-wide">
    {Icon && <Icon className="h-[13px] w-[13px]" strokeWidth={1.75} />}
    <span>{children}</span>
  </h2>
);

const SettingsCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={cn(
      'rounded-2xl border border-border/60 bg-card overflow-hidden',
      'shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
      className
    )}
  >
    {children}
  </div>
);

const Row = ({
  icon: Icon,
  label,
  subtext,
  right,
  onClick,
  isLast,
  className,
}: {
  icon?: React.ElementType;
  label: string;
  subtext?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  isLast?: boolean;
  className?: string;
}) => {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3.5 px-4 py-3.5 text-start transition-colors duration-150',
        onClick && 'hover:bg-muted/50 active:bg-muted/70 cursor-pointer',
        !isLast && 'border-b border-border/40',
        className
      )}
    >
      {Icon && (
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-foreground/70 shrink-0">
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] text-foreground font-medium leading-tight truncate">{label}</div>
        {subtext && (
          <div className="text-[12.5px] text-muted-foreground mt-0.5 truncate" dir="ltr" style={{ textAlign: 'right' }}>
            {subtext}
          </div>
        )}
      </div>
      {right !== undefined && <div className="shrink-0 text-muted-foreground">{right}</div>}
    </Comp>
  );
};

/* ---------- Page ---------- */

const SettingsPage = () => {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('en') ? 'en' : 'ar') as AppLanguage;
  const dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(defaultNotifPrefs);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    }
    try {
      const saved = localStorage.getItem(NOTIF_PREFS_KEY);
      if (saved) setNotifPrefs(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [profile]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة يتجاوز 2 ميغابايت');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('نوع الملف غير مدعوم');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = data.publicUrl;

      await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', user.id);
      setAvatarUrl(newUrl);
      toast.success('تم تحديث الصورة');
    } catch {
      toast.error('تعذر رفع الصورة');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error('الاسم مطلوب');
      return;
    }
    if (fullName.trim().length > 100) {
      toast.error('الاسم طويل جداً');
      return;
    }
    if (bio.length > 500) {
      toast.error('النبذة طويلة جداً (حد 500 حرف)');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim(),
        bio: bio.trim() || null,
      }).eq('id', user.id);
      if (error) throw error;
      toast.success('تم حفظ التغييرات');
      setProfileOpen(false);
    } catch {
      toast.error('تعذر حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifPref = (key: string) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key as keyof typeof notifPrefs] };
    setNotifPrefs(updated);
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const getInitials = (name: string) =>
    name?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '؟';

  if (!user) {
    return (
      <LoginRequired
        pageTitle="الإعدادات"
        icon={User}
        subtitle="يجب تسجيل الدخول لإدارة إعداداتك وحسابك"
      />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
        <div className="px-4 pt-6 pb-4">
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
        <div className="w-full p-4 space-y-5">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const ChevForward = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const BackArrow = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const arrow = <ChevForward className="h-[18px] w-[18px]" strokeWidth={2} />;

  return (
    <div className="min-h-screen bg-background pb-24 font-tajawal" dir={dir}>
      {/* Minimal centered header */}
      <header className="relative px-4 pt-7 pb-3">
        <button
          onClick={() => {
            const state = window.history.state as { idx?: number } | null;
            const idx = state && typeof state.idx === 'number' ? state.idx : 0;
            if (idx > 0) navigate(-1);
            else navigate('/', { replace: true });
          }}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 mt-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 transition-colors",
            dir === 'rtl' ? 'right-4' : 'left-4'
          )}
          aria-label={t('settings.back')}
        >
          <BackArrow className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <h1 className="text-center text-[17px] font-medium text-foreground tracking-tight">
          {t('settings.title')}
        </h1>
      </header>

      <div className="w-full px-4 space-y-7 pt-4">
        {/* Profile summary card */}
        <SettingsCard>
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3.5 p-4 text-start transition-colors duration-150 hover:bg-muted/40 active:bg-muted/60"
          >
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-base font-semibold ring-1 ring-primary/15">
                  {getInitials(fullName)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15.5px] font-medium text-foreground truncate">
                {fullName || t('settings.noName')}
              </div>
              <div className="text-[12.5px] text-muted-foreground mt-0.5 truncate" dir="ltr" style={{ textAlign: 'right' }}>
                {profile.phone}
              </div>
            </div>
            <ChevForward className="h-5 w-5 text-muted-foreground/70" strokeWidth={2} />
          </button>
        </SettingsCard>

        {/* Account */}
        <section>
          <SectionLabel icon={UserCircle2}>{t('settings.sections.account')}</SectionLabel>
          <SettingsCard>
            <Row icon={User} label={t('settings.account.name')} subtext={fullName || '—'} onClick={() => setProfileOpen(true)} right={arrow} />
            <Row icon={Mail} label={t('settings.account.email')} subtext={user.email || t('settings.account.emailMissing')} right={arrow} onClick={() => toast(t('settings.comingSoon'))} />
            <Row icon={Phone} label={t('settings.account.phone')} subtext={profile.phone} isLast />
          </SettingsCard>
        </section>

        {/* Notifications */}
        <section>
          <SectionLabel icon={BellRing}>{t('settings.sections.notifications')}</SectionLabel>
          <SettingsCard>
            {Object.entries(notifLabels).map(([key, label], idx, arr) => (
              <Row
                key={key}
                icon={Bell}
                label={label}
                isLast={idx === arr.length - 1}
                right={
                  <Switch
                    checked={notifPrefs[key as keyof typeof notifPrefs]}
                    onCheckedChange={() => toggleNotifPref(key)}
                    aria-label={label}
                  />
                }
              />
            ))}
          </SettingsCard>
        </section>

        {/* Appearance */}
        <section>
          <SectionLabel icon={Palette}>{t('settings.sections.appearance')}</SectionLabel>
          <SettingsCard className="p-3">
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'system', label: t('settings.appearance.system'), Icon: Monitor },
                { value: 'light', label: t('settings.appearance.light'), Icon: Sun },
                { value: 'dark', label: t('settings.appearance.dark'), Icon: Moon },
              ] as { value: ThemeMode; label: string; Icon: typeof Sun }[]).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-[12.5px] font-medium transition-all duration-150',
                    theme === value
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50'
                  )}
                  aria-pressed={theme === value}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
          </SettingsCard>
        </section>

        {/* Language */}
        <section>
          <SectionLabel icon={Languages}>{t('settings.sections.language')}</SectionLabel>
          <SettingsCard className="p-3">
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'ar', label: 'العربية', sub: t('settings.language.arabic') },
                { value: 'en', label: 'English', sub: t('settings.language.english') },
              ] as { value: AppLanguage; label: string; sub: string }[]).map(({ value, label, sub }) => (
                <button
                  key={value}
                  onClick={() => {
                    if (value === 'en') {
                      toast('قريباً سيتم توفير اللغة الإنجليزية');
                      return;
                    }
                    setAppLanguage(value);
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-[13.5px] font-semibold transition-all duration-150',
                    currentLang === value
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50'
                  )}
                  aria-pressed={currentLang === value}
                  lang={value}
                  dir={value === 'ar' ? 'rtl' : 'ltr'}
                >
                  <span>{label}</span>
                  <span className="text-[11px] font-normal opacity-70">{sub}</span>
                </button>
              ))}
            </div>
          </SettingsCard>
        </section>

        {/* Security */}
        <section>
          <SectionLabel icon={ShieldCheck}>{t('settings.sections.security')}</SectionLabel>
          <SettingsCard>
            <Row
              icon={Lock}
              label={t('settings.security.changePassword')}
              subtext={t('settings.security.changePasswordHint')}
              right={arrow}
              onClick={() => navigate('/change-password')}
              isLast
            />
          </SettingsCard>
        </section>

        {/* Support */}
        <section>
          <SectionLabel icon={LifeBuoy}>{t('settings.sections.support')}</SectionLabel>
          <SettingsCard>
            <Row
              icon={MessageCircle}
              label={t('settings.support.contact')}
              subtext={t('settings.support.contactHint')}
              right={arrow}
              onClick={() => window.open('https://wa.me/967772867128', '_blank')}
            />
            <Row icon={FileText} label={t('settings.support.terms')} right={arrow} onClick={() => navigate('/terms')} />
            <Row icon={Shield} label={t('settings.support.privacy')} right={arrow} onClick={() => navigate('/privacy')} />
            <Row icon={Info} label={t('settings.support.about')} subtext={t('settings.support.version')} isLast />
          </SettingsCard>
        </section>

        {/* Logout — separated card */}
        <section className="pt-2">
          <SettingsCard>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 text-[14.5px] font-medium text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors duration-150"
                >
                  <LogOut className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  {t('settings.logout')}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent dir={dir}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-tajawal">{t('settings.logout')}</AlertDialogTitle>
                  <AlertDialogDescription className="font-tajawal">
                    {t('settings.logoutConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel className="font-tajawal">{t('settings.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleSignOut}
                    className="font-tajawal bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('settings.logout')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SettingsCard>
        </section>
      </div>

      {/* Edit profile dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent dir="rtl" className="font-tajawal max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل الملف الشخصي</DialogTitle>
            <DialogDescription className="text-right">
              قم بتحديث بياناتك الشخصية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-1 ring-border" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary ring-1 ring-primary/15">
                    {getInitials(fullName)}
                  </div>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
                  aria-label="تغيير الصورة"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div>
              <Label className="text-[13px] mb-1.5 block text-muted-foreground">الاسم الكامل</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
            </div>

            <div>
              <Label className="text-[13px] mb-1.5 block text-muted-foreground">رقم الواتساب</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" placeholder="+967..." />
            </div>

            <div>
              <Label className="text-[13px] mb-1.5 block text-muted-foreground">نبذة عنك</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} placeholder="اكتب نبذة مختصرة..." />
              <p className="text-[10px] text-muted-foreground mt-1 text-left" dir="ltr">{bio.length}/500</p>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
            <Button variant="ghost" onClick={() => setProfileOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
