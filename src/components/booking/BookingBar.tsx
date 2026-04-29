import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, Users, BedDouble } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type BookingQuery = {
  checkIn: Date;
  checkOut: Date;
  rooms: number;
  adults: number;
  childrenUnder12: number;
  children12Plus: number;
};

interface Props {
  variant?: "floating" | "inline";
  onSubmit?: (q: BookingQuery) => void;
}

const todayPlus = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

const MAX_BOOKING_WINDOW_DAYS = 365;
const maxBookDate = todayPlus(MAX_BOOKING_WINDOW_DAYS);

export const BookingBar = ({ variant = "floating", onSubmit }: Props) => {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState<Date>(todayPlus(1));
  const [checkOut, setCheckOut] = useState<Date>(todayPlus(3));
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [childrenUnder12, setChildrenUnder12] = useState(0);
  const [children12Plus, setChildren12Plus] = useState(0);
  const totalGuests = adults + childrenUnder12 + children12Plus;
  const minimumRooms = Math.max(1, Math.ceil(totalGuests / 2));

  useEffect(() => {
    if (rooms < minimumRooms) {
      setRooms(minimumRooms);
    }
  }, [rooms, minimumRooms]);

  const submit = () => {
    const q: BookingQuery = { checkIn, checkOut, rooms, adults, childrenUnder12, children12Plus };
    if (onSubmit) return onSubmit(q);
    const params = new URLSearchParams({
      in: format(checkIn, "yyyy-MM-dd"),
      out: format(checkOut, "yyyy-MM-dd"),
      rooms: String(rooms),
      adults: String(adults),
      children: String(childrenUnder12),
      children12plus: String(children12Plus),
    });
    navigate(`/book?${params.toString()}`);
  };

  return (
    <div
      className={cn(
        "grid gap-px bg-sage-deep/15 overflow-hidden",
        variant === "floating"
          ? "rounded-sm shadow-lift bg-bone/95 backdrop-blur md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
          : "border border-border bg-card md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      )}
    >
      <DateField
        label="Check In"
        value={checkIn}
        onChange={(d) => {
          setCheckIn(d);
          const minimumCheckOut = new Date(d);
          minimumCheckOut.setDate(minimumCheckOut.getDate() + 2);
          if (minimumCheckOut >= checkOut) {
            setCheckOut(minimumCheckOut > maxBookDate ? maxBookDate : minimumCheckOut);
          }
        }}
        disabled={(d) => d < todayPlus(0) || d > todayPlus(MAX_BOOKING_WINDOW_DAYS - 2)}
      />
      <DateField
        label="Check Out"
        value={checkOut}
        onChange={setCheckOut}
        disabled={(d) => {
          const minimumCheckOut = new Date(checkIn);
          minimumCheckOut.setDate(minimumCheckOut.getDate() + 2);
          return d < minimumCheckOut || d > maxBookDate;
        }}
      />

      <Field label="Rooms" icon={<BedDouble size={16} />}>
        <Select value={String(rooms)} onValueChange={(v) => setRooms(Math.max(minimumRooms, Number(v)))}>
          <SelectTrigger className="border-0 bg-transparent h-auto p-0 font-display text-lg shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => n >= minimumRooms).map((n) => (
              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "Room" : "Rooms"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">2 guests per cabin. {totalGuests} guest{totalGuests === 1 ? "" : "s"} need {minimumRooms} room{minimumRooms === 1 ? "" : "s"} minimum.</p>
      </Field>

      <Field label="Guests" icon={<Users size={16} />}>
        <Popover>
          <PopoverTrigger className="text-left font-display text-lg w-full">
            {adults} Adult{adults !== 1 && "s"}, {childrenUnder12} Child{childrenUnder12 !== 1 && "ren"} under 12, {children12Plus} Guest{children12Plus !== 1 && "s"} 12+
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={10} />
            <Stepper label="Children under 12" value={childrenUnder12} onChange={setChildrenUnder12} min={0} max={10} />
            <Stepper label="Guests 12+" value={children12Plus} onChange={setChildren12Plus} min={0} max={10} />
          </PopoverContent>
        </Popover>
      </Field>

      <button
        onClick={submit}
        className="bg-ember hover:bg-ember-deep text-accent-foreground px-8 py-5 md:px-10 font-medium tracking-wide transition-colors text-sm uppercase"
      >
        Check Availability
      </button>
    </div>
  );
};

const Field = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-bone/95 px-5 py-4 md:py-5">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
      {icon} {label}
    </div>
    <div className="text-foreground">{children}</div>
  </div>
);

const DateField = ({ label, value, onChange, disabled }: { label: string; value: Date; onChange: (d: Date) => void; disabled?: (d: Date) => boolean }) => (
  <div className="bg-bone/95 px-5 py-4 md:py-5">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
      <CalendarIcon size={16} /> {label}
    </div>
    <Popover>
      <PopoverTrigger className="text-left font-display text-lg w-full">
        {format(value, "dd/MM/yyyy")}
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto">
        <Calendar mode="single" selected={value} onSelect={(d) => d && onChange(d)} disabled={disabled} initialFocus />
      </PopoverContent>
    </Popover>
  </div>
);

const Stepper = ({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm">{label}</span>
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 border border-border hover:bg-secondary transition-colors">−</button>
      <span className="w-6 text-center font-display">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="w-8 h-8 border border-border hover:bg-secondary transition-colors">+</button>
    </div>
  </div>
);
