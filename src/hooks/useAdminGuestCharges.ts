import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GuestCharge = Tables<"guest_charges">;
export type RestaurantOrderItem = Tables<"restaurant_order_items">;
export type GuestChargeBatch = Tables<"guest_charge_batches">;
export type AdminGuestCharge = GuestCharge & {
  order_items: RestaurantOrderItem[];
};

export const useAdminGuestCharges = () =>
  useQuery({
    queryKey: ["admin_guest_charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_charges")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const charges = (data ?? []) as GuestCharge[];
      const orderIds = [...new Set(charges.map((charge) => charge.source_order_id).filter(Boolean))] as string[];

      const { data: orderItems, error: itemsError } = orderIds.length
        ? await supabase
            .from("restaurant_order_items")
            .select("*")
            .in("order_id", orderIds)
            .order("created_at", { ascending: true })
        : { data: [], error: null };
      if (itemsError) throw itemsError;

      const orderItemMap = new Map<string, RestaurantOrderItem[]>();
      for (const item of ((orderItems ?? []) as RestaurantOrderItem[])) {
        const list = orderItemMap.get(item.order_id) ?? [];
        list.push(item);
        orderItemMap.set(item.order_id, list);
      }

      return charges.map((charge) => ({
        ...charge,
        order_items: charge.source_order_id ? (orderItemMap.get(charge.source_order_id) ?? []) : [],
      })) as AdminGuestCharge[];
    },
  });

export const useAdminChargeBatches = () =>
  useQuery({
    queryKey: ["admin_guest_charge_batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_charge_batches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GuestChargeBatch[];
    },
  });
