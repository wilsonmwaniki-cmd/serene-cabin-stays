import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { format, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { useAddons, calcAddonTotal, pricingUnitLabel } from "@/hooks/useAddons";

interface Pod {
  id: string;
  slug: string;
  name: string;
  price_kes: number;
  capacity: number;
}

// Pricing rule: 1-night stays are charged at a higher B&B rate; 2+ nights get a discounted rate.
const SINGLE_NIGHT_RATE_KES = 5000;
const MULTI_NIGHT_RATE_KES = 4250;
// Add-ons not offered for single-night stays.
const SINGLE_NIGHT_EXCLUDED_ADDONS = new Set(["full-meals"]);

const effectiveNightlyRate = (pod: Pod | undefined, nights: number) => {
  if (!pod) return 0;
  // Apply tiered B&B pricing to the glamping pods.
  if (pod.slug?.startsWith("glamping-pod")) {
    return nights === 1 ? SINGLE_NIGHT_RATE_KES : MULTI_NIGHT_RATE_KES;
  }
  return pod.price_kes;
};

const schema = z.object({
  guest_name: z.string().trim().min(2, "Please share your name").max(120),
  guest_email: z.string().trim().email("Please enter a valid email").max(255),
  guest_phone: z.string().trim().min(5).max(40).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

interface Props {
  pods: Pod[];
  defaultPodId?: string;
}

export const InquiryForm = ({ pods, defaultPodId }: Props) => {
  const [params] = useSearchParams();
  const [podId, setPodId] = useState(defaultPodId ?? pods[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(params.get("in") ?? format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [checkOut, setCheckOut] = useState(params.get("out") ?? format(new Date(Date.now() + 2 * 86400000), "yyyy-MM-dd"));
  const [adults, setAdults] = useState(Number(params.get("adults") ?? 2));
  const [childrenCount, setChildrenCount] = useState(Number(params.get("children") ?? 0));
  const [rooms, setRooms] = useState(Number(params.get("rooms") ?? 1));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [availability, setAvailability] = useState<{ available: number; total: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const { data: addons = [] } = useAddons();

  useEffect(() => {
    if (!podId || !checkIn || !checkOut) return;
    if (new Date(checkOut) <= new Date(checkIn)) return;
    setChecking(true);
    setAvailability(null);
    supabase
      .rpc("pod_availability", { _pod_id: podId, _check_in: checkIn, _check_out: checkOut })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setAvailability({ available: data[0].units_available, total: data[0].units_total });
        }
        setChecking(false);
      });
  }, [podId, checkIn, checkOut]);

  const pod = pods.find((p) => p.id === podId);
  const nights = Math.max(0, differenceInCalendarDays(new Date(checkOut), new Date(checkIn)));
  const nightlyRate = effectiveNightlyRate(pod, nights);
  // Per-person pricing: adults at full rate, children (≤12 years) at half rate.
  const adultsSubtotal = nightlyRate * adults * nights;
  const childrenSubtotal = nightlyRate * 0.5 * childrenCount * nights;
  const baseSubtotal = adultsSubtotal + childrenSubtotal;
  const enoughUnits = availability ? availability.available >= rooms : false;

  const visibleAddons = useMemo(
    () => addons.filter((a) => !(nights === 1 && SINGLE_NIGHT_EXCLUDED_ADDONS.has(a.slug))),
    [addons, nights],
  );

  const addonsTotal = useMemo(
    () =>
      visibleAddons
        .filter((a) => selectedAddons[a.id])
        .reduce((sum, a) => sum + calcAddonTotal(a, nights, rooms, adults), 0),
    [visibleAddons, selectedAddons, nights, rooms, adults],
  );
  const grandTotal = baseSubtotal + addonsTotal;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ guest_name: name, guest_email: email, guest_phone: phone, notes });
    if (!parsed.success) {
      toast({ title: "Please review the form", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!pod) return;
    if (!enoughUnits) {
      toast({ title: "Not enough availability", description: "Please choose different dates or fewer rooms.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: bookingRow, error } = await supabase
      .from("bookings")
      .insert({
        pod_id: pod.id,
        guest_name: name.trim(),
        guest_email: email.trim(),
        guest_phone: phone.trim() || null,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children: childrenCount,
        rooms,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    if (error || !bookingRow) {
      setSubmitting(false);
      toast({ title: "Could not submit", description: error?.message ?? "Please try again.", variant: "destructive" });
      return;
    }

    const chosen = visibleAddons.filter((a) => selectedAddons[a.id]);
    if (chosen.length > 0) {
      const { error: addonErr } = await supabase.from("booking_addons").insert(
        chosen.map((a) => ({
          booking_id: bookingRow.id,
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
        <Field label="Pod">
          <select value={podId} onChange={(e) => setPodId(e.target.value)} className="w-full bg-transparent font-display text-lg outline-none">
            {pods.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — KES {p.price_kes.toLocaleString()}/night</option>
            ))}
          </select>
        </Field>
        <Field label="Rooms">
          <input type="number" min={1} max={5} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="w-full bg-transparent font-display text-lg outline-none" />
        </Field>
        <Field label="Check In (dd/mm/yyyy)">
          <input
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            value={checkIn ? format(new Date(checkIn), "dd/MM/yyyy") : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
              if (m) setCheckIn(`${m[3]}-${m[2]}-${m[1]}`);
            }}
            className="w-full bg-transparent font-display text-lg outline-none"
          />
        </Field>
        <Field label="Check Out (dd/mm/yyyy)">
          <input
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            value={checkOut ? format(new Date(checkOut), "dd/MM/yyyy") : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
              if (m) setCheckOut(`${m[3]}-${m[2]}-${m[1]}`);
            }}
            className="w-full bg-transparent font-display text-lg outline-none"
          />
        </Field>
        <Field label="Adults">
          <input type="number" min={1} max={10} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full bg-transparent font-display text-lg outline-none" />
        </Field>
        <Field label="Children">
          <input type="number" min={0} max={10} value={childrenCount} onChange={(e) => setChildrenCount(Number(e.target.value))} className="w-full bg-transparent font-display text-lg outline-none" />
        </Field>
      </div>

      <div className="border-l-2 border-ember pl-4 py-2 bg-linen/40 text-sm flex items-center gap-2 min-h-[44px]">
        {checking ? (
          <><Loader2 className="animate-spin" size={16} /> Checking availability…</>
        ) : availability ? (
          enoughUnits ? (
            <><Check size={16} className="text-sage-deep" /> {availability.available} of {availability.total} units available — {nights} night{nights !== 1 && "s"}</>
          ) : (
            <><AlertCircle size={16} className="text-destructive" /> Only {availability.available} unit{availability.available !== 1 && "s"} available for these dates.</>
          )
        ) : (
          <span className="text-muted-foreground">Choose your dates to see availability.</span>
        )}
      </div>

      {/* Add-ons */}
      {visibleAddons.length > 0 && (
        <div className="border border-border bg-bone">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="font-display text-lg text-sage-deep">Extra Services</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {nights === 1
                ? "Bed & breakfast is included for single-night stays. Full meals available on stays of 2+ nights."
                : "Optional add-ons to enhance your stay."}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {visibleAddons.map((a) => {
              const checked = !!selectedAddons[a.id];
              const lineTotal = calcAddonTotal(a, Math.max(nights, 1), rooms, adults);
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
        {childrenCount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Children ≤12 ({childrenCount} × {nights} night{nights !== 1 && "s"} @ KES {(nightlyRate * 0.5).toLocaleString()} — half price)
            </span>
            <span>KES {childrenSubtotal.toLocaleString()}</span>
          </div>
        )}
        {nights > 1 && pod?.slug?.startsWith("glamping-pod") && (
          <div className="text-xs text-ember">Multi-night rate applied (saved KES {Math.round((SINGLE_NIGHT_RATE_KES - MULTI_NIGHT_RATE_KES) * nights * (adults + childrenCount * 0.5)).toLocaleString()})</div>
        )}
        {addonsTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Add-ons</span>
            <span>KES {addonsTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-display text-lg pt-2 border-t border-border">
          <span className="text-sage-deep">Total</span>
          <span className="text-sage-deep">KES {grandTotal.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Your Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="Full name" required />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="you@example.com" required />
        </Field>
        <Field label="Phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="+254…" />
        </Field>
        <Field label="Notes (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="Anniversary, dietary, arrival time…" />
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting || !enoughUnits || nights <= 0}
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
