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

export type PodRoomAllocation = {
  pod: PricingPod | undefined;
  rooms: number;
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

export const allocationRoomTotal = (allocations: PodRoomAllocation[]) =>
  allocations.reduce((sum, allocation) => sum + allocation.rooms, 0);

export const allocationSurchargeSubtotal = (allocations: PodRoomAllocation[], nights: number) =>
  allocations.reduce((sum, allocation) => sum + podRoomSurcharge(allocation.pod) * allocation.rooms * nights, 0);

export const calcAddonLineTotal = (
  addon: Pick<Addon, "price_kes" | "pricing_unit">,
  nights: number,
  rooms: number,
  billableGuests: number,
) => {
  switch (addon.pricing_unit as AddonPricingUnit) {
    case "per_night":
      return addon.price_kes * nights * rooms;
    case "per_night_per_adult":
      return addon.price_kes * nights * billableGuests;
    case "one_time":
    default:
      return addon.price_kes;
  }
};

export const calcPromoDiscount = (subtotalKes: number, promo: AppliedPromoCode | null, nights: number) => {
  if (!promo || subtotalKes <= 0 || nights <= 1) return 0;
  if (promo.discount_type === "percentage") {
    return Math.min(subtotalKes, Math.round(subtotalKes * ((promo.percent_off ?? 0) / 100)));
  }
  return Math.min(subtotalKes, promo.amount_kes);
};

export const calculateBookingPricing = ({
  pod,
  nights,
  adults,
  childrenUnder12,
  children12Plus,
  rooms,
  selectedAddons,
  promo,
}: {
  pod: PricingPod | undefined;
  nights: number;
  adults: number;
  childrenUnder12: number;
  children12Plus: number;
  rooms: number;
  selectedAddons: Array<Pick<Addon, "price_kes" | "pricing_unit">>;
  promo: AppliedPromoCode | null;
}) => {
  const nightlyRate = effectiveNightlyRate(pod, nights);
  const roomSurcharge = podRoomSurcharge(pod);
  const adultsSubtotal = nightlyRate * adults * nights;
  const children12PlusSubtotal = nightlyRate * children12Plus * nights;
  const childrenUnder12Subtotal = nightlyRate * 0.5 * childrenUnder12 * nights;
  const surchargeSubtotal = roomSurcharge * rooms * nights;
  const billableGuests = adults + children12Plus;
  const addonsSubtotal = selectedAddons.reduce(
    (sum, addon) => sum + calcAddonLineTotal(addon, nights, rooms, billableGuests),
    0,
  );
  const subtotalKes = adultsSubtotal + children12PlusSubtotal + childrenUnder12Subtotal + surchargeSubtotal + addonsSubtotal;
  const discountKes = calcPromoDiscount(subtotalKes, promo, nights);

  return {
    nightlyRate,
    roomSurcharge,
    billableGuests,
    adultsSubtotal,
    children12PlusSubtotal,
    childrenUnder12Subtotal,
    surchargeSubtotal,
    addonsSubtotal,
    subtotalKes,
    discountKes,
    totalKes: Math.max(0, subtotalKes - discountKes),
  };
};

export const calculateBookingPricingForAllocations = ({
  allocations,
  nights,
  adults,
  childrenUnder12,
  children12Plus,
  selectedAddons,
  promo,
}: {
  allocations: PodRoomAllocation[];
  nights: number;
  adults: number;
  childrenUnder12: number;
  children12Plus: number;
  selectedAddons: Array<Pick<Addon, "price_kes" | "pricing_unit">>;
  promo: AppliedPromoCode | null;
}) => {
  const primaryPod = allocations.find((allocation) => allocation.rooms > 0)?.pod;
  const nightlyRate = effectiveNightlyRate(primaryPod, nights);
  const roomSurcharge = allocationSurchargeSubtotal(allocations, nights);
  const rooms = allocationRoomTotal(allocations);
  const adultsSubtotal = nightlyRate * adults * nights;
  const children12PlusSubtotal = nightlyRate * children12Plus * nights;
  const childrenUnder12Subtotal = nightlyRate * 0.5 * childrenUnder12 * nights;
  const billableGuests = adults + children12Plus;
  const addonsSubtotal = selectedAddons.reduce(
    (sum, addon) => sum + calcAddonLineTotal(addon, nights, rooms, billableGuests),
    0,
  );
  const subtotalKes = adultsSubtotal + children12PlusSubtotal + childrenUnder12Subtotal + roomSurcharge + addonsSubtotal;
  const discountKes = calcPromoDiscount(subtotalKes, promo, nights);

  return {
    nightlyRate,
    roomSurcharge,
    rooms,
    billableGuests,
    adultsSubtotal,
    children12PlusSubtotal,
    childrenUnder12Subtotal,
    surchargeSubtotal: roomSurcharge,
    addonsSubtotal,
    subtotalKes,
    discountKes,
    totalKes: Math.max(0, subtotalKes - discountKes),
  };
};
