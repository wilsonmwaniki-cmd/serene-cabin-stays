import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-wildbylera.png";

const links = [
  { to: "/", label: "Home" },
  { to: "/stays", label: "Stays" },
  { to: "/restaurant", label: "The Restaurant" },
  { to: "/contact", label: "Contact" },
];

export const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const transparent = isHome && !scrolled && !open;

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-[background-color,backdrop-filter,box-shadow,border-color] duration-500",
        transparent
          ? "bg-transparent"
          : "border-b border-white/20 bg-bone/50 shadow-soft backdrop-blur-xl supports-[backdrop-filter]:bg-bone/35"
      )}
    >
      {!transparent && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-bone/10 to-transparent" />
      )}
      <div className="container flex items-center justify-between py-4 md:py-5">
        <Link to="/" className="flex items-center group" aria-label="Wild by LERA — Home">
          <img
            src={logo}
            alt="Wild by LERA"
            className={cn(
              "h-20 md:h-24 w-auto object-contain transition-[filter] duration-500",
              transparent ? "brightness-0 invert" : ""
            )}
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <RouterNavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "text-sm tracking-wide uppercase transition-colors relative",
                  transparent
                    ? "text-bone/90 hover:text-bone"
                    : "text-foreground/80 hover:text-sage-deep",
                  isActive && "after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:bg-current"
                )
              }
            >
              {l.label}
            </RouterNavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/contact#booking"
            className={cn(
              "inline-flex items-center px-5 py-2.5 text-sm tracking-wide border transition-all",
              transparent
                ? "border-bone/60 text-bone hover:bg-bone hover:text-sage-deep"
                : "border-sage-deep text-sage-deep hover:bg-sage-deep hover:text-bone"
            )}
          >
            Book Now
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "md:hidden p-2 -mr-2",
            transparent ? "text-bone" : "text-sage-deep"
          )}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/20 bg-bone/55 backdrop-blur-xl supports-[backdrop-filter]:bg-bone/40">
          <nav className="container flex flex-col py-6 gap-1">
            {links.map((l) => (
              <RouterNavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "py-3 font-display text-2xl tracking-tight transition-colors",
                    isActive ? "text-sage-deep" : "text-foreground/70"
                  )
                }
              >
                {l.label}
              </RouterNavLink>
            ))}
            <Link
              to="/contact#booking"
              className="mt-4 inline-flex items-center justify-center px-5 py-3 bg-sage-deep text-bone text-sm tracking-wide"
            >
              Book Now
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
