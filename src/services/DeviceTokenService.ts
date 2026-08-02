import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

class DeviceTokenService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async register(userId: string, token: string, platform: string): Promise<void> {
    const { error } = await this.supabase
      .from('device_tokens')
      .upsert({ user_id: userId, token, platform }, { onConflict: 'user_id,token' });
    if (error) throw error;
  }

  async unregister(token: string): Promise<void> {
    const { error } = await this.supabase
      .from('device_tokens')
      .delete()
      .eq('token', token);
    if (error) throw error;
  }

  async unregisterAllForUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('device_tokens')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export default DeviceTokenService;
