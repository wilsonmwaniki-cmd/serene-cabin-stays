import { InquiryForm } from "@/components/booking/InquiryForm";
import { usePods } from "@/hooks/usePods";
import { useSiteContent, sc } from "@/hooks/useSiteContent";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

const Contact = () => {
  const { data: pods = [] } = usePods();
  const { data: content } = useSiteContent();
  return (
    <>
      <section className="pt-36 md:pt-44 pb-16 container">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">Find Us</p>
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-sage-deep max-w-3xl text-balance">
          Come and stay a while.
        </h1>
        <p className="mt-5 text-lg text-foreground/75 max-w-2xl">
          About 90 minutes from Nairobi, just past Lake Elementaita. The road quiets. The hills open. You're here.
        </p>
      </section>

      <section className="container grid lg:grid-cols-12 gap-12 pb-24">
        <aside className="lg:col-span-4 space-y-8">
          <Info icon={<MapPin />} label="Location" value={sc(content, "contact.address", "Kekopey, Gilgil, Kenya")} />
          <Info icon={<Phone />} label="Telephone" value={<a href={`tel:${sc(content, "contact.phone", "+254725744695").replace(/\s/g, "")}`} className="hover:text-ember">{sc(content, "contact.phone", "+254 725744695")}</a>} />
          <Info icon={<Mail />} label="Email" value={<a href={`mailto:${sc(content, "contact.email", "bookings@lera.co.ke")}`} className="hover:text-ember">{sc(content, "contact.email", "bookings@lera.co.ke")}</a>} />
          <Info icon={<Clock />} label="Reception" value="8am — 9pm daily · Check-in from 3pm" />

          <div className="aspect-[4/3] overflow-hidden border border-border">
            <iframe
              title="Wild By LERA location"
              src="https://www.openstreetmap.org/export/embed.html?bbox=36.20%2C-0.50%2C36.30%2C-0.42&layer=mapnik&marker=-0.46,36.25"
              className="w-full h-full"
              loading="lazy"
            />
          </div>
        </aside>

        <div id="booking" className="lg:col-span-8 bg-linen/50 p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl text-sage-deep mb-2">Request your stay</h2>
          <p className="text-muted-foreground mb-8">We confirm personally — usually within a few hours.</p>
          {pods.length > 0 && <InquiryForm pods={pods} />}
        </div>
      </section>
    </>
  );
};

const Info = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-3 text-ember mb-1">
      <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      <span className="text-[11px] uppercase tracking-[0.25em]">{label}</span>
    </div>
    <p className="font-display text-xl text-sage-deep">{value}</p>
  </div>
);

export default Contact;
