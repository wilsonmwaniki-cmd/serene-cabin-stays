import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateBookingPricing, type AppliedPromoCode, type PricingPod } from "@/lib/booking-pricing";

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
  subtotal_kes: number | null;
  discount_kes: number | null;
  total_kes: number | null;
  promo_code_text: string | null;
  promo_code_kind: "discount" | "affiliate" | null;
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

      const { data: pods } = await supabase.from("pods").select("id,name,slug,price_kes,surcharge_kes");
      const podMap = new Map((pods ?? []).map((p) => [p.id, p as PricingPod]));

      const ids = (bookings ?? []).map((b) => b.id);
      const { data: ba } = ids.length
        ? await supabase
            .from("booking_addons")
            .select("booking_id,quantity,unit_price_kes,pricing_unit,addons(name)")
            .in("booking_id", ids)
        : { data: [] };

      const addonMap = new Map<string, AdminBooking["addons"]>();
      for (const row of (ba ?? []) as Array<{ booking_id: string; quantity: number; unit_price_kes: number; pricing_unit: string; addons: { name: string } | null }>) {
        const list = addonMap.get(row.booking_id) ?? [];
        list.push({ name: row.addons?.name ?? "Add-on", quantity: row.quantity, unit_price_kes: row.unit_price_kes, pricing_unit: row.pricing_unit });
        addonMap.set(row.booking_id, list);
      }

      return (bookings ?? []).map((b) => ({
        ...b,
        pod_name: podMap.get(b.pod_id)?.name,
        subtotal_kes: b.subtotal_kes,
        discount_kes: b.discount_kes,
        total_kes:
          b.total_kes ??
          calculateBookingPricing({
            pod: podMap.get(b.pod_id),
            nights: Math.max(
              0,
              Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000),
            ),
            adults: b.adults,
            children: b.children,
            rooms: b.rooms,
            selectedAddons: (addonMap.get(b.id) ?? []).map((addon) => ({
              price_kes: addon.unit_price_kes,
              pricing_unit: addon.pricing_unit as "per_night" | "per_night_per_adult" | "one_time",
            })),
            promo:
              b.promo_code_text && b.promo_code_kind
                ? ({
                    id: "",
                    code: b.promo_code_text,
                    label: b.promo_code_text,
                    kind: b.promo_code_kind,
                    discount_type: "fixed",
                    amount_kes: b.discount_kes ?? 0,
                    percent_off: null,
                  } satisfies AppliedPromoCode)
                : null,
          }).totalKes,
        promo_code_text: b.promo_code_text,
        promo_code_kind: b.promo_code_kind,
        addons: addonMap.get(b.id) ?? [],
      })) as AdminBooking[];
    },
  });
