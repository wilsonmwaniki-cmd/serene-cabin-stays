import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AddonPricingUnit = "per_night" | "per_night_per_adult" | "one_time";

export type Addon = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_kes: number;
  pricing_unit: AddonPricingUnit;
  display_order: number;
};

export const useAddons = () =>
  useQuery({
    queryKey: ["addons"],
    queryFn: async (): Promise<Addon[]> => {
      const { data, error } = await supabase
        .from("addons")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Addon[];
    },
  });

export const calcAddonTotal = (
  addon: Addon,
  nights: number,
  rooms: number,
  adults: number,
) => {
  switch (addon.pricing_unit) {
    case "per_night":
      return addon.price_kes * nights * rooms;
    case "per_night_per_adult":
      return addon.price_kes * nights * adults;
    case "one_time":
    default:
      return addon.price_kes;
  }
};

export const pricingUnitLabel = (u: AddonPricingUnit) => {
  switch (u) {
    case "per_night":
      return "/ night";
    case "per_night_per_adult":
      return "/ night / adult";
    case "one_time":
      return "one-time";
  }
};
