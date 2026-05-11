import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, RefreshCcw, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAdminChargeBatches, useAdminGuestCharges, type AdminGuestCharge } from "@/hooks/useAdminGuestCharges";
import { useAdminBookings } from "@/hooks/useAdminBookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { sendEmail } from "@/lib/send-email";

type GuestCharge = Tables<"guest_charges">;
type BusinessArea = GuestCharge["business_area"];

const kes = (value: number) => `KES ${value.toLocaleString()}`;
const NONE_VALUE = "__none__";

const areaLabel = (value: BusinessArea) =>
  value === "cabins" ? "Pods / cabins" : value === "restaurant" ? "Restaurant" : "Shared";

const statusVariant = (value: string) =>
  value === "paid" ? "default"
  : value === "failed" || value === "cancelled" ? "destructive"
  : value === "requested" ? "secondary"
  : "outline";

const statusLabel = (value: string) =>
  value === "requested" ? "Payment requested"
  : value === "paid" ? "Paid"
  : value === "failed" ? "Failed"
  : value === "cancelled" ? "Cancelled"
  : "Draft";

const isCollectible = (value: string) => value === "draft" || value === "failed";

const AdminBills = () => {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const bookingPrefill = params.get("booking");
  const { data: charges = [], isLoading: chargesLoading } = useAdminGuestCharges();
  const { data: chargeBatches = [], isLoading: batchesLoading } = useAdminChargeBatches();
  const { data: bookings = [], isLoading: bookingsLoading } = useAdminBookings();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    booking_id: bookingPrefill ?? "",
    business_area: "cabins" as BusinessArea,
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    description: "",
    amount_kes: 0,
    notes: "",
  });

  const bookingOptions = useMemo(
    () =>
      bookings.map((booking) => ({
        id: booking.id,
        label: `${booking.guest_name} · ${booking.pod_name} · ${new Date(booking.check_in).toLocaleDateString()}`,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        guest_phone: booking.guest_phone ?? "",
      })),
    [bookings],
  );

  const outstandingByBooking = useMemo(() => {
    const groups = new Map<string, { bookingLabel: string; bookingId: string; guestName: string; totalKes: number; count: number }>();

    for (const charge of charges) {
      if (!charge.booking_id || !isCollectible(charge.charge_status)) continue;
      const booking = bookings.find((item) => item.id === charge.booking_id);
      const current = groups.get(charge.booking_id) ?? {
        bookingId: charge.booking_id,
        bookingLabel: booking
          ? `${booking.guest_name} · ${booking.pod_name} · ${new Date(booking.check_in).toLocaleDateString()}`
          : `${charge.guest_name} · Stay balance`,
        guestName: charge.guest_name,
        totalKes: 0,
        count: 0,
      };
      current.totalKes += charge.amount_kes;
      current.count += 1;
      groups.set(charge.booking_id, current);
    }

    return Array.from(groups.values());
  }, [bookings, charges]);

  const latestBatchByBookingId = useMemo(() => {
    const map = new Map<string, (typeof chargeBatches)[number]>();
    for (const batch of chargeBatches) {
      if (!batch.booking_id || map.has(batch.booking_id)) continue;
      map.set(batch.booking_id, batch);
    }
    return map;
  }, [chargeBatches]);

  useEffect(() => {
    if (!draft.booking_id) return;
    const booking = bookingOptions.find((item) => item.id === draft.booking_id);
    if (!booking) return;

    setDraft((current) => ({
      ...current,
      guest_name: current.guest_name || booking.guest_name,
      guest_email: current.guest_email || booking.guest_email,
      guest_phone: current.guest_phone || booking.guest_phone,
      business_area: current.business_area === "shared" ? "cabins" : current.business_area,
    }));
  }, [draft.booking_id, bookingOptions]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin_guest_charges"] });
    qc.invalidateQueries({ queryKey: ["admin_guest_charge_batches"] });
  };

  const createCharge = async () => {
    if (!draft.guest_name.trim() || !draft.guest_phone.trim() || !draft.description.trim() || !draft.amount_kes) {
      toast({
        title: "Missing bill details",
        description: "Guest name, phone, description, and amount are required.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("guest_charges").insert({
      booking_id: draft.booking_id || null,
      business_area: draft.business_area,
      guest_name: draft.guest_name.trim(),
      guest_email: draft.guest_email.trim() || null,
      guest_phone: draft.guest_phone.trim(),
      description: draft.description.trim(),
      amount_kes: Number(draft.amount_kes) || 0,
      notes: draft.notes.trim() || null,
    });
    setCreating(false);

    if (error) {
      toast({ title: "Could not save bill", description: error.message, variant: "destructive" });
      return;
    }

    setDraft({
      booking_id: bookingPrefill ?? "",
      business_area: "cabins",
      guest_name: "",
      guest_email: "",
      guest_phone: "",
      description: "",
      amount_kes: 0,
      notes: "",
    });
    refresh();
    toast({ title: "Bill saved", description: "You can now send the M-Pesa prompt." });
  };

  const sendPrompt = async (charge: GuestCharge) => {
    setBusyId(charge.id);
    try {
      const response = await fetch("/api/kopokopo-initiate-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: charge.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not send payment prompt");
      toast({ title: "M-Pesa prompt sent", description: `${charge.guest_name} has been sent the extra bill.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send payment prompt";
      toast({ title: "Payment prompt not sent", description: message, variant: "destructive" });
    } finally {
      refresh();
      setBusyId(null);
    }
  };

  const refreshPayment = async (charge: GuestCharge) => {
    setBusyId(charge.id);
    try {
      const response = await fetch("/api/kopokopo-check-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: charge.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not refresh payment status");
      toast({ title: "Bill updated", description: `${charge.guest_name} is now ${statusLabel(body?.charge?.charge_status ?? charge.charge_status).toLowerCase()}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh payment status";
      toast({ title: "Payment check failed", description: message, variant: "destructive" });
    } finally {
      refresh();
      setBusyId(null);
    }
  };

  const removeCharge = async (charge: GuestCharge) => {
    if (!confirm(`Delete bill "${charge.description}" for ${charge.guest_name}?`)) return;
    const { error } = await supabase.from("guest_charges").delete().eq("id", charge.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const emailCharge = async (charge: AdminGuestCharge) => {
    setBusyId(charge.id);
    try {
      await sendEmail({
        templateName: "guest-charge-notification",
        recipientEmail: charge.guest_email ?? undefined,
        idempotencyKey: `guest-charge-email-${charge.id}-${Date.now()}`,
        templateData: {
          chargeId: charge.id,
          name: charge.guest_name,
          totalKes: charge.amount_kes,
          tillNumber: "3128049",
          billDescription: charge.description,
          notes: charge.notes ?? undefined,
        },
      });
      toast({ title: "Bill email sent", description: `${charge.guest_name} has received the bill email.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send bill email";
      toast({ title: "Email not sent", description: message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const emailBatch = async (batchId: string, guestName: string, guestEmail: string | null, totalKes: number, description: string) => {
    if (!guestEmail) {
      toast({ title: "Missing email", description: "This guest does not have an email address saved.", variant: "destructive" });
      return;
    }
    setBusyId(batchId);
    try {
      await sendEmail({
        templateName: "guest-charge-batch-notification",
        recipientEmail: guestEmail,
        idempotencyKey: `guest-charge-batch-email-${batchId}-${Date.now()}`,
        templateData: {
          batchId,
          name: guestName,
          totalKes,
          tillNumber: "3128049",
          billDescription: description,
        },
      });
      toast({ title: "Checkout balance email sent", description: `${guestName} has received the checkout balance email.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send checkout balance email";
      toast({ title: "Email not sent", description: message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const sendCheckoutPrompt = async (bookingId: string, guestName: string) => {
    setBusyId(bookingId);
    try {
      const response = await fetch("/api/kopokopo-initiate-charge-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not send checkout balance prompt");
      toast({
        title: "Checkout payment prompt sent",
        description: `${guestName} has been sent the full stay balance.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send checkout balance prompt";
      toast({ title: "Payment prompt not sent", description: message, variant: "destructive" });
    } finally {
      refresh();
      setBusyId(null);
    }
  };

  const refreshBatch = async (batchId: string, guestName: string) => {
    setBusyId(batchId);
    try {
      const response = await fetch("/api/kopokopo-check-charge-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not refresh checkout payment");
      toast({
        title: "Checkout payment updated",
        description: `${guestName} is now ${statusLabel(body?.batch?.batch_status ?? "requested").toLowerCase()}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh checkout payment";
      toast({ title: "Payment check failed", description: message, variant: "destructive" });
    } finally {
      refresh();
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Payments</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Extra bills</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          Create extra charges from the pods or the restaurant, then push an M-Pesa payment request directly to the guest.
        </p>
      </div>

      <section className="border border-dashed border-border p-5 bg-bone/30 space-y-4">
        <h2 className="font-display text-lg text-sage-deep">Create extra bill</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Link to booking (optional)</Label>
            <Select value={draft.booking_id || NONE_VALUE} onValueChange={(value) => setDraft((current) => ({ ...current, booking_id: value === NONE_VALUE ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="No linked booking" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>No linked booking</SelectItem>
                {bookingOptions.map((booking) => (
                  <SelectItem key={booking.id} value={booking.id}>{booking.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bill source</Label>
            <Select value={draft.business_area} onValueChange={(value) => setDraft((current) => ({ ...current, business_area: value as BusinessArea }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cabins">Pods / cabins</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Guest name</Label>
            <Input value={draft.guest_name} onChange={(e) => setDraft((current) => ({ ...current, guest_name: e.target.value }))} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={draft.guest_phone} onChange={(e) => setDraft((current) => ({ ...current, guest_phone: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={draft.guest_email} onChange={(e) => setDraft((current) => ({ ...current, guest_email: e.target.value }))} />
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input type="number" value={draft.amount_kes} onChange={(e) => setDraft((current) => ({ ...current, amount_kes: Number(e.target.value) }))} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Input placeholder="Example: Dinner, drinks, firewood, laundry" value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
        </div>
        <Button onClick={createCharge} disabled={creating}>{creating ? "Saving…" : "Save bill"}</Button>
      </section>

      {(chargesLoading || bookingsLoading || batchesLoading) && <p className="text-muted-foreground">Loading…</p>}

      {outstandingByBooking.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl text-sage-deep">Checkout balances</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tally unpaid bills for a stay, then push one combined M-Pesa prompt to the guest.
            </p>
          </div>
          <div className="space-y-3">
            {outstandingByBooking.map((group) => {
              const latestBatch = latestBatchByBookingId.get(group.bookingId);
              return (
                <article key={group.bookingId} className="border border-border/60 bg-bone/40 p-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl text-sage-deep">{group.bookingLabel}</h3>
                    <p className="text-sm text-muted-foreground">
                      {group.count} unpaid line item{group.count === 1 ? "" : "s"} · {kes(group.totalKes)}
                    </p>
                    {latestBatch && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Latest checkout prompt: {statusLabel(latestBatch.batch_status)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => sendCheckoutPrompt(group.bookingId, group.guestName)} disabled={busyId === group.bookingId}>
                      <CreditCard size={14} className="mr-1" /> Send Checkout Balance
                    </Button>
                    {latestBatch && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => emailBatch(latestBatch.id, group.guestName, latestBatch.guest_email ?? null, latestBatch.total_kes, latestBatch.description)}
                        disabled={busyId === latestBatch.id}
                      >
                        Email Checkout Balance
                      </Button>
                    )}
                    {latestBatch?.payment_request_location && (
                      <Button size="sm" variant="outline" onClick={() => refreshBatch(latestBatch.id, group.guestName)} disabled={busyId === latestBatch.id}>
                        <RefreshCcw size={14} className="mr-1" /> Refresh Checkout Payment
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {charges.map((charge) => (
          <article key={charge.id} className="border border-border/60 bg-bone/40 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-display text-xl text-sage-deep">{charge.guest_name}</h2>
                  <Badge variant={statusVariant(charge.charge_status)}>{statusLabel(charge.charge_status)}</Badge>
                  <Badge variant="outline">{areaLabel(charge.business_area)}</Badge>
                  {"source_kind" in charge && charge.source_kind === "restaurant_order" && (
                    <Badge variant="secondary">Restaurant order</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{charge.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => sendPrompt(charge)} disabled={busyId === charge.id}>
                  <CreditCard size={14} className="mr-1" /> Send M-Pesa Prompt
                </Button>
                <Button size="sm" variant="outline" onClick={() => emailCharge(charge)} disabled={busyId === charge.id || !charge.guest_email}>
                  Email Bill
                </Button>
                {charge.payment_request_location && (
                  <Button size="sm" variant="outline" onClick={() => refreshPayment(charge)} disabled={busyId === charge.id}>
                    <RefreshCcw size={14} className="mr-1" /> Refresh Payment
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => removeCharge(charge)} disabled={busyId === charge.id}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-3 text-sm">
              <Field label="Amount" value={kes(charge.amount_kes)} />
              <Field label="Phone" value={charge.guest_phone} />
              <Field label="Email" value={charge.guest_email ?? "—"} />
              <Field label="Payment Ref" value={charge.payment_reference ?? "—"} />
            </div>
            {"order_items" in charge && charge.order_items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Ordered items</p>
                <ul className="space-y-2 text-sm">
                  {charge.order_items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-foreground/90">{item.item_name} × {item.quantity}</span>
                        {item.special_request && (
                          <p className="text-xs text-muted-foreground mt-1">{item.special_request}</p>
                        )}
                      </div>
                      <span className="text-foreground/90">{kes(item.line_total_kes)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {charge.notes && <p className="mt-4 text-sm text-foreground/75 italic">"{charge.notes}"</p>}
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

export default AdminBills;
