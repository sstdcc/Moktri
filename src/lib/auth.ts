import { supabase } from '@/integrations/supabase/client';

export const signInWithOtp = async (phone: string, email?: string) => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let res: Response | null = null;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ phone, ...(email ? { email } : {}) }),
    });
  } catch {
    throw new Error('تعذر إكمال العملية، حاول مرة أخرى');
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.error) {
    throw new Error(payload?.error || 'تعذر إكمال العملية، حاول مرة أخرى');
  }
  return { success: true };
};

export const verifyOtp = async (phone: string, token: string, email?: string, password?: string) => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let res: Response | null = null;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ phone, code: token, email, password }),
    });
  } catch {
    throw new Error('تعذر إكمال العملية، حاول مرة أخرى');
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.error) {
    throw new Error(payload?.error || 'تعذر إكمال العملية، حاول مرة أخرى');
  }

  // Set the session from the response
  if (payload?.session) {
    await supabase.auth.setSession({
      access_token: payload.session.access_token,
      refresh_token: payload.session.refresh_token,
    });
  }

  return { success: true, isNew: payload?.isNew };
};

export const verifyGoogleOtp = async (phone: string, token: string) => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp-google`;
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
      body: JSON.stringify({ phone, code: token }),
    });
  } catch {
    throw new Error('تعذر إكمال العملية، حاول مرة أخرى');
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.error) {
    throw new Error(payload?.error || 'تعذر إكمال العملية، حاول مرة أخرى');
  }
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
