import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginRequired } from '@/components/ui/LoginRequired';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  User, Camera, Phone, LogOut, MessageCircle, Shield,
  Info, FileText, RefreshCw, Bell, Sun, Moon, Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';

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

const SettingsPage = () => {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(defaultNotifPrefs);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setWhatsapp(profile.whatsapp_number || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    }
    // Load notification prefs
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
        whatsapp_number: whatsapp.trim() || null,
        bio: bio.trim() || null,
      }).eq('id', user.id);
      if (error) throw error;
      toast.success('تم حفظ التغييرات');
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

  const getInitials = (name: string) => name?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '؟';

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
        <PageHeader title="الإعدادات" showBack />
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader title="الإعدادات" showBack />

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Section 1: Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              معلومات الملف الشخصي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary border-2 border-primary/20">
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
                  className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-md transition-opacity hover:opacity-90"
                  aria-label="تغيير الصورة الشخصية"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">الاسم الكامل</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">رقم الواتساب</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" placeholder="+967..." />
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">نبذة عنك</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} placeholder="اكتب نبذة مختصرة..." />
              <p className="text-[10px] text-muted-foreground mt-1 text-left" dir="ltr">{bio.length}/500</p>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </CardContent>
        </Card>

        {/* Section 2: Account */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              الحساب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-sm mb-1.5 block">رقم الهاتف</Label>
              <Input value={profile.phone} disabled dir="ltr" className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">تغيير رقم الهاتف قريباً</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              إعدادات الإشعارات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(notifLabels).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-sm cursor-pointer">{label}</Label>
                <Switch
                  checked={notifPrefs[key as keyof typeof notifPrefs]}
                  onCheckedChange={() => toggleNotifPref(key)}
                  aria-label={label}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section: Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4 text-primary" />
              المظهر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'system', label: 'النظام', Icon: Monitor },
                { value: 'light', label: 'فاتح', Icon: Sun },
                { value: 'dark', label: 'داكن', Icon: Moon },
              ] as { value: ThemeMode; label: string; Icon: typeof Sun }[]).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-bold transition-all',
                    theme === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  )}
                  aria-pressed={theme === value}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">يتم حفظ اختيارك تلقائياً</p>
          </CardContent>
        </Card>

        {/* Section 4: Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              الأمان
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <LogOut className="h-4 w-4 ml-2" />
                  تسجيل الخروج
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-tajawal">تسجيل الخروج</AlertDialogTitle>
                  <AlertDialogDescription className="font-tajawal">
                    هل أنت متأكد من تسجيل الخروج؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel className="font-tajawal">إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut} className="font-tajawal bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    تسجيل الخروج
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Section 5: Support */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              الدعم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href="https://wa.me/967772867128"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              تواصل مع الدعم عبر واتساب
            </a>
          </CardContent>
        </Card>

        {/* Section 6: About */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              حول التطبيق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الإصدار</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <button onClick={() => navigate('/terms')} className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                <FileText className="h-4 w-4" />
                الشروط والأحكام
              </button>
              <button onClick={() => navigate('/privacy')} className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                <Shield className="h-4 w-4" />
                سياسة الخصوصية
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default SettingsPage;
