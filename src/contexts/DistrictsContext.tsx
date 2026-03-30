import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { District } from '@/types/database';

interface DistrictsContextType {
  districts: District[];
  loading: boolean;
}

const DistrictsContext = createContext<DistrictsContextType>({ districts: [], loading: true });

export const useDistricts = () => useContext(DistrictsContext);

export const DistrictsProvider = ({ children }: { children: ReactNode }) => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('districts')
        .select('id, name_ar, name_en, city, is_active, listing_count')
        .eq('is_active', true)
        .order('name_ar');
      setDistricts(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <DistrictsContext.Provider value={{ districts, loading }}>
      {children}
    </DistrictsContext.Provider>
  );
};
