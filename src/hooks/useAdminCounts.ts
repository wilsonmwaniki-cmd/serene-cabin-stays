import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAdminCounts = () =>
  useQuery({
    queryKey: ["admin_counts"],
    queryFn: async () => {
      const [bookings, messages] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      return {
        pendingBookings: bookings.count ?? 0,
        newMessages: messages.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });
