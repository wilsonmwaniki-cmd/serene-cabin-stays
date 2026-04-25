import type { Addon, AddonPricingUnit } from "@/hooks/useAddons";

export type PromoCodeKind = "discount" | "affiliate";
export type PromoDiscountType = "fixed" | "percentage";

export type PricingPod = {
  id: string;
  slug: string;
  name: string;
  price_kes: number;
  surcharge_kes?: number;
};

export type AppliedPromoCode = {
  id: string;
  code: string;
  label: string;
  kind: PromoCodeKind;
  discount_type: PromoDiscountType;
  amount_kes: number;
  percent_off: number | null;
};

export const SINGLE_NIGHT_RATE_KES = 5000;
export const MULTI_NIGHT_RATE_KES = 4250;
export const SINGLE_NIGHT_EXCLUDED_ADDONS = new Set(["full-meals"]);

export const effectiveNightlyRate = (pod: PricingPod | undefined, nights: number) => {
  if (!pod) return 0;
  if (pod.slug?.startsWith("glamping-pod")) {
    return nights === 1 ? SINGLE_NIGHT_RATE_KES : MULTI_NIGHT_RATE_KES;
  }
  return pod.price_kes;
};

export const podRoomSurcharge = (pod: PricingPod | undefined) => pod?.surcharge_kes ?? 0;

export const calcAddonLineTotal = (
  addon: Pick<Addon, "price_kes" | "pricing_unit">,
  nights: number,
  rooms: number,
  adults: number,
) => {
  switch (addon.pricing_unit as AddonPricingUnit) {
    case "per_night":
      return addon.price_kes * nights * rooms;
    case "per_night_per_adult":
      return addon.price_kes * nights * adults;
    case "one_time":
    default:
      return addon.price_kes;
  }
};

export const calcPromoDiscount = (subtotalKes: number, promo: AppliedPromoCode | null) => {
  if (!promo || subtotalKes <= 0) return 0;
  if (promo.discount_type === "percentage") {
    return Math.min(subtotalKes, Math.round(subtotalKes * ((promo.percent_off ?? 0) / 100)));
  }
  return Math.min(subtotalKes, promo.amount_kes);
};

export const calculateBookingPricing = ({
  pod,
  nights,
  adults,
  children,
  rooms,
  selectedAddons,
  promo,
}: {
  pod: PricingPod | undefined;
  nights: number;
  adults: number;
  children: number;
  rooms: number;
  selectedAddons: Array<Pick<Addon, "price_kes" | "pricing_unit">>;
  promo: AppliedPromoCode | null;
}) => {
  const nightlyRate = effectiveNightlyRate(pod, nights);
  const roomSurcharge = podRoomSurcharge(pod);
  const adultsSubtotal = nightlyRate * adults * nights;
  const childrenSubtotal = nightlyRate * 0.5 * children * nights;
  const surchargeSubtotal = roomSurcharge * rooms * nights;
  const addonsSubtotal = selectedAddons.reduce(
    (sum, addon) => sum + calcAddonLineTotal(addon, nights, rooms, adults),
    0,
  );
  const subtotalKes = adultsSubtotal + childrenSubtotal + surchargeSubtotal + addonsSubtotal;
  const discountKes = calcPromoDiscount(subtotalKes, promo);

  return {
    nightlyRate,
    roomSurcharge,
    adultsSubtotal,
    childrenSubtotal,
    surchargeSubtotal,
    addonsSubtotal,
    subtotalKes,
    discountKes,
    totalKes: Math.max(0, subtotalKes - discountKes),
  };
};
