import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateBookingPricingForAllocations, type AppliedPromoCode, type PricingPod } from "@/lib/booking-pricing";
import type { Json } from "@/integrations/supabase/types";

export type BookingPodAllocation = {
  pod_id: string;
  rooms: number;
  pod_name?: string;
};

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
  children_12_plus: number;
  rooms: number;
  notes: string | null;
  pod_allocations: BookingPodAllocation[];
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

      const parseAllocations = (raw: Json | null, fallbackPodId: string, fallbackRooms: number): BookingPodAllocation[] => {
        if (!Array.isArray(raw) || raw.length === 0) {
          return [{ pod_id: fallbackPodId, rooms: fallbackRooms, pod_name: podMap.get(fallbackPodId)?.name }];
        }

        const allocations = raw
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return null;
            const podId = typeof item.pod_id === "string" ? item.pod_id : null;
            const rooms = typeof item.rooms === "number" ? item.rooms : Number(item.rooms ?? 0);
            if (!podId || !Number.isFinite(rooms) || rooms <= 0) return null;
            return {
              pod_id: podId,
              rooms,
              pod_name: podMap.get(podId)?.name,
            };
          })
          .filter((allocation): allocation is BookingPodAllocation => !!allocation);

        return allocations.length > 0
          ? allocations
          : [{ pod_id: fallbackPodId, rooms: fallbackRooms, pod_name: podMap.get(fallbackPodId)?.name }];
      };

      return (bookings ?? []).map((b) => {
        const allocations = parseAllocations(
          (b as { pod_allocations?: Json | null }).pod_allocations ?? null,
          b.pod_id,
          b.rooms,
        );
        const addons = addonMap.get(b.id) ?? [];
        const fallbackPricing = calculateBookingPricingForAllocations({
          allocations: allocations.map((allocation) => ({
            pod: podMap.get(allocation.pod_id),
            rooms: allocation.rooms,
          })),
          nights: Math.max(
            0,
            Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000),
          ),
          adults: b.adults,
          childrenUnder12: b.children,
          children12Plus: b.children_12_plus ?? 0,
          selectedAddons: addons.map((addon) => ({
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
        });

        return {
          ...b,
          pod_allocations: allocations,
          pod_name: allocations
            .map((allocation) => `${allocation.pod_name ?? podMap.get(allocation.pod_id)?.name ?? "Pod"} × ${allocation.rooms}`)
            .join(", "),
          total_kes: b.total_kes ?? fallbackPricing.totalKes,
          addons,
        } as AdminBooking;
      });
    },
  });
