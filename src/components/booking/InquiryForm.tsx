import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { format, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, AlertCircle } from "lucide-react";

interface Pod {
  id: string;
  name: string;
  price_kes: number;
  capacity: number;
}

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
  const subtotal = pod ? pod.price_kes * nights * rooms : 0;
  const enoughUnits = availability ? availability.available >= rooms : false;

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
    const { error } = await supabase.from("bookings").insert({
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
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
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
        <Field label="Check In">
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full bg-transparent font-display text-lg outline-none" />
        </Field>
        <Field label="Check Out">
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full bg-transparent font-display text-lg outline-none" />
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
            <><Check size={16} className="text-sage-deep" /> {availability.available} of {availability.total} units available — {nights} night{nights !== 1 && "s"} · Subtotal <strong>KES {subtotal.toLocaleString()}</strong></>
          ) : (
            <><AlertCircle size={16} className="text-destructive" /> Only {availability.available} unit{availability.available !== 1 && "s"} available for these dates.</>
          )
        ) : (
          <span className="text-muted-foreground">Choose your dates to see availability.</span>
        )}
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
      <p className="text-xs text-muted-foreground text-center">Check-in 3pm · Check-out 11am · Minimum check-in age 18</p>
    </form>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block bg-bone border border-border px-4 py-3">
    <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);
