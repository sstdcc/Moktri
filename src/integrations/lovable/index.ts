import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: opts?.redirect_uri,
          ...(opts?.extraParams ? { queryParams: opts.extraParams } : {}),
        },
      });

      if (error) {
        return { error };
      }

      if (data?.url) {
        return { redirected: true };
      }

      return { data };
    },
  },
};
