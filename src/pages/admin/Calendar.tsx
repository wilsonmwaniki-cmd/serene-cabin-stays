import { useMemo, useState } from "react";
import { addDays, format, isAfter, isBefore, isSameDay, parseISO, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useAdminBookings } from "@/hooks/useAdminBookings";
import { cn } from "@/lib/utils";

const stayEndDate = (checkIn: string, checkOut: string) => {
  const start = parseISO(checkIn);
  const rawEnd = subDays(parseISO(checkOut), 1);
  return isBefore(rawEnd, start) ? start : rawEnd;
};

const bookingIncludesDate = (checkIn: string, checkOut: string, date: Date) => {
  const start = parseISO(checkIn);
  const end = stayEndDate(checkIn, checkOut);
  return (isSameDay(date, start) || isAfter(date, start)) && (isSameDay(date, end) || isBefore(date, end));
};

const statusTone = (status: "pending" | "confirmed" | "cancelled") =>
  status === "confirmed" ? "default" : status === "cancelled" ? "destructive" : "secondary";

const AdminCalendar = () => {
  const { data: bookings = [], isLoading } = useAdminBookings();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const modifiers = useMemo(() => ({
    pending: bookings
      .filter((booking) => booking.status === "pending")
      .map((booking) => ({ from: parseISO(booking.check_in), to: stayEndDate(booking.check_in, booking.check_out) })),
    confirmed: bookings
      .filter((booking) => booking.status === "confirmed")
      .map((booking) => ({ from: parseISO(booking.check_in), to: stayEndDate(booking.check_in, booking.check_out) })),
    cancelled: bookings
      .filter((booking) => booking.status === "cancelled")
      .map((booking) => ({ from: parseISO(booking.check_in), to: stayEndDate(booking.check_in, booking.check_out) })),
  }), [bookings]);

  const bookingsForDay = useMemo(
    () => bookings.filter((booking) => bookingIncludesDate(booking.check_in, booking.check_out, selectedDate)),
    [bookings, selectedDate],
  );

  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter((booking) => booking.status === "pending").length,
    confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
  }), [bookings]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Reservations</p>
          <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-2">See all bookings by month and click any date to inspect who is staying.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 min-w-[280px]">
          <StatCard label="All bookings" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} tone="pending" />
          <StatCard label="Confirmed" value={stats.confirmed} tone="confirmed" />
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,420px)_1fr] gap-8 items-start">
        <div className="border border-border/60 bg-bone/70 p-4 md:p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <CalendarIcon size={16} />
            <span>{format(selectedDate, "EEEE, MMM d, yyyy")}</span>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            modifiers={modifiers}
            modifiersClassNames={{
              pending: "bg-amber-200 text-amber-900 rounded-md",
              confirmed: "bg-sage-deep text-bone rounded-md",
              cancelled: "bg-rose-200 text-rose-900 rounded-md line-through",
            }}
            className="rounded-md border border-border bg-background"
          />
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
            <LegendChip label="Confirmed" className="bg-sage-deep text-bone" />
            <LegendChip label="Pending" className="bg-amber-200 text-amber-900" />
            <LegendChip label="Cancelled" className="bg-rose-200 text-rose-900" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl text-sage-deep">Bookings on {format(selectedDate, "MMM d, yyyy")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {bookingsForDay.length === 0 ? "No one is booked for this day." : `${bookingsForDay.length} booking${bookingsForDay.length === 1 ? "" : "s"} on this date.`}
            </p>
          </div>

          {isLoading && <p className="text-muted-foreground">Loading…</p>}

          {!isLoading && bookingsForDay.length === 0 && (
            <div className="border border-dashed border-border bg-bone/40 p-6 text-sm text-muted-foreground">
              Nothing scheduled for this date.
            </div>
          )}

          <div className="space-y-4">
            {bookingsForDay.map((booking) => (
              <article key={booking.id} className="border border-border/60 bg-bone/40 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display text-xl text-sage-deep">{booking.guest_name}</h3>
                      <Badge variant={statusTone(booking.status)}>{booking.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {booking.pod_name} · {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {booking.rooms} room{booking.rooms === 1 ? "" : "s"} · {booking.adults} adult{booking.adults === 1 ? "" : "s"} · {booking.children} child{booking.children === 1 ? "" : "ren"}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <InfoLine label="Email" value={booking.guest_email} />
                  <InfoLine label="Phone" value={booking.guest_phone ?? "—"} />
                  <InfoLine label="Booked on" value={format(parseISO(booking.created_at), "MMM d, yyyy")} />
                </div>

                {booking.notes && <p className="mt-4 text-sm text-foreground/75 italic">"{booking.notes}"</p>}
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "pending" | "confirmed" }) => (
  <div className={cn(
    "border border-border/60 p-4 bg-bone/60",
    tone === "pending" && "bg-amber-50",
    tone === "confirmed" && "bg-sage-deep/5",
  )}>
    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</div>
    <div className="font-display text-3xl text-sage-deep">{value}</div>
  </div>
);

const LegendChip = ({ label, className }: { label: string; className: string }) => (
  <span className={cn("inline-flex items-center gap-2", className, "rounded-full px-3 py-1")}>
    <span className="h-2 w-2 rounded-full bg-current opacity-70" />
    {label}
  </span>
);

const InfoLine = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</div>
    <div className="text-foreground/90 break-words">{value}</div>
  </div>
);

export default AdminCalendar;
