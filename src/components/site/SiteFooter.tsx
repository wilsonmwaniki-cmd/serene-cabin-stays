import { Link } from "react-router-dom";
import { Instagram, Mail, Phone, MapPin } from "lucide-react";

export const SiteFooter = () => {
  return (
    <footer className="bg-sage-deep text-bone/85 mt-24">
      <div className="container py-16 md:py-20 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-display text-3xl md:text-4xl text-bone leading-tight max-w-md text-balance">
            Slow. Silent. Intentional.
          </p>
          <p className="mt-4 text-bone/70 max-w-sm">
            A haven of warmth and tranquility at the foot of The Sleeping Warrior, overlooking Lake Elementaita.
          </p>
        </div>

        <div className="md:col-span-3">
          <h4 className="text-xs uppercase tracking-[0.2em] text-bone/60 mb-4">Visit</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/stays" className="hover:text-bone transition-colors">Stays</Link></li>
            <li><Link to="/restaurant" className="hover:text-bone transition-colors">The Restaurant</Link></li>
            <li><Link to="/contact" className="hover:text-bone transition-colors">Contact</Link></li>
            <li><Link to="/contact#booking" className="hover:text-bone transition-colors">Book Now</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <h4 className="text-xs uppercase tracking-[0.2em] text-bone/60 mb-4">Reach Us</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0" /> Elementaita, Nakuru, Kenya</li>
            <li className="flex items-center gap-3"><Phone size={16} /> <a href="tel:+254725744695" className="hover:text-bone">+254 725 744 695</a></li>
            <li className="flex items-center gap-3"><Mail size={16} /> <a href="mailto:bookings@lera.co.ke" className="hover:text-bone">bookings@lera.co.ke</a></li>
            <li className="flex items-center gap-3"><Instagram size={16} /> <a href="#" className="hover:text-bone">@wildbylera</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-bone/10">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-bone/50">
          <p>© {new Date().getFullYear()} Wild by LERA. All rights reserved.</p>
          <p>Where nothing is urgent.</p>
        </div>
      </div>
    </footer>
  );
};
