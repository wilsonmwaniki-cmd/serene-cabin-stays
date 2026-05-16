import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, CreditCard, MessageCircle, Pencil, Plus, RefreshCcw, Trash2, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  useAdminChargeBatches,
  useAdminGuestCharges,
  type AdminGuestCharge,
  type GuestChargeLineItem,
} from "@/hooks/useAdminGuestCharges";
import { useAdminBookings } from "@/hooks/useAdminBookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { sendEmail } from "@/lib/send-email";

type GuestCharge = Tables<"guest_charges">;
type BusinessArea = GuestCharge["business_area"];

type DraftLineItem = {
  id: string;
  label: string;
  service_date: string | null;
  quantity: number;
  unit_amount_kes: number;
};

type BillDraft = {
  booking_id: string;
  business_area: BusinessArea;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  description: string;
  amount_kes: number;
  notes: string;
  line_items: DraftLineItem[];
};

const kes = (value: number) => `KES ${value.toLocaleString()}`;
const NONE_VALUE = "__none__";
const CUSTOM_ITEM_VALUE = "__custom__";
const MPESA_TILL = "3128049";
const BILL_ITEM_OPTIONS = [
  "Dinner",
  "Lunch",
  "Breakfast",
  "Water",
  "Juice",
  "Milk",
  "Soda",
  "Tea",
  "Coffee",
  "Wine",
  "Beer",
  "Extra night",
  "Firewood",
  "Laundry",
  "Room cleaning",
  "Beddings change",
  "Transport",
];

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

const createLineItem = (partial?: Partial<DraftLineItem>): DraftLineItem => ({
  id: partial?.id ?? crypto.randomUUID(),
  label: partial?.label ?? "",
  service_date: partial?.service_date ?? null,
  quantity: partial?.quantity ?? 1,
  unit_amount_kes: partial?.unit_amount_kes ?? 0,
});

const createEmptyDraft = (bookingId = ""): BillDraft => ({
  booking_id: bookingId,
  business_area: "cabins",
  guest_name: "",
  guest_email: "",
  guest_phone: "",
  description: "",
  amount_kes: 0,
  notes: "",
  line_items: [createLineItem()],
});

const normalizeLineItems = (items: DraftLineItem[]): GuestChargeLineItem[] =>
  items
    .map((item) => {
      const label = item.label.trim();
      const quantity = Number(item.quantity || 0);
      const unitAmount = Number(item.unit_amount_kes || 0);
      if (!label || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitAmount) || unitAmount < 0) {
        return null;
      }

      return {
        id: item.id,
        label,
        service_date: item.service_date || null,
        quantity,
        unit_amount_kes: unitAmount,
        line_total_kes: quantity * unitAmount,
      } satisfies GuestChargeLineItem;
    })
    .filter((item): item is GuestChargeLineItem => !!item);

const buildDescriptionFromItems = (items: GuestChargeLineItem[]) =>
  items
    .map((item) => `${item.label}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`)
    .join(", ");

const toJsonLineItems = (items: GuestChargeLineItem[]): Json =>
  items.map((item) => ({
    id: item.id,
    label: item.label,
    service_date: item.service_date,
    quantity: item.quantity,
    unit_amount_kes: item.unit_amount_kes,
    line_total_kes: item.line_total_kes,
  }));

const formatBillItemDate = (value: string | null) => {
  if (!value) return "Pick date";
  try {
    return format(parseISO(value), "dd/MM/yyyy");
  } catch {
    return value;
  }
};

const normalizeWhatsAppPhone = (value: string | null | undefined) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
};

const createBillWhatsAppMessage = (charge: AdminGuestCharge, payUrl: string) => {
  const lines = [
    `Hello ${charge.guest_name},`,
    "",
    `Here is your Wild by LERA bill for ${kes(charge.amount_kes)}.`,
    `Bill: ${charge.description}`,
    "",
    "Please use this payment link to pay:",
    payUrl,
    "",
    `You can also pay by M-Pesa Till Number ${MPESA_TILL}.`,
  ];

  return lines.join("\n");
};

const buildBillEmailPreview = (charge: AdminGuestCharge) => {
  const subject = `A new bill from Wild by LERA`;
  const lines = [
    `Hello ${charge.guest_name},`,
    "",
    "We have added a new bill to your stay record.",
    "",
    `Description: ${charge.description}`,
    `Amount: ${kes(charge.amount_kes)}`,
  ];

  if (charge.notes) {
    lines.push("", "Notes:", charge.notes);
  }

  lines.push(
    "",
    "The email will include a 'Pay this bill' button.",
    `You can also pay directly via M-Pesa Till Number ${MPESA_TILL}.`,
  );

  return {
    subject,
    body: lines.join("\n"),
  };
};

const AdminBills = () => {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const bookingPrefill = params.get("booking");
  const { data: charges = [], isLoading: chargesLoading } = useAdminGuestCharges();
  const { data: chargeBatches = [], isLoading: batchesLoading } = useAdminChargeBatches();
  const { data: bookings = [], isLoading: bookingsLoading } = useAdminBookings();
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [previewCharge, setPreviewCharge] = useState<AdminGuestCharge | null>(null);
  const [draft, setDraft] = useState<BillDraft>(() => createEmptyDraft(bookingPrefill ?? ""));

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

  const normalizedLineItems = useMemo(() => normalizeLineItems(draft.line_items), [draft.line_items]);
  const itemizedTotalKes = useMemo(
    () => normalizedLineItems.reduce((sum, item) => sum + item.line_total_kes, 0),
    [normalizedLineItems],
  );
  const effectiveAmountKes = normalizedLineItems.length > 0 ? itemizedTotalKes : Number(draft.amount_kes || 0);

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

  const resetDraft = () => {
    setEditingChargeId(null);
    setDraft(createEmptyDraft(bookingPrefill ?? ""));
  };

  const addLineItem = () => {
    setDraft((current) => ({
      ...current,
      line_items: [...current.line_items, createLineItem()],
    }));
  };

  const updateLineItem = (id: string, patch: Partial<DraftLineItem>) => {
    setDraft((current) => ({
      ...current,
      line_items: current.line_items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeLineItem = (id: string) => {
    setDraft((current) => ({
      ...current,
      line_items: current.line_items.length > 1
        ? current.line_items.filter((item) => item.id !== id)
        : [createLineItem()],
    }));
  };

  const beginEdit = (charge: AdminGuestCharge) => {
    if (charge.source_kind === "restaurant_order" || charge.charge_status === "paid") {
      return;
    }

    setEditingChargeId(charge.id);
    setDraft({
      booking_id: charge.booking_id ?? "",
      business_area: charge.business_area,
      guest_name: charge.guest_name,
      guest_email: charge.guest_email ?? "",
      guest_phone: charge.guest_phone,
      description: charge.description,
      amount_kes: charge.amount_kes,
      notes: charge.notes ?? "",
      line_items: charge.manual_items.length > 0
        ? charge.manual_items.map((item) => createLineItem(item))
        : [createLineItem()],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveCharge = async () => {
    const description = draft.description.trim() || buildDescriptionFromItems(normalizedLineItems);
    const amountKes = effectiveAmountKes;

    if (!draft.guest_name.trim() || !draft.guest_phone.trim() || !description || !amountKes) {
      toast({
        title: "Missing bill details",
        description: "Guest name, phone, a summary, and an amount are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      booking_id: draft.booking_id || null,
      business_area: draft.business_area,
      guest_name: draft.guest_name.trim(),
      guest_email: draft.guest_email.trim() || null,
      guest_phone: draft.guest_phone.trim(),
      description,
      amount_kes: amountKes,
      notes: draft.notes.trim() || null,
      itemized_lines: toJsonLineItems(normalizedLineItems),
    } satisfies Tables<"guest_charges">["Insert"];

    const query = editingChargeId
      ? supabase
          .from("guest_charges")
          .update({
            ...payload,
            charge_status: "draft",
            payment_provider: null,
            payment_phone: null,
            payment_amount_kes: null,
            payment_reference: null,
            payment_request_id: null,
            payment_request_location: null,
            payment_requested_at: null,
            payment_received_at: null,
            payment_batch_id: null,
          })
          .eq("id", editingChargeId)
      : supabase.from("guest_charges").insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      toast({
        title: editingChargeId ? "Could not update bill" : "Could not save bill",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    resetDraft();
    refresh();
    toast({
      title: editingChargeId ? "Bill updated" : "Bill saved",
      description: editingChargeId
        ? "The bill was updated. If needed, send a fresh payment prompt."
        : "You can now send the M-Pesa prompt.",
    });
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
          tillNumber: MPESA_TILL,
          billDescription: charge.description,
          notes: charge.notes ?? undefined,
        },
      });
      toast({ title: "Bill email sent", description: `${charge.guest_name} has received the bill email.` });
      setPreviewCharge(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send bill email";
      toast({ title: "Email not sent", description: message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const sendBillWhatsApp = async (charge: AdminGuestCharge) => {
    const phone = normalizeWhatsAppPhone(charge.guest_phone);
    if (!phone) {
      toast({
        title: "WhatsApp not available",
        description: "This bill does not have a valid phone number.",
        variant: "destructive",
      });
      return;
    }

    setBusyId(charge.id);
    const popup = window.open("", "_blank");

    if (popup) {
      popup.document.write("<p style=\"font-family: sans-serif; padding: 24px;\">Preparing WhatsApp bill…</p>");
    }

    try {
      const response = await fetch("/api/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "guest_charge",
          targetId: charge.id,
          recipientEmail: charge.guest_email,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not prepare the WhatsApp bill");

      const message = createBillWhatsAppMessage(charge, body?.payUrl);
      const targetUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      if (popup) {
        popup.location.href = targetUrl;
      } else {
        window.location.href = targetUrl;
      }
    } catch (error) {
      if (popup) popup.close();
      const message = error instanceof Error ? error.message : "Could not prepare the WhatsApp bill";
      toast({
        title: "WhatsApp message not ready",
        description: message,
        variant: "destructive",
      });
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
          tillNumber: MPESA_TILL,
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-sage-deep">{editingChargeId ? "Edit extra bill" : "Create extra bill"}</h2>
          {editingChargeId && (
            <Button variant="outline" size="sm" onClick={resetDraft}>
              <X size={14} className="mr-1" /> Cancel edit
            </Button>
          )}
        </div>
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
            <Input
              type="number"
              value={normalizedLineItems.length > 0 ? effectiveAmountKes : draft.amount_kes}
              readOnly={normalizedLineItems.length > 0}
              onChange={(e) => setDraft((current) => ({ ...current, amount_kes: Number(e.target.value) }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {normalizedLineItems.length > 0 ? "Amount is calculated automatically from the itemized bill lines below." : "You can enter one total amount or build the bill from line items below."}
            </p>
          </div>
        </div>
        <div>
          <Label>Summary / description</Label>
          <Input
            placeholder="Example: Dinner, drinks, firewood, laundry"
            value={draft.description}
            onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
          />
          <p className="mt-1 text-xs text-muted-foreground">This is the short bill title shown on the bill card and in payment messages.</p>
        </div>

        <div className="space-y-3 border border-border/60 bg-bone p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label>Bill items</Label>
              <p className="text-xs text-muted-foreground mt-1">Add meals, drinks, extra nights, laundry, transport, or any other charge as separate lines.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus size={14} className="mr-1" /> Add item
            </Button>
          </div>

          <div className="space-y-3">
            {draft.line_items.map((item, index) => {
              const lineTotal = Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unit_amount_kes || 0));
              const selectedLabel = BILL_ITEM_OPTIONS.includes(item.label) ? item.label : CUSTOM_ITEM_VALUE;
              return (
                <div key={item.id} className="grid md:grid-cols-[1.35fr_0.95fr_0.5fr_0.7fr_0.7fr_auto] gap-3 items-end">
                  <div>
                    <Label>Item {index + 1}</Label>
                    <Select
                      value={selectedLabel}
                      onValueChange={(value) =>
                        updateLineItem(item.id, { label: value === CUSTOM_ITEM_VALUE ? "" : value })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Choose item" /></SelectTrigger>
                      <SelectContent>
                        {BILL_ITEM_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_ITEM_VALUE}>Custom item</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedLabel === CUSTOM_ITEM_VALUE && (
                      <Input
                        className="mt-2"
                        value={item.label}
                        placeholder="Type custom item"
                        onChange={(e) => updateLineItem(item.id, { label: e.target.value })}
                      />
                    )}
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm ring-offset-background">
                        <span className={item.service_date ? "text-foreground" : "text-muted-foreground"}>
                          {formatBillItemDate(item.service_date)}
                        </span>
                        <CalendarIcon size={14} className="text-muted-foreground" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={item.service_date ? parseISO(item.service_date) : undefined}
                          onSelect={(date) =>
                            updateLineItem(item.id, {
                              service_date: date ? format(date, "yyyy-MM-dd") : null,
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                  <div>
                    <Label>Unit (KES)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.unit_amount_kes}
                      onChange={(e) => updateLineItem(item.id, { unit_amount_kes: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                  <div>
                    <Label>Line total</Label>
                    <Input value={lineTotal} readOnly />
                  </div>
                  <div className="pb-0.5">
                    <Button type="button" variant="outline" size="icon" onClick={() => removeLineItem(item.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveCharge} disabled={saving}>{saving ? "Saving…" : editingChargeId ? "Update bill" : "Save bill"}</Button>
          {editingChargeId && (
            <Button variant="outline" onClick={resetDraft}>Cancel</Button>
          )}
        </div>
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
                  {charge.source_kind === "restaurant_order" && (
                    <Badge variant="secondary">Restaurant order</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{charge.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {charge.source_kind !== "restaurant_order" && charge.charge_status !== "paid" && (
                  <Button size="sm" variant="outline" onClick={() => beginEdit(charge)} disabled={busyId === charge.id}>
                    <Pencil size={14} className="mr-1" /> Edit
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => sendPrompt(charge)} disabled={busyId === charge.id}>
                  <CreditCard size={14} className="mr-1" /> Send M-Pesa Prompt
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreviewCharge(charge)} disabled={busyId === charge.id || !charge.guest_email}>
                  Email Bill
                </Button>
                <Button size="sm" variant="outline" onClick={() => sendBillWhatsApp(charge)} disabled={busyId === charge.id}>
                  <MessageCircle size={14} className="mr-1" /> WhatsApp Bill
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
            {charge.order_items.length > 0 && (
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
            {charge.order_items.length === 0 && charge.manual_items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Bill items</p>
                <ul className="space-y-2 text-sm">
                  {charge.manual_items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-foreground/90">{item.label} × {item.quantity}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.service_date ? `${formatBillItemDate(item.service_date)} · ` : ""}{kes(item.unit_amount_kes)} each
                        </p>
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

      <Dialog open={!!previewCharge} onOpenChange={(open) => !open && setPreviewCharge(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email bill preview</DialogTitle>
            <DialogDescription>
              Review the message before sending it to the guest.
            </DialogDescription>
          </DialogHeader>
          {previewCharge && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-md border border-border/70 bg-bone/40 p-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">To</div>
                  <div>{previewCharge.guest_email || "No email address"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subject</div>
                  <div>{buildBillEmailPreview(previewCharge).subject}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Message</div>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                    {buildBillEmailPreview(previewCharge).body}
                  </pre>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewCharge(null)}>Cancel</Button>
                <Button onClick={() => void emailCharge(previewCharge)} disabled={busyId === previewCharge.id || !previewCharge.guest_email}>
                  {busyId === previewCharge.id ? "Sending…" : "Send bill email"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
