import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type RestaurantMenuItem = Tables<"restaurant_menu_items">;

export const useRestaurantMenu = () =>
  useQuery({
    queryKey: ["restaurant_menu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_menu_items")
        .select("*")
        .eq("is_active", true)
        .order("section", { ascending: true })
        .order("display_order", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RestaurantMenuItem[];
    },
  });

export const useAdminRestaurantMenu = () =>
  useQuery({
    queryKey: ["admin_restaurant_menu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_menu_items")
        .select("*")
        .order("section", { ascending: true })
        .order("display_order", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RestaurantMenuItem[];
    },
  });
