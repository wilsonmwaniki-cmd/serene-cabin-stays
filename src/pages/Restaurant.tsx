import restaurantImg from "@/assets/restaurant.jpg";
import { Link } from "react-router-dom";
import { useSiteContent, sc } from "@/hooks/useSiteContent";

const dishes = [
  { name: "Slow-roasted lamb", note: "with rosemary potatoes & garden greens" },
  { name: "Lake-side breakfast", note: "fresh fruit, eggs, sourdough, local honey" },
  { name: "Grilled tilapia", note: "from Lake Naivasha, with charred vegetables" },
  { name: "Open-fire flatbreads", note: "baked under the acacia, shared at the table" },
];

const Restaurant = () => {
  const { data: content } = useSiteContent();
  return (
    <>
      <section className="relative h-[80vh] min-h-[520px]">
        <img src={restaurantImg} alt="Candlelit dinner table at Wild By LERA at sunset" className="absolute inset-0 w-full h-full object-cover" width={1600} height={1200} />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink/70" />
        <div className="relative container h-full flex flex-col justify-end pb-16 md:pb-24">
          <p className="text-bone/80 text-xs uppercase tracking-[0.4em] mb-4">The Restaurant</p>
          <h1 className="font-display text-bone text-5xl md:text-7xl lg:text-[80px] leading-[0.95] max-w-3xl text-balance">
            Tables under the acacia.
          </h1>
        </div>
      </section>

      <section className="container py-24 md:py-32 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-5">
          <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">Open daily</p>
          <h2 className="font-display text-4xl md:text-5xl text-sage-deep text-balance">
            {sc(content, "restaurant.intro.title", "A short menu, cooked slowly.")}
          </h2>
        </div>
        <div className="md:col-span-6 md:col-start-7 text-foreground/80 text-lg leading-relaxed space-y-4">
          <p>{sc(content, "restaurant.intro.body", "We change the menu with what the day offers — produce from the kitchen garden, fish from the lake, bread baked on the open fire. Breakfast is included with every stay.")}</p>
          <p>Dinner is served by candlelight from 6:30pm. Bookings recommended.</p>
        </div>
      </section>

      <section className="bg-linen/60 py-24 md:py-28">
        <div className="container max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-ember mb-6 text-center">A taste of the table</p>
          <ul className="divide-y divide-border">
            {dishes.map((d) => (
              <li key={d.name} className="py-6 flex items-baseline gap-6">
                <span className="font-display text-2xl md:text-3xl text-sage-deep flex-1">{d.name}</span>
                <span className="text-muted-foreground italic text-right">{d.note}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 text-center">
            <Link to="/contact#booking" className="inline-flex items-center px-8 py-4 bg-sage-deep text-bone text-sm uppercase tracking-[0.2em] hover:bg-sage transition-colors">
              Reserve a table
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default Restaurant;
