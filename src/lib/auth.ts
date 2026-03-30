import { supabase } from '@/integrations/supabase/client';

export const signInWithOtp = async (phone: string) => {
  const { data, error } = await supabase.functions.invoke('send-otp', {
    body: { phone },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const verifyOtp = async (phone: string, token: string) => {
  const { data, error } = await supabase.functions.invoke('verify-otp', {
    body: { phone, code: token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // Set the session from the response
  if (data?.session) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  return data;
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
