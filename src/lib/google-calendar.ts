import type { AdminBooking } from "@/hooks/useAdminBookings";

const formatGoogleDate = (value: string) => value.replaceAll("-", "");

export const createGoogleCalendarUrl = (booking: Pick<
  AdminBooking,
  | "guest_name"
  | "guest_email"
  | "guest_phone"
  | "pod_name"
  | "check_in"
  | "check_out"
  | "adults"
  | "children"
  | "children_12_plus"
  | "rooms"
  | "notes"
>) => {
  const title = `${booking.pod_name ?? "Booking"} — ${booking.guest_name}`;
  const details = [
    `Guest: ${booking.guest_name}`,
    `Email: ${booking.guest_email}`,
    `Phone: ${booking.guest_phone ?? "—"}`,
    `Pod: ${booking.pod_name ?? "—"}`,
    `Guests: ${booking.adults} adults, ${booking.children} children under 12, ${booking.children_12_plus} guests aged 12+`,
    `Rooms: ${booking.rooms}`,
    booking.notes ? `Notes: ${booking.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGoogleDate(booking.check_in)}/${formatGoogleDate(booking.check_out)}`,
    details,
    location: "Wild by LERA, Elementaita, Kenya",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
