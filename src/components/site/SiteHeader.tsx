import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "fixed top-0 inset-x-0 z-50 transition-[background-color,backdrop-filter,box-shadow] duration-500",
        transparent
          ? "bg-transparent"
          : "bg-bone/85 backdrop-blur-md shadow-soft"
      )}
    >
      <div className="container flex items-center justify-between py-4 md:py-5">
        <Link to="/" className="flex items-baseline gap-2 group">
          <span
            className={cn(
              "font-display text-2xl md:text-[28px] tracking-tight transition-colors",
              transparent ? "text-bone" : "text-sage-deep"
            )}
          >
            Wild <span className="italic font-light opacity-80">by</span> LERA
          </span>
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
        <div className="md:hidden border-t border-border/60 bg-bone/95 backdrop-blur-md">
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
