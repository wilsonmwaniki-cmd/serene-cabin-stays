import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminBooking = {
  id: string;
  created_at: string;
  pod_id: string;
  pod_name?: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  addons: { name: string; quantity: number; unit_price_kes: number; pricing_unit: string }[];
};

export const useAdminBookings = () =>
  useQuery({
    queryKey: ["admin_bookings"],
    queryFn: async (): Promise<AdminBooking[]> => {
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: pods } = await supabase.from("pods").select("id,name");
      const podMap = new Map((pods ?? []).map((p) => [p.id, p.name]));

      const ids = (bookings ?? []).map((b) => b.id);
      const { data: ba } = ids.length
        ? await supabase
            .from("booking_addons")
            .select("booking_id,quantity,unit_price_kes,pricing_unit,addons(name)")
            .in("booking_id", ids)
        : { data: [] };

      const addonMap = new Map<string, AdminBooking["addons"]>();
      for (const row of ba ?? []) {
        const list = addonMap.get(row.booking_id) ?? [];
        // @ts-expect-error nested
        list.push({ name: row.addons?.name ?? "Add-on", quantity: row.quantity, unit_price_kes: row.unit_price_kes, pricing_unit: row.pricing_unit });
        addonMap.set(row.booking_id, list);
      }

      return (bookings ?? []).map((b) => ({
        ...b,
        pod_name: podMap.get(b.pod_id),
        addons: addonMap.get(b.id) ?? [],
      })) as AdminBooking[];
    },
  });
