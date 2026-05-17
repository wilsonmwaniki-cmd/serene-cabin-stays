import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendEmail } from "@/lib/send-email";
import { createGoogleCalendarUrl } from "@/lib/google-calendar";
import { useAdminBookings, type AdminBooking } from "@/hooks/useAdminBookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CalendarPlus, Check, CreditCard, Mail, MessageCircle, ReceiptText, RefreshCcw, RotateCcw, X } from "lucide-react";

const statusVariant = (s: string) =>
  s === "confirmed" ? "default" : s === "cancelled" ? "destructive" : "secondary";

const paymentStatusVariant = (s: string) =>
  s === "paid" ? "default"
  : s === "failed" ? "destructive"
  : s === "requested" ? "secondary"
  : "outline";

const paymentStatusLabel = (s: string) =>
  s === "paid" ? "Paid"
  : s === "requested" ? "Payment Requested"
  : s === "failed" ? "Payment Failed"
  : s === "refunded" ? "Refunded"
  : "Unpaid";

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const MPESA_TILL_NUMBER = "3128049";

const normalizeWhatsAppPhone = (value: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
};

const createWhatsAppUrl = (booking: AdminBooking) => {
  const phone = normalizeWhatsAppPhone(booking.guest_phone);
  if (!phone) return null;

  const message = [
    `Hello ${booking.guest_name},`,
    "",
    "Please confirm your booking details for Wild by LERA:",
    `Pod: ${booking.pod_name ?? "—"}`,
    `Dates: ${fmtDate(booking.check_in)} to ${fmtDate(booking.check_out)}`,
    `Rooms: ${booking.rooms}`,
    `Adults: ${booking.adults}`,
    `Children under 12: ${booking.children}`,
    `Guests 12+: ${booking.children_12_plus ?? 0}`,
    `Total: KES ${(booking.total_kes ?? 0).toLocaleString()}`,
    `Payment: M-Pesa Till Number ${MPESA_TILL_NUMBER}`,
    booking.notes ? `Notes: ${booking.notes}` : null,
    "",
    "Safaricom will send you an M-Pesa confirmation SMS after payment.",
    "Please reply here to confirm these details.",
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const createApprovalWhatsAppMessage = (booking: AdminBooking, payUrl?: string | null) => [
  `Hello ${booking.guest_name},`,
  "",
  "Your booking at Wild by LERA has been approved.",
  `Pod(s): ${booking.pod_name ?? "—"}`,
  `Dates: ${fmtDate(booking.check_in)} to ${fmtDate(booking.check_out)}`,
  `Rooms: ${booking.rooms}`,
  `Adults: ${booking.adults}`,
  `Children under 12: ${booking.children}`,
  `Guests 12+: ${booking.children_12_plus ?? 0}`,
  `Total: KES ${(booking.total_kes ?? 0).toLocaleString()}`,
  `How to pay: M-Pesa Till Number ${MPESA_TILL_NUMBER}`,
  payUrl ? `Pay now: ${payUrl}` : null,
  "",
  "Safaricom will send you an M-Pesa confirmation SMS after payment.",
  "Please reply here if you need any help.",
]
  .filter(Boolean)
  .join("\n");

const statusToastTitle = (status: AdminBooking["status"]) => {
  if (status === "confirmed") return "Booking approved";
  if (status === "cancelled") return "Booking declined";
  return "Booking moved back to pending";
};

const paymentStatusRank = (status: AdminBooking["payment_status"]) => {
  if (status === "paid") return 0;
  if (status === "requested") return 1;
  if (status === "failed") return 2;
  if (status === "refunded") return 3;
  return 4;
};

type SortOption =
  | "check_in_asc"
  | "check_in_desc"
  | "created_at_desc"
  | "created_at_asc"
  | "payment_status"
  | "guest_name";

const AdminBookings = () => {
  const { data: bookings = [], isLoading } = useAdminBookings();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("pending");
  const [sortBy, setSortBy] = useState<SortOption>("check_in_asc");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const filtered = bookings
    .filter((b) => filter === "all" || b.status === filter)
    .sort((a, b) => {
      if (sortBy === "check_in_asc") {
        return new Date(a.check_in).getTime() - new Date(b.check_in).getTime();
      }
      if (sortBy === "check_in_desc") {
        return new Date(b.check_in).getTime() - new Date(a.check_in).getTime();
      }
      if (sortBy === "created_at_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "created_at_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "payment_status") {
        const rankDiff = paymentStatusRank(a.payment_status) - paymentStatusRank(b.payment_status);
        if (rankDiff !== 0) return rankDiff;
        return new Date(a.check_in).getTime() - new Date(b.check_in).getTime();
      }
      return a.guest_name.localeCompare(b.guest_name);
    });
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;

  const requestPaymentPrompt = async (booking: AdminBooking, options?: { silentConfigFailure?: boolean }) => {
    setBusyId(booking.id);

    try {
      const response = await fetch("/api/kopokopo-initiate-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Could not send payment prompt");
      }

      toast({
        title: "M-Pesa prompt sent",
        description: `A payment prompt was sent to ${booking.guest_name}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send payment prompt";
      if (!options?.silentConfigFailure || !message.toLowerCase().includes("not configured")) {
        toast({
          title: "Payment prompt not sent",
          description: message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Booking approved",
          description: "KopoKopo is not configured yet, so the payment prompt was not sent.",
        });
      }
    } finally {
      qc.invalidateQueries({ queryKey: ["admin_bookings"] });
      setBusyId(null);
    }
  };

  const refreshPaymentStatus = async (booking: AdminBooking) => {
    setBusyId(booking.id);

    try {
      const response = await fetch("/api/kopokopo-check-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Could not refresh payment status");
      }

      toast({
        title: "Payment status updated",
        description: `${booking.guest_name} is now marked as ${paymentStatusLabel(body?.booking?.payment_status ?? booking.payment_status).toLowerCase()}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh payment status";
      toast({
        title: "Payment check failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      qc.invalidateQueries({ queryKey: ["admin_bookings"] });
      setBusyId(null);
    }
  };

  const sendApprovalEmail = async (booking: AdminBooking) => {
    setBusyId(booking.id);
    try {
      await sendEmail({
        templateName: "booking-confirmation",
        recipientEmail: booking.guest_email,
        idempotencyKey: `booking-confirmation-manual-${booking.id}-${Date.now()}`,
        templateData: {
          bookingId: booking.id,
          name: booking.guest_name,
          podName: booking.pod_name,
          checkIn: fmtDate(booking.check_in),
          checkOut: fmtDate(booking.check_out),
          adults: booking.adults,
          children: booking.children,
          childrenUnder12: booking.children,
          children12Plus: booking.children_12_plus ?? 0,
          rooms: booking.rooms,
          subtotalKes: booking.subtotal_kes ?? booking.total_kes ?? 0,
          discountKes: booking.discount_kes ?? 0,
          totalKes: booking.total_kes ?? 0,
          promoCode: booking.promo_code_text ?? undefined,
          tillNumber: MPESA_TILL_NUMBER,
        },
      });
      toast({ title: "Approval email sent", description: `${booking.guest_name} has received the confirmation email.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send approval email";
      toast({ title: "Email not sent", description: message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const sendApprovalWhatsApp = async (booking: AdminBooking) => {
    const phone = normalizeWhatsAppPhone(booking.guest_phone);
    if (!phone) {
      toast({
        title: "WhatsApp not available",
        description: "This booking does not have a valid phone number.",
        variant: "destructive",
      });
      return;
    }

    setBusyId(booking.id);
    const popup = window.open("", "_blank");

    if (popup) {
      popup.document.write("<p style=\"font-family: sans-serif; padding: 24px;\">Preparing WhatsApp message…</p>");
    }

    try {
      const response = await fetch("/api/payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType: "booking",
          targetId: booking.id,
          recipientEmail: booking.guest_email,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Could not prepare the WhatsApp approval");
      }

      const message = createApprovalWhatsAppMessage(booking, body?.payUrl);
      const targetUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      if (popup) {
        popup.location.href = targetUrl;
      } else {
        window.location.href = targetUrl;
      }
    } catch (error) {
      if (popup) popup.close();
      const message = error instanceof Error ? error.message : "Could not prepare the WhatsApp approval";
      toast({
        title: "WhatsApp message not ready",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (b: AdminBooking, status: "pending" | "confirmed" | "cancelled") => {
    setBusyId(b.id);
    const previousBookings = qc.getQueryData<AdminBooking[]>(["admin_bookings"]) ?? [];
    const previousCounts = qc.getQueryData<{ pendingBookings: number; newMessages: number }>(["admin_counts"]);

    qc.setQueryData<AdminBooking[]>(["admin_bookings"], (current = []) =>
      current.map((booking) =>
        booking.id === b.id ? { ...booking, status } : booking
      ),
    );

    qc.setQueryData<{ pendingBookings: number; newMessages: number } | undefined>(["admin_counts"], (current) => {
      if (!current || b.status === status) return current;

      let pendingBookings = current.pendingBookings;
      if (b.status === "pending" && status !== "pending") pendingBookings = Math.max(0, pendingBookings - 1);
      if (b.status !== "pending" && status === "pending") pendingBookings += 1;

      return {
        ...current,
        pendingBookings,
      };
    });

    try {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
      if (error) throw error;

      // Try to send guest email — silently skip if not yet configured
              try {
        if (status === "confirmed" || status === "cancelled") {
          await sendEmail({
            templateName: status === "confirmed" ? "booking-confirmation" : "booking-decline",
            recipientEmail: b.guest_email,
            idempotencyKey: `booking-${status}-${b.id}`,
            templateData: {
              bookingId: b.id,
              name: b.guest_name,
              podName: b.pod_name,
              checkIn: fmtDate(b.check_in),
              checkOut: fmtDate(b.check_out),
              adults: b.adults,
              children: b.children,
              childrenUnder12: b.children,
              children12Plus: b.children_12_plus ?? 0,
              subtotalKes: b.subtotal_kes ?? b.total_kes ?? 0,
              discountKes: b.discount_kes ?? 0,
              totalKes: b.total_kes ?? 0,
              promoCode: b.promo_code_text ?? undefined,
              tillNumber: MPESA_TILL_NUMBER,
            },
          });
        }
      } catch {
        // email not set up yet — booking still updated
      }

      if (status === "confirmed") {
        await requestPaymentPrompt({ ...b, status }, { silentConfigFailure: true });
      }

      toast({ title: statusToastTitle(status), description: `${b.guest_name} · ${b.pod_name}` });
    } catch (err) {
      qc.setQueryData(["admin_bookings"], previousBookings);
      qc.setQueryData(["admin_counts"], previousCounts);
      const message = err instanceof Error ? err.message : "Failed";
      const title = message.includes("room(s) left for those dates") ? "Cannot approve booking" : "Error";
      toast({ title, description: message, variant: "destructive" });
    } finally {
      qc.invalidateQueries({ queryKey: ["admin_bookings"] });
      qc.invalidateQueries({ queryKey: ["admin_counts"] });
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
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "confirmed", "cancelled", "all"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
          >
            <option value="check_in_asc">Sort: Check-in earliest</option>
            <option value="check_in_desc">Sort: Check-in latest</option>
            <option value="created_at_desc">Sort: Newest request</option>
            <option value="created_at_asc">Sort: Oldest request</option>
            <option value="payment_status">Sort: Payment status</option>
            <option value="guest_name">Sort: Guest name</option>
          </select>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">No {filter === "all" ? "" : filter} bookings.</p>}

      <div className="space-y-4">
        {filtered.map((b) => (
          <article
            key={b.id}
            className="border border-border/60 bg-bone/40 p-5 md:p-6 cursor-pointer transition-colors hover:bg-bone/60"
            onClick={() => setSelectedBookingId(b.id)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-display text-xl text-sage-deep">{b.guest_name}</h2>
                  <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                  <Badge variant={paymentStatusVariant(b.payment_status)}>{paymentStatusLabel(b.payment_status)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {b.pod_name} · {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                {createWhatsAppUrl(b) && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={createWhatsAppUrl(b) ?? "#"} target="_blank" rel="noreferrer">
                      <MessageCircle size={14} className="mr-1" /> WhatsApp
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <a href={createGoogleCalendarUrl(b)} target="_blank" rel="noreferrer">
                    <CalendarPlus size={14} className="mr-1" /> Add to Google Calendar
                  </a>
                </Button>
                {(b.status === "confirmed" || b.status === "pending") && (
                  <Button size="sm" variant="outline" onClick={() => requestPaymentPrompt(b)} disabled={busyId === b.id}>
                    <CreditCard size={14} className="mr-1" /> Send M-Pesa Prompt
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/admin/bills?booking=${b.id}`}>
                    <ReceiptText size={14} className="mr-1" /> Extra Bill
                  </Link>
                </Button>
                {b.status === "confirmed" && (
                  <Button size="sm" variant="outline" onClick={() => sendApprovalEmail(b)} disabled={busyId === b.id}>
                    <Mail size={14} className="mr-1" /> Email Approval
                  </Button>
                )}
                {b.status === "confirmed" && (
                  <Button size="sm" variant="outline" onClick={() => sendApprovalWhatsApp(b)} disabled={busyId === b.id}>
                    <MessageCircle size={14} className="mr-1" /> WhatsApp Approval
                  </Button>
                )}
                {b.payment_request_location && (
                  <Button size="sm" variant="outline" onClick={() => refreshPaymentStatus(b)} disabled={busyId === b.id}>
                    <RefreshCcw size={14} className="mr-1" /> Refresh Payment
                  </Button>
                )}
                {b.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => setStatus(b, "confirmed")} disabled={busyId === b.id}>
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(b, "cancelled")} disabled={busyId === b.id}>
                      <X size={14} className="mr-1" /> Decline
                    </Button>
                  </>
                )}
                {b.status !== "pending" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(b, "pending")} disabled={busyId === b.id}>
                    <RotateCcw size={14} className="mr-1" /> Move to Pending
                  </Button>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-6 text-sm">
              <Field label="Email" value={b.guest_email} />
              <Field label="Phone" value={b.guest_phone ?? "—"} />
              <Field label="Adults" value={String(b.adults)} />
              <Field label="Children Under 12" value={String(b.children)} />
              <Field label="Guests 12+" value={String(b.children_12_plus ?? 0)} />
              <Field label="Rooms" value={String(b.rooms)} />
            </dl>
            <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
              <Field label="Total" value={`KES ${(b.total_kes ?? 0).toLocaleString()}`} />
              <Field label="Discount" value={b.discount_kes ? `KES ${b.discount_kes.toLocaleString()}` : "—"} />
              <Field label="Code" value={b.promo_code_text ?? "—"} />
            </div>
            <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
              <Field label="Payment" value={paymentStatusLabel(b.payment_status)} />
              <Field label="Payment Phone" value={b.payment_phone ?? b.guest_phone ?? "—"} />
              <Field label="Payment Ref" value={b.payment_reference ?? "—"} />
            </div>
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

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-sage-deep">{selectedBooking.guest_name}</DialogTitle>
                <DialogDescription>
                  {selectedBooking.pod_name} · {fmtDate(selectedBooking.check_in)} → {fmtDate(selectedBooking.check_out)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge variant={statusVariant(selectedBooking.status)}>{selectedBooking.status}</Badge>
                <Badge variant={paymentStatusVariant(selectedBooking.payment_status)}>{paymentStatusLabel(selectedBooking.payment_status)}</Badge>
                {createWhatsAppUrl(selectedBooking) && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={createWhatsAppUrl(selectedBooking) ?? "#"} target="_blank" rel="noreferrer">
                      <MessageCircle size={14} className="mr-1" /> Send for Confirmation
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <a href={createGoogleCalendarUrl(selectedBooking)} target="_blank" rel="noreferrer">
                    <CalendarPlus size={14} className="mr-1" /> Add to Google Calendar
                  </a>
                </Button>
                {(selectedBooking.status === "confirmed" || selectedBooking.status === "pending") && (
                  <Button size="sm" variant="outline" onClick={() => requestPaymentPrompt(selectedBooking)} disabled={busyId === selectedBooking.id}>
                    <CreditCard size={14} className="mr-1" /> Send M-Pesa Prompt
                  </Button>
                )}
                {selectedBooking.status === "confirmed" && (
                  <Button size="sm" variant="outline" onClick={() => sendApprovalEmail(selectedBooking)} disabled={busyId === selectedBooking.id}>
                    <Mail size={14} className="mr-1" /> Email Approval
                  </Button>
                )}
                {selectedBooking.status === "confirmed" && (
                  <Button size="sm" variant="outline" onClick={() => sendApprovalWhatsApp(selectedBooking)} disabled={busyId === selectedBooking.id}>
                    <MessageCircle size={14} className="mr-1" /> WhatsApp Approval
                  </Button>
                )}
                {selectedBooking.payment_request_location && (
                  <Button size="sm" variant="outline" onClick={() => refreshPaymentStatus(selectedBooking)} disabled={busyId === selectedBooking.id}>
                    <RefreshCcw size={14} className="mr-1" /> Refresh Payment
                  </Button>
                )}
                {selectedBooking.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => setStatus(selectedBooking, "confirmed")} disabled={busyId === selectedBooking.id}>
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(selectedBooking, "cancelled")} disabled={busyId === selectedBooking.id}>
                      <X size={14} className="mr-1" /> Decline
                    </Button>
                  </>
                )}
                {selectedBooking.status !== "pending" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(selectedBooking, "pending")} disabled={busyId === selectedBooking.id}>
                    <RotateCcw size={14} className="mr-1" /> Move to Pending
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <Field label="Email" value={selectedBooking.guest_email} />
                  <Field label="Phone" value={selectedBooking.guest_phone ?? "—"} />
                  <Field label="Booked on" value={fmtDate(selectedBooking.created_at)} />
                  <Field label="Rooms" value={String(selectedBooking.rooms)} />
                  <Field label="Adults" value={String(selectedBooking.adults)} />
                  <Field label="Children Under 12" value={String(selectedBooking.children)} />
                  <Field label="Guests 12+" value={String(selectedBooking.children_12_plus ?? 0)} />
                  <Field label="Payment Phone" value={selectedBooking.payment_phone ?? selectedBooking.guest_phone ?? "—"} />
                </div>
                <div className="space-y-3">
                  <Field label="Subtotal" value={`KES ${(selectedBooking.subtotal_kes ?? selectedBooking.total_kes ?? 0).toLocaleString()}`} />
                  <Field label="Discount" value={selectedBooking.discount_kes ? `KES ${selectedBooking.discount_kes.toLocaleString()}` : "—"} />
                  <Field label="Total" value={`KES ${(selectedBooking.total_kes ?? 0).toLocaleString()}`} />
                  <Field label="Code" value={selectedBooking.promo_code_text ?? "—"} />
                  <Field label="Pay To" value={`Till Number ${MPESA_TILL_NUMBER}`} />
                  <Field label="Payment Status" value={paymentStatusLabel(selectedBooking.payment_status)} />
                  <Field label="Payment Ref" value={selectedBooking.payment_reference ?? "—"} />
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm text-foreground/80 italic">"{selectedBooking.notes}"</p>
                </div>
              )}

              {selectedBooking.addons.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border/60">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Add-ons</p>
                  <ul className="text-sm space-y-1">
                    {selectedBooking.addons.map((addon, index) => (
                      <li key={index} className="flex justify-between gap-4">
                        <span>{addon.name} × {addon.quantity}</span>
                        <span className="text-muted-foreground">KES {addon.unit_price_kes.toLocaleString()} {addon.pricing_unit.split("_").join(" ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
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

export default AdminBookings;
