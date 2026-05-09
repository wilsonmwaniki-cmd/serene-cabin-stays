import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { format, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { sendEmail } from "@/lib/send-email";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { useAddons, pricingUnitLabel } from "@/hooks/useAddons";
import { format as fmtDate } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type AppliedPromoCode,
  calculateBookingPricing,
  calculateBookingPricingForAllocations,
  calcAddonLineTotal,
  podRoomSurcharge,
} from "@/lib/booking-pricing";

interface Pod {
  id: string;
  slug: string;
  name: string;
  price_kes: number;
  surcharge_kes?: number;
  capacity: number;
}

type PodAvailabilityMap = Record<string, { available: number; total: number }>;

const normalizeName = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part
            .split("'")
            .map((piece) => piece ? `${piece.charAt(0).toUpperCase()}${piece.slice(1).toLowerCase()}` : piece)
            .join("'")
        )
        .join("-")
    )
    .join(" ");

const schema = z.object({
  guest_name: z
    .string()
    .trim()
    .min(5, "Please enter first and last name")
    .max(120)
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, "Please enter first and last name"),
  guest_email: z.string().trim().email("Please enter a valid email you can access").max(255),
  guest_phone: z
    .string()
    .trim()
    .min(10, "Phone number is required")
    .max(20, "Please enter a valid phone number")
    .regex(/^\+?[0-9\s()-]{10,20}$/, "Please enter a valid phone number"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

interface Props {
  pods: Pod[];
  defaultPodId?: string;
}

const WAIVER_BULLETS = [
  "Slipping, falling or injury in and around construction sites, or general terrain, which may be slippery, wet or contain other hazards present.",
  "Scratches or other injuries caused by stalls or enclosures, grooming tools and other equine equipment.",
  "Allergic reactions to animals, plants, hay or other allergens.",
  "Tripping over holes, materials or equipment.",
  "Being attacked, bitten or poisoned by free animals found at Wild by Lera.",
];

const WAIVER_TERMS = [
  "I hereby specifically waive and forever release Wild by Lera and its directors and agents from any liability for injuries arising from the inherent risks of walking, riding, working or participating in the environment and/or with horses, as well as the active negligence of Wild by Lera, its directors and agents.",
  "By signing this agreement, I hereby acknowledge that, although there may be supervision during my time at Wild by Lera, there will not be a nurse on the premises and neither Wild by Lera nor its directors and agents assume any responsibility for my health or medical care.",
  "I agree to indemnify, save and hold harmless Wild by Lera and its directors and agents from and against any loss, liability, damage, attorneys' fees or costs they may incur arising out of or in any way related to my presence or participation at the venue or any act or omission of Wild by Lera and its directors and agents.",
  "By signing this agreement, I hereby acknowledge my full understanding, agreement and consent to my presence and/or participation in the activities at Wild by Lera, its directors and agents and with full knowledge and understanding of the disclosures, exemptions and releases contained herein.",
  "If I am present and participate in activities or events at Wild by Lera, I do so at my own risk and hereby acknowledge and agree that Wild by Lera and/or any of its directors and agents shall not assume any liability or risk associated with injuries that may arise from my presence or participation there.",
  "Tourists understand that, unless otherwise agreed in writing by Wild by Lera, Wild by Lera does not carry or maintain medical, health or disability insurance for any tourist. It is expected and suggested that each tourist obtains his or her own medical insurance.",
  "The tourist grants and assigns to Wild by Lera all right, title and interest in all photographs and audio and video taken during the stay at Wild by Lera, including any royalties, profits or other benefits derived from such images. The tourist understands and agrees that no compensation is due in connection with the foregoing.",
];

const MAX_STAY_NIGHTS = 30;

export const InquiryForm = ({ pods, defaultPodId }: Props) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxBookingDate = new Date(today);
  maxBookingDate.setDate(maxBookingDate.getDate() + 365);
  const maxCheckInDate = new Date(today);
  maxCheckInDate.setDate(maxCheckInDate.getDate() + 363);
  const minCheckIn = format(today, "yyyy-MM-dd");
  const maxCheckIn = format(maxCheckInDate, "yyyy-MM-dd");
  const maxCheckOut = format(maxBookingDate, "yyyy-MM-dd");
  const supportsMixedPods = !defaultPodId && pods.length > 1;
  const initialRoomSelections = Object.fromEntries(
    pods.map((pod, index) => [pod.id, defaultPodId ? (pod.id === defaultPodId ? 1 : 0) : (index === 0 ? 1 : 0)]),
  ) as Record<string, number>;

  const [params] = useSearchParams();
  const [podId, setPodId] = useState(defaultPodId ?? pods[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(params.get("in") ?? format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [checkOut, setCheckOut] = useState(params.get("out") ?? format(new Date(Date.now() + 3 * 86400000), "yyyy-MM-dd"));
  const minCheckOut = format(new Date(new Date(checkIn).getTime() + 2 * 86400000), "yyyy-MM-dd");
  const [adults, setAdults] = useState(Number(params.get("adults") ?? 2));
  const [childrenUnder12Count, setChildrenUnder12Count] = useState(Number(params.get("children") ?? 0));
  const [children12PlusCount, setChildren12PlusCount] = useState(Number(params.get("children12plus") ?? 0));
  const [rooms, setRooms] = useState(Number(params.get("rooms") ?? 1));
  const [podRoomSelections, setPodRoomSelections] = useState<Record<string, number>>(initialRoomSelections);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [availability, setAvailability] = useState<PodAvailabilityMap | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoCode | null>(null);
  const { data: addons = [] } = useAddons();
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const maxStayCheckOutDate = new Date(checkInDate);
  maxStayCheckOutDate.setDate(maxStayCheckOutDate.getDate() + MAX_STAY_NIGHTS);
  const effectiveMaxCheckOutDate = maxStayCheckOutDate > maxBookingDate ? maxBookingDate : maxStayCheckOutDate;
  const effectiveMaxCheckOut = format(effectiveMaxCheckOutDate, "yyyy-MM-dd");
  const totalGuests = adults + childrenUnder12Count + children12PlusCount;
  const minimumRooms = Math.max(1, Math.ceil(totalGuests / 2));
  const selectedPodAllocations = (supportsMixedPods
    ? pods
        .map((pod) => ({ pod_id: pod.id, rooms: Math.max(0, podRoomSelections[pod.id] ?? 0) }))
        .filter((allocation) => allocation.rooms > 0)
    : [{ pod_id: podId, rooms }]);
  const totalSelectedRooms = selectedPodAllocations.reduce((sum, allocation) => sum + allocation.rooms, 0);
  const selectedPodsLabel = selectedPodAllocations
    .map((allocation) => {
      const pod = pods.find((item) => item.id === allocation.pod_id);
      return `${pod?.name ?? "Pod"} × ${allocation.rooms}`;
    })
    .join(", ");
  const primaryPod = pods.find((p) => p.id === selectedPodAllocations[0]?.pod_id) ?? pods.find((p) => p.id === podId);
  const availabilityKey = selectedPodAllocations.map((allocation) => `${allocation.pod_id}:${allocation.rooms}`).join("|");

  useEffect(() => {
    const minimumStayEnd = format(new Date(new Date(checkIn).getTime() + 2 * 86400000), "yyyy-MM-dd");
    if (checkOut < minimumStayEnd) {
      setCheckOut(minimumStayEnd > maxCheckOut ? maxCheckOut : minimumStayEnd);
    } else if (checkOut > effectiveMaxCheckOut) {
      setCheckOut(effectiveMaxCheckOut);
    }
  }, [checkIn, checkOut, maxCheckOut, effectiveMaxCheckOut]);

  useEffect(() => {
    if (supportsMixedPods) return;
    if (rooms < minimumRooms) {
      setRooms(minimumRooms);
    }
  }, [rooms, minimumRooms, supportsMixedPods]);

  useEffect(() => {
    if (!supportsMixedPods) return;
    if (totalSelectedRooms >= minimumRooms) return;

    const shortage = minimumRooms - totalSelectedRooms;
    const preferredPodId = selectedPodAllocations[0]?.pod_id ?? pods[0]?.id;

    if (!preferredPodId) return;

    setPodRoomSelections((current) => ({
      ...current,
      [preferredPodId]: Math.max(0, current[preferredPodId] ?? 0) + shortage,
    }));
  }, [supportsMixedPods, totalSelectedRooms, minimumRooms, selectedPodAllocations, pods]);

  useEffect(() => {
    if (selectedPodAllocations.length === 0 || !checkIn || !checkOut) return;
    if (new Date(checkOut) <= new Date(checkIn)) return;
    let cancelled = false;

    const loadAvailability = async () => {
      setChecking(true);
      setAvailability(null);

      try {
        const results = await Promise.all(
          selectedPodAllocations.map(async (allocation) => {
            const { data, error } = await supabase.rpc("pod_availability", {
              _pod_id: allocation.pod_id,
              _check_in: checkIn,
              _check_out: checkOut,
            });
            return {
              pod_id: allocation.pod_id,
              result: !error && data && data.length > 0
                ? { available: data[0].units_available, total: data[0].units_total }
                : null,
            };
          }),
        );

        if (cancelled) return;

        const availabilityMap = Object.fromEntries(
          results
            .filter((result) => !!result.result)
            .map((result) => [result.pod_id, result.result as { available: number; total: number }]),
        );
        setAvailability(availabilityMap);
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [availabilityKey, checkIn, checkOut]);

  const nights = Math.max(0, differenceInCalendarDays(new Date(checkOut), new Date(checkIn)));
  const enoughUnits = selectedPodAllocations.length > 0
    && totalSelectedRooms >= minimumRooms
    && selectedPodAllocations.every((allocation) => {
      const podAvailability = availability?.[allocation.pod_id];
      return !!podAvailability && podAvailability.available >= allocation.rooms;
    });

  const visibleAddons = useMemo(() => addons, [addons]);

  const chosenAddons = useMemo(
    () => visibleAddons.filter((a) => selectedAddons[a.id]),
    [visibleAddons, selectedAddons],
  );

  const pricing = useMemo(
    () => {
      if (supportsMixedPods) {
        return calculateBookingPricingForAllocations({
          allocations: selectedPodAllocations.map((allocation) => ({
            pod: pods.find((pod) => pod.id === allocation.pod_id),
            rooms: allocation.rooms,
          })),
          nights,
          adults,
          childrenUnder12: childrenUnder12Count,
          children12Plus: children12PlusCount,
          selectedAddons: chosenAddons,
          promo: appliedPromo,
        });
      }

      return calculateBookingPricing({
        pod: primaryPod,
        nights,
        adults,
        childrenUnder12: childrenUnder12Count,
        children12Plus: children12PlusCount,
        rooms,
        selectedAddons: chosenAddons,
        promo: appliedPromo,
      });
    },
    [supportsMixedPods, selectedPodAllocations, primaryPod, nights, adults, childrenUnder12Count, children12PlusCount, rooms, chosenAddons, appliedPromo, pods],
  );

  const nightlyRate = pricing.nightlyRate;
  const roomSurcharge = pricing.roomSurcharge;
  const billableGuests = pricing.billableGuests;
  const adultsSubtotal = pricing.adultsSubtotal;
  const children12PlusSubtotal = pricing.children12PlusSubtotal;
  const childrenUnder12Subtotal = pricing.childrenUnder12Subtotal;
  const surchargeSubtotal = pricing.surchargeSubtotal;
  const addonsTotal = pricing.addonsSubtotal;
  const subtotalKes = pricing.subtotalKes;
  const discountKes = pricing.discountKes;
  const grandTotal = pricing.totalKes;
  const surchargeBreakdown = selectedPodAllocations
    .map((allocation) => {
      const pod = pods.find((item) => item.id === allocation.pod_id);
      const surcharge = podRoomSurcharge(pod);
      return {
        pod_name: pod?.name ?? "Pod",
        rooms: allocation.rooms,
        surcharge,
        total: surcharge * allocation.rooms * nights,
      };
    })
    .filter((line) => line.surcharge > 0);

  useEffect(() => {
    if (nights < 2 && appliedPromo) {
      setAppliedPromo(null);
    }
  }, [nights, appliedPromo]);

  const applyPromoCode = async () => {
    const normalizedCode = promoInput.trim().toUpperCase();
    if (!normalizedCode) {
      setAppliedPromo(null);
      toast({ title: "Code removed", description: "No code is currently applied." });
      return;
    }

    if (nights < 2) {
      setAppliedPromo(null);
      toast({
        title: "Code not available",
        description: "Codes only apply to stays of 2 nights or more.",
        variant: "destructive",
      });
      return;
    }

    setApplyingPromo(true);
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", normalizedCode)
      .maybeSingle();
    setApplyingPromo(false);

    if (error) {
      toast({ title: "Code check failed", description: error.message, variant: "destructive" });
      return;
    }

    const promo = data as Tables<"promo_codes"> | null;
    if (!promo || !promo.is_active) {
      setAppliedPromo(null);
      toast({ title: "Invalid code", description: "That code could not be used.", variant: "destructive" });
      return;
    }

    const now = new Date();
    if ((promo.starts_at && new Date(promo.starts_at) > now) || (promo.ends_at && new Date(promo.ends_at) < now)) {
      setAppliedPromo(null);
      toast({ title: "Code unavailable", description: "That code is not active right now.", variant: "destructive" });
      return;
    }

    setPromoInput(promo.code);
    setAppliedPromo({
      id: promo.id,
      code: promo.code,
      label: promo.label,
      kind: promo.kind,
      discount_type: promo.discount_type,
      amount_kes: promo.amount_kes,
      percent_off: promo.percent_off,
    });
    toast({
      title: `${promo.kind === "affiliate" ? "Affiliate" : "Discount"} code applied`,
      description: promo.label,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeName(name);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const parsed = schema.safeParse({ guest_name: normalizedName, guest_email: normalizedEmail, guest_phone: normalizedPhone, notes });
    if (!parsed.success) {
      toast({ title: "Please review the form", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!waiverAccepted) {
      toast({ title: "Waiver required", description: "Please read and accept the waiver before booking.", variant: "destructive" });
      return;
    }
    setName(normalizedName);
    setEmail(normalizedEmail);
    setPhone(normalizedPhone);
    if (checkIn < minCheckIn || checkIn > maxCheckIn) {
      toast({
        title: "Check-in date not allowed",
        description: "Bookings can be made from today up to 1 year in advance.",
        variant: "destructive",
      });
      return;
    }
    if (checkOut < minCheckOut || checkOut > effectiveMaxCheckOut) {
      toast({
        title: "Check-out date not allowed",
        description: "Please choose a check-out date between 2 and 30 nights after check-in.",
        variant: "destructive",
      });
      return;
    }
    if (nights > MAX_STAY_NIGHTS) {
      toast({
        title: "Stay length not allowed",
        description: "Guests can stay for up to 30 nights in one booking.",
        variant: "destructive",
      });
      return;
    }
    if (selectedPodAllocations.length === 0) {
      toast({
        title: "Choose your cabins",
        description: "Please select at least one room before booking.",
        variant: "destructive",
      });
      return;
    }
    if (totalSelectedRooms < minimumRooms) {
      toast({
        title: "More rooms needed",
        description: `Each cabin holds up to 2 guests, so ${totalGuests} guests need at least ${minimumRooms} room${minimumRooms === 1 ? "" : "s"}.`,
        variant: "destructive",
      });
      return;
    }
    if (!enoughUnits) {
      toast({ title: "Not enough availability", description: "Please choose different dates or fewer rooms.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const bookingId = crypto.randomUUID();
    const { error } = await supabase
      .from("bookings")
      .insert({
        id: bookingId,
        pod_id: selectedPodAllocations[0].pod_id,
        guest_name: normalizedName,
        guest_email: normalizedEmail,
        guest_phone: normalizedPhone,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children: childrenUnder12Count,
        children_12_plus: children12PlusCount,
        rooms: totalSelectedRooms,
        pod_allocations: selectedPodAllocations,
        notes: notes.trim() || null,
        subtotal_kes: subtotalKes,
        discount_kes: discountKes,
        total_kes: grandTotal,
        promo_code_id: appliedPromo?.id ?? null,
        promo_code_text: appliedPromo?.code ?? null,
        promo_code_kind: appliedPromo?.kind ?? null,
      });
    if (error) {
      setSubmitting(false);
      const description =
        error?.message?.includes("room(s) left for those dates")
          ? error.message
          : error?.message ?? "Please try again.";
      toast({ title: "Could not submit", description, variant: "destructive" });
      return;
    }

    if (chosenAddons.length > 0) {
      const { error: addonErr } = await supabase.from("booking_addons").insert(
        chosenAddons.map((a) => ({
          booking_id: bookingId,
          addon_id: a.id,
          quantity: 1,
          unit_price_kes: a.price_kes,
          pricing_unit: a.pricing_unit,
        })),
      );
      if (addonErr) {
        // Inquiry is recorded; just warn.
        console.warn("Failed to attach add-ons:", addonErr.message);
      }
    }

    setSubmitting(false);
    setDone(true);
    toast({ title: "Inquiry received", description: "We'll be in touch within a few hours." });

    // Guest confirmation + admin alert (fire-and-forget)
    const fmt = (d: string) => {
      try { return fmtDate(new Date(d), "MMM d, yyyy"); } catch { return d; }
    };
    const emailData = {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      podName: selectedPodsLabel,
      checkIn: fmt(checkIn),
      checkOut: fmt(checkOut),
      adults,
      children: childrenUnder12Count,
      childrenUnder12: childrenUnder12Count,
      children12Plus: children12PlusCount,
      rooms: totalSelectedRooms,
      notes: notes.trim() || undefined,
      subtotalKes,
      discountKes,
      totalKes: grandTotal,
      promoCode: appliedPromo?.code ?? undefined,
    };
    sendEmail({
      templateName: "booking-inquiry-received",
      recipientEmail: emailData.email,
      idempotencyKey: `inquiry-received-${bookingId}`,
      templateData: emailData,
    }).catch(() => {});
    sendEmail({
      templateName: "booking-inquiry-admin-alert",
      idempotencyKey: `inquiry-admin-${bookingId}`,
      templateData: emailData,
    }).catch(() => {});
  };

  if (done) {
    return (
      <div className="text-center py-12 px-6 bg-bone border border-border">
        <div className="mx-auto w-12 h-12 rounded-full bg-sage-deep text-bone flex items-center justify-center mb-4">
          <Check size={22} />
        </div>
        <h3 className="font-display text-3xl text-sage-deep mb-2">Thank you</h3>
        <p className="text-muted-foreground max-w-md mx-auto">Your inquiry has reached us. We will confirm your stay personally within a few hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {supportsMixedPods ? (
          <>
            <Field label="Cabins">
              <div className="space-y-3">
                {pods.map((pod) => (
                  <div key={pod.id} className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-display text-base">{pod.name}</div>
                      <div className="text-xs text-muted-foreground">KES {(pod.price_kes + (pod.surcharge_kes ?? 0)).toLocaleString()}/night</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={podRoomSelections[pod.id] ?? 0}
                      onChange={(event) =>
                        setPodRoomSelections((current) => ({
                          ...current,
                          [pod.id]: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      className="w-24 bg-transparent text-right font-display text-lg outline-none"
                    />
                  </div>
                ))}
              </div>
            </Field>
            <Field label="Rooms Selected">
              <div className="font-display text-lg">{totalSelectedRooms}</div>
            </Field>
          </>
        ) : (
          <>
            <Field label="Pod">
              <select value={podId} onChange={(e) => setPodId(e.target.value)} className="w-full bg-transparent font-display text-lg outline-none">
                {pods.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — KES {(p.price_kes + (p.surcharge_kes ?? 0)).toLocaleString()}/night</option>
                ))}
              </select>
            </Field>
            <Field label="Rooms">
              <input type="number" min={minimumRooms} max={10} value={rooms} onChange={(e) => setRooms(Math.max(minimumRooms, Number(e.target.value) || minimumRooms))} className="w-full bg-transparent font-display text-lg outline-none" />
            </Field>
          </>
        )}
        <Field label="Check In">
          <Popover>
            <PopoverTrigger className="flex w-full items-center justify-between gap-3 bg-transparent font-display text-lg outline-none text-left">
              <span>{format(checkInDate, "dd/MM/yyyy")}</span>
              <CalendarIcon size={16} className="text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="p-0 w-auto">
              <Calendar
                mode="single"
                selected={checkInDate}
                onSelect={(date) => date && setCheckIn(format(date, "yyyy-MM-dd"))}
                disabled={(date) => date < today || format(date, "yyyy-MM-dd") > maxCheckIn}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="Check Out">
          <Popover>
            <PopoverTrigger className="flex w-full items-center justify-between gap-3 bg-transparent font-display text-lg outline-none text-left">
              <span>{format(checkOutDate, "dd/MM/yyyy")}</span>
              <CalendarIcon size={16} className="text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="p-0 w-auto">
              <Calendar
                mode="single"
                selected={checkOutDate}
                onSelect={(date) => date && setCheckOut(format(date, "yyyy-MM-dd"))}
                disabled={(date) => format(date, "yyyy-MM-dd") < minCheckOut || format(date, "yyyy-MM-dd") > effectiveMaxCheckOut}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="Adults">
          <input type="number" min={1} max={10} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full bg-transparent font-display text-lg outline-none" />
        </Field>
        <Field label="Children Under 12">
          <input type="number" min={0} max={10} value={childrenUnder12Count} onChange={(e) => setChildrenUnder12Count(Number(e.target.value))} className="w-full bg-transparent font-display text-lg outline-none" />
        </Field>
        <Field label="Guests 12+">
          <input type="number" min={0} max={10} value={children12PlusCount} onChange={(e) => setChildren12PlusCount(Number(e.target.value))} className="w-full bg-transparent font-display text-lg outline-none" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Pricing note: children under 12 are half price. Guests aged 12 and above are charged at the full rate.
      </p>
      <p className="text-xs text-muted-foreground">
        Booking note: each cabin holds a maximum of 2 guests. {totalGuests} guest{totalGuests === 1 ? "" : "s"} currently require {minimumRooms} room{minimumRooms === 1 ? "" : "s"}.
      </p>
      {supportsMixedPods && (
        <p className="text-xs text-muted-foreground">You can mix Pod 1 and Pod 2 in one booking by splitting your rooms across the cabins above.</p>
      )}
      <p className="text-xs text-muted-foreground">Minimum stay: 2 nights.</p>
      <p className="text-xs text-muted-foreground">Maximum stay: 30 nights.</p>

      <div className="border-l-2 border-ember pl-4 py-2 bg-linen/40 text-sm flex items-center gap-2 min-h-[44px]">
        {checking ? (
          <><Loader2 className="animate-spin" size={16} /> Checking availability…</>
        ) : selectedPodAllocations.length > 0 ? (
          enoughUnits ? (
            <div className="space-y-1">
              {selectedPodAllocations.map((allocation) => {
                const pod = pods.find((item) => item.id === allocation.pod_id);
                const podAvailability = availability?.[allocation.pod_id];
                return (
                  <div key={allocation.pod_id} className="flex items-center gap-2">
                    <Check size={16} className="text-sage-deep" />
                    <span>{pod?.name ?? "Pod"}: {podAvailability?.available ?? 0} of {podAvailability?.total ?? 0} units available</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {selectedPodAllocations.map((allocation) => {
                const pod = pods.find((item) => item.id === allocation.pod_id);
                const podAvailability = availability?.[allocation.pod_id];
                const shortBy = allocation.rooms - (podAvailability?.available ?? 0);
                return (
                  <div key={allocation.pod_id} className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-destructive" />
                    <span>
                      {pod?.name ?? "Pod"}: only {podAvailability?.available ?? 0} unit{(podAvailability?.available ?? 0) === 1 ? "" : "s"} available
                      {shortBy > 0 ? `, short by ${shortBy}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <span className="text-muted-foreground">Choose your dates to see availability.</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">You can book from today up to 12 months in advance, for stays up to 30 nights.</p>

      {/* Add-ons */}
      {visibleAddons.length > 0 && (
        <div className="border border-border bg-bone">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="font-display text-lg text-sage-deep">Extra Services</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Optional add-ons to enhance your stay.</p>
          </div>
          <ul className="divide-y divide-border">
            {visibleAddons.map((a) => {
              const checked = !!selectedAddons[a.id];
              const lineTotal = calcAddonLineTotal(a, Math.max(nights, 1), totalSelectedRooms, billableGuests);
              return (
                <li key={a.id}>
                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-linen/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setSelectedAddons((s) => ({ ...s, [a.id]: e.target.checked }))}
                      className="w-4 h-4 accent-sage-deep"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground">{a.name}</div>
                      {a.description && (
                        <div className="text-xs text-muted-foreground">{a.description}</div>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-foreground">KES {a.price_kes.toLocaleString()} <span className="text-muted-foreground text-xs">{pricingUnitLabel(a.pricing_unit)}</span></div>
                      {checked && nights > 0 && (
                        <div className="text-xs text-ember">+ KES {lineTotal.toLocaleString()}</div>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Cost summary */}
      <div className="border border-border bg-linen/40 px-4 py-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Adults ({adults} × {nights} night{nights !== 1 && "s"} @ KES {nightlyRate.toLocaleString()})
          </span>
          <span>KES {adultsSubtotal.toLocaleString()}</span>
        </div>
        {children12PlusCount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Guests 12+ ({children12PlusCount} × {nights} night{nights !== 1 && "s"} @ KES {nightlyRate.toLocaleString()} — full price)
            </span>
            <span>KES {children12PlusSubtotal.toLocaleString()}</span>
          </div>
        )}
        {childrenUnder12Count > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Children under 12 ({childrenUnder12Count} × {nights} night{nights !== 1 && "s"} @ KES {(nightlyRate * 0.5).toLocaleString()} — half price)
            </span>
            <span>KES {childrenUnder12Subtotal.toLocaleString()}</span>
          </div>
        )}
        {surchargeSubtotal > 0 && surchargeBreakdown.map((line) => (
          <div key={line.pod_name} className="flex justify-between">
            <span className="text-muted-foreground">
              {line.pod_name} surcharge ({line.rooms} room{line.rooms !== 1 && "s"} × {nights} night{nights !== 1 && "s"} @ KES {line.surcharge.toLocaleString()})
            </span>
            <span>KES {line.total.toLocaleString()}</span>
          </div>
        ))}
        {addonsTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Add-ons</span>
            <span>KES {addonsTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t border-border pt-3 mt-3 space-y-3">
          <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Discount or Affiliate Code
              </label>
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                className="w-full bg-bone border border-border px-3 py-2 text-sm outline-none"
                placeholder="Enter code"
              />
              <p className="mt-1 text-xs text-muted-foreground">Codes work on stays of 2 nights or more.</p>
            </div>
            <button
              type="button"
              onClick={applyPromoCode}
              disabled={applyingPromo || nights < 2}
              className="h-10 px-4 bg-sage-deep hover:bg-sage text-bone text-sm transition-colors disabled:opacity-50"
            >
              {applyingPromo ? "Checking…" : "Apply"}
            </button>
          </div>
          {appliedPromo && (
            <div className="text-xs text-sage-deep">
              {appliedPromo.label} · {appliedPromo.kind === "affiliate" ? "Affiliate code" : "Discount code"}
            </div>
          )}
        </div>
        {discountKes > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {appliedPromo?.kind === "affiliate" ? "Affiliate code" : "Discount"}
              {appliedPromo?.code ? ` (${appliedPromo.code})` : ""}
            </span>
            <span>-KES {discountKes.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-display text-lg pt-2 border-t border-border">
          <span className="text-sage-deep">Total</span>
          <span className="text-sage-deep">KES {grandTotal.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Your Name">
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setName((current) => normalizeName(current))} className="w-full bg-transparent text-base outline-none" placeholder="First and last name" required />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="you@example.com" required />
        </Field>
        <Field label="Phone">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="+254..." required />
        </Field>
        <Field label="Notes (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="Anniversary, dietary, arrival time…" />
        </Field>
      </div>

      <div className="border border-border bg-bone px-4 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <input
            id="booking-waiver"
            type="checkbox"
            checked={waiverAccepted}
            onChange={(e) => setWaiverAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 accent-sage-deep"
          />
          <label htmlFor="booking-waiver" className="text-sm text-foreground/85 leading-relaxed">
            By clicking <span className="font-medium">Request to Book</span>, I acknowledge that I have read and accepted the Wild by Lera waiver.
          </label>
        </div>
        <WaiverDialog />
      </div>

      <button
        type="submit"
        disabled={submitting || !enoughUnits || nights < 2 || nights > MAX_STAY_NIGHTS || !waiverAccepted}
        className="w-full bg-sage-deep hover:bg-sage text-bone py-4 text-sm uppercase tracking-[0.2em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Sending…" : "Request to Book"}
      </button>
      <p className="text-xs text-muted-foreground text-center">Check-in 3pm · Check-out 2pm · Minimum check-in age 18</p>
    </form>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block bg-bone border border-border px-4 py-3">
    <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);

const WaiverDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="text-sm text-sage-deep underline underline-offset-4 hover:text-ember text-left">
        Read the full waiver
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-sage-deep">Wild by Lera Waiver</DialogTitle>
        <DialogDescription>
          Please read this carefully before submitting your booking request.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm leading-7 text-foreground/85">
        <p>
          I hereby declare and acknowledge, in consideration of my ability and permission to access or visit Wild by Lera,
          owned by Wild by Lera, located in Elementaita, Kenya.
        </p>
        <p className="font-medium text-sage-deep">
          By signing this declaration you waive certain legal rights, including the right to recover damages in the event of
          injury, death or property damage arising from visits, tours and/or participation in activities or events on the premises.
        </p>
        <p className="font-medium">Please read this statement carefully before signing. Your signature indicates your understanding and acceptance of its terms.</p>
        <p>
          By signing this form, I acknowledge on my own behalf that I have familiarized myself with the activities in which
          I will be permitted to participate and that I will participate in these activities without restriction or limitation.
        </p>
        <p>
          I understand that Wild by Lera has a construction site and that I am not allowed to enter any area indicated as a construction site.
        </p>
        <p>
          I recognize the inherent risks involved in being at Wild by Lera, including wild animals, snakes, spiders, ants,
          wasps, hiking and outdoor activities, including among others:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          {WAIVER_BULLETS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ul className="list-disc pl-5 space-y-2">
          {WAIVER_TERMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          The tourist expressly agrees that this document is intended to be enforced and used as permitted by the laws of Kenya
          and shall be governed by and construed in accordance with the laws of Kenya.
        </p>
        <p>
          The tourist agrees that, if any term or provision of this waiver is held to be invalid by a court of competent jurisdiction,
          the remaining provisions shall continue to remain enforceable.
        </p>
        <p>
          By signing below, tourists and, if applicable, parents or guardians, acknowledge that they have read this waiver and understand all its terms.
          The tourist and, if applicable, the parent or guardian, acknowledge that this waiver is signed and accepted voluntarily and with full knowledge of its legal significance.
        </p>
      </div>
    </DialogContent>
  </Dialog>
);
