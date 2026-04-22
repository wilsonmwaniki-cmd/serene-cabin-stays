import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendEmail } from "@/lib/send-email";
import { useAdminBookings, type AdminBooking } from "@/hooks/useAdminBookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

const statusVariant = (s: string) =>
  s === "confirmed" ? "default" : s === "cancelled" ? "destructive" : "secondary";

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const AdminBookings = () => {
  const { data: bookings = [], isLoading } = useAdminBookings();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("pending");

  const filtered = bookings.filter((b) => filter === "all" || b.status === filter);

  const setStatus = async (b: AdminBooking, status: "confirmed" | "cancelled") => {
    setBusyId(b.id);
    try {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
      if (error) throw error;

      // Try to send guest email — silently skip if not yet configured
      try {
        await sendEmail({
          templateName: status === "confirmed" ? "booking-confirmation" : "booking-decline",
          recipientEmail: b.guest_email,
          idempotencyKey: `booking-${status}-${b.id}`,
          templateData: {
            name: b.guest_name,
            podName: b.pod_name,
            checkIn: fmtDate(b.check_in),
            checkOut: fmtDate(b.check_out),
            adults: b.adults,
            children: b.children,
          },
        });
      } catch {
        // email not set up yet — booking still updated
      }

      toast({ title: status === "confirmed" ? "Booking approved" : "Booking declined", description: `${b.guest_name} · ${b.pod_name}` });
      qc.invalidateQueries({ queryKey: ["admin_bookings"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Reservations</p>
          <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Bookings</h1>
        </div>
        <div className="flex gap-2">
          {(["pending", "confirmed", "cancelled", "all"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">No {filter === "all" ? "" : filter} bookings.</p>}

      <div className="space-y-4">
        {filtered.map((b) => (
          <article key={b.id} className="border border-border/60 bg-bone/40 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-display text-xl text-sage-deep">{b.guest_name}</h2>
                  <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {b.pod_name} · {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                </p>
              </div>
              {b.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setStatus(b, "confirmed")} disabled={busyId === b.id}>
                    <Check size={14} className="mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(b, "cancelled")} disabled={busyId === b.id}>
                    <X size={14} className="mr-1" /> Decline
                  </Button>
                </div>
              )}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-6 text-sm">
              <Field label="Email" value={b.guest_email} />
              <Field label="Phone" value={b.guest_phone ?? "—"} />
              <Field label="Adults / Children" value={`${b.adults} / ${b.children}`} />
              <Field label="Rooms" value={String(b.rooms)} />
            </dl>
            {b.notes && <p className="mt-4 text-sm text-foreground/75 italic">"{b.notes}"</p>}
            {b.addons.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Add-ons</p>
                <ul className="text-sm space-y-1">
                  {b.addons.map((a, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{a.name} × {a.quantity}</span>
                      <span className="text-muted-foreground">KES {a.unit_price_kes.toLocaleString()} {a.pricing_unit.split("_").join(" ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
    <dd className="text-foreground/90">{value}</dd>
  </div>
);

export default AdminBookings;
