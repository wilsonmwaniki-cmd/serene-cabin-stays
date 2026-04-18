import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Pod = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_kes: number;
  surcharge_kes: number;
  capacity: number;
  size_sqft: number | null;
  amenities: string[];
  total_units: number;
  display_order: number;
};

export const usePods = () =>
  useQuery({
    queryKey: ["pods"],
    queryFn: async (): Promise<Pod[]> => {
      const { data, error } = await supabase
        .from("pods")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pod[];
    },
  });
