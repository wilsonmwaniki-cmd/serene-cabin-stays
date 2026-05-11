import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GuestCharge = Tables<"guest_charges">;

export const useAdminGuestCharges = () =>
  useQuery({
    queryKey: ["admin_guest_charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_charges")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GuestCharge[];
    },
  });
