import { useState } from "react";
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
  children: number;
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

export const BookingBar = ({ variant = "floating", onSubmit }: Props) => {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState<Date>(todayPlus(1));
  const [checkOut, setCheckOut] = useState<Date>(todayPlus(2));
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const submit = () => {
    const q: BookingQuery = { checkIn, checkOut, rooms, adults, children };
    if (onSubmit) return onSubmit(q);
    const params = new URLSearchParams({
      in: format(checkIn, "yyyy-MM-dd"),
      out: format(checkOut, "yyyy-MM-dd"),
      rooms: String(rooms),
      adults: String(adults),
      children: String(children),
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
      <DateField label="Check In" value={checkIn} onChange={(d) => { setCheckIn(d); if (d >= checkOut) setCheckOut(todayPlus(((d.getTime() - todayPlus(0).getTime()) / 86400000) + 1)); }} disabled={(d) => d < todayPlus(0)} />
      <DateField label="Check Out" value={checkOut} onChange={setCheckOut} disabled={(d) => d <= checkIn} />

      <Field label="Rooms" icon={<BedDouble size={16} />}>
        <Select value={String(rooms)} onValueChange={(v) => setRooms(Number(v))}>
          <SelectTrigger className="border-0 bg-transparent h-auto p-0 font-display text-lg shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "Room" : "Rooms"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Guests" icon={<Users size={16} />}>
        <Popover>
          <PopoverTrigger className="text-left font-display text-lg w-full">
            {adults} Adult{adults !== 1 && "s"}, {children} Child{children !== 1 && "ren"}
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={10} />
            <Stepper label="Children" value={children} onChange={setChildren} min={0} max={10} />
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
        {format(value, "dd MMM yyyy")}
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
