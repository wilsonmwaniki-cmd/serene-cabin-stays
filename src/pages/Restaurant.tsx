import { useMemo } from "react";
import restaurantImg from "@/assets/restaurant.jpg";
import { Link } from "react-router-dom";
import { useRestaurantMenu } from "@/hooks/useRestaurantMenu";

const kes = (value: number) => `KES ${value.toLocaleString()}`;

const Restaurant = () => {
  const { data: menuItems = [], isLoading } = useRestaurantMenu();

  const grouped = useMemo(
    () =>
      menuItems.reduce<Record<string, typeof menuItems>>((acc, item) => {
        acc[item.section] = acc[item.section] ?? [];
        acc[item.section].push(item);
        return acc;
      }, {}),
    [menuItems],
  );

  return (
    <>
      <section className="relative min-h-[70vh] flex items-center">
        <img
          src={restaurantImg}
          alt="Restaurant tables at Wild By LERA"
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1200}
        />
        <div className="absolute inset-0 bg-ink/65" />
        <div className="relative container py-32 md:py-40">
          <p className="text-bone/80 text-xs uppercase tracking-[0.4em] mb-6">The Restaurant</p>
          <h1 className="font-display text-bone text-5xl md:text-7xl lg:text-[88px] leading-[0.95] max-w-4xl text-balance">
            Seasonal menu under the acacias.
          </h1>
          <p className="mt-8 text-bone/85 text-lg md:text-xl max-w-2xl font-extralight font-serif">
            Browse what is currently available, with prices included. We only show dishes that are active right now.
          </p>
        </div>
      </section>

      <section className="container py-20 md:py-28">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">Current menu</p>
            <h2 className="font-display text-4xl md:text-5xl text-sage-deep mb-5 text-balance">
              Choose what you would like us to prepare.
            </h2>
            <p className="text-foreground/75 leading-relaxed mb-4">
              Menu items appear here only when they are available. Prices are shown for each dish.
            </p>
            <p className="text-foreground/75 leading-relaxed">
              Tell us your meal choices in your booking notes, by WhatsApp, or when we confirm your stay.
            </p>
            <Link
              to="/contact#booking"
              className="inline-flex items-center mt-6 px-6 py-3 bg-sage-deep text-bone text-sm uppercase tracking-[0.2em] hover:bg-sage transition-colors"
            >
              Book your stay
            </Link>
          </div>

          <div className="lg:col-span-8">
            {isLoading && <p className="text-muted-foreground">Loading menu…</p>}

            {!isLoading && menuItems.length === 0 && (
              <div className="border border-border/60 bg-bone/40 p-8">
                <h3 className="font-display text-2xl text-sage-deep mb-3">Seasonal menu coming through shortly.</h3>
                <p className="text-foreground/75">
                  We are updating the currently available dishes. Please check back soon or message us directly.
                </p>
              </div>
            )}

            <div className="space-y-10">
              {Object.entries(grouped).map(([section, items]) => (
                <section key={section} className="border border-border/60 bg-bone/40 p-6 md:p-8">
                  <h3 className="font-display text-3xl text-sage-deep mb-6">{section}</h3>
                  <div className="space-y-5">
                    {items.map((item) => (
                      <article key={item.id} className="flex items-start justify-between gap-6 border-b border-border/50 pb-5 last:border-b-0 last:pb-0">
                        <div>
                          <h4 className="font-display text-2xl text-sage-deep">{item.title}</h4>
                          {item.description && (
                            <p className="text-foreground/75 mt-2 leading-relaxed">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display text-2xl text-sage-deep">{kes(item.price_kes)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Restaurant;
