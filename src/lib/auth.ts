import { supabase } from '@/integrations/supabase/client';

export type OtpChannel = 'email' | 'phone';

type OtpTarget = {
  channel?: OtpChannel;
  email?: string;
  phone?: string;
};

const resolveChannel = (t: OtpTarget): OtpChannel => {
  if (t.channel) return t.channel;
  return t.email ? 'email' : 'phone';
};

const sendOtpRequest = async (urlPath: string, body: Record<string, unknown>) => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${urlPath}`;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || anon;
  let res: Response | null = null;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('تعذر إكمال العملية، حاول مرة أخرى');
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.error) {
    throw new Error(payload?.error || 'تعذر إكمال العملية، حاول مرة أخرى');
  }
  return payload;
};

export const signInWithOtp = async (target: OtpTarget) => {
  const channel = resolveChannel(target);
  const body: Record<string, unknown> = { channel, ...(target.email ? { email: target.email.trim() } : {}), ...(target.phone ? { phone: target.phone } : {}) };
  await sendOtpRequest('send-otp', body);
  return { success: true };
};

export const verifyOtp = async (opts: { token: string; email?: string; phone?: string; password?: string; channel?: OtpChannel }) => {
  const channel = opts.channel ?? (opts.email ? 'email' : 'phone');
  const body: Record<string, unknown> = {
    channel,
    code: opts.token,
    ...(opts.email ? { email: opts.email.trim() } : {}),
    ...(opts.phone ? { phone: opts.phone } : {}),
    ...(opts.password ? { password: opts.password } : {}),
  };
  const payload = await sendOtpRequest('verify-otp', body);

  // Set the session from the response
  if (payload?.session) {
    await supabase.auth.setSession({
      access_token: payload.session.access_token,
      refresh_token: payload.session.refresh_token,
    });
  }

  return { success: true, isNew: payload?.isNew };
};

// Google flow: the identifier (email) is resolved server-side from the session
// JWT; the client only supplies the OTP code.
export const verifyGoogleOtp = async (token: string) => {
  await sendOtpRequest('verify-otp-google', { code: token, channel: 'email' });
  return { success: true };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};