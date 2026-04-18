import heroImg from "@/assets/hero-lera.jpg";
import landscapeImg from "@/assets/landscape.jpg";
import pod1 from "@/assets/pod-1.jpg";
import pod2 from "@/assets/pod-2.jpg";
import { BookingBar } from "@/components/booking/BookingBar";
import { Link } from "react-router-dom";
import { ArrowRight, Leaf, Mountain, Coffee } from "lucide-react";
import { usePods } from "@/hooks/usePods";
import { useSiteContent, sc } from "@/hooks/useSiteContent";

const podImages: Record<string, string> = {
  "glamping-pod-1": pod2,
  "glamping-pod-2": pod1,
};

const Home = () => {
  const { data: pods = [] } = usePods();
  const { data: content } = useSiteContent();

  return (
    <>
      {/* HERO */}
      <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt="Glamping pods at Wild By LERA at golden hour with Lake Elementaita in the distance"
            className="w-full h-full object-cover ken-burns"
            width={1920}
            height={1280}
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-transparent to-ink/70" />
        </div>

        <div className="relative h-full container flex flex-col justify-center pt-24 md:pt-32">
          <p className="reveal text-bone/80 text-xs md:text-sm uppercase tracking-[0.4em] mb-6">
            {sc(content, "home.hero.eyebrow", "Elementaita · Kenya")}
          </p>
          <h1 className="reveal reveal-delay-1 font-display text-bone text-[44px] leading-[0.95] sm:text-6xl md:text-7xl lg:text-[88px] max-w-4xl text-balance">
            {(() => {
              const title = sc(content, "home.hero.title", "Wild by LERA");
              const parts = title.split(/(\bby\b)/i);
              return parts.map((part, i) =>
                part.toLowerCase() === "by" ? <em key={i} className="italic font-light">{part}</em> : <span key={i}>{part}</span>
              );
            })()}
          </h1>
          <p className="reveal reveal-delay-2 mt-6 text-bone/85 text-lg md:text-xl max-w-xl font-extralight font-serif">
            {sc(content, "home.hero.subtitle", "WHERE NOTHING IS URGENT.")}
          </p>
        </div>

      </section>

      {/* Floating booking bar — overlaps hero/intro */}
      <div className="relative z-20 container -mt-16 md:-mt-20">
        <div className="reveal reveal-delay-3">
          <BookingBar />
        </div>
      </div>

      {/* INTRO */}
      <section className="container pt-20 md:pt-28 pb-20 md:pb-28 grid md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-5">
          <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">A haven in nature</p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-sage-deep leading-[1.05] text-balance">
            A return to slowness, in the heart of Elementaita.
          </h2>
        </div>
        <div className="md:col-span-6 md:col-start-7 space-y-5 text-foreground/80 text-lg leading-relaxed">
          <p>
            Welcome to Wild By LERA. Nestled in the heart of Elementaita, at the foot of a tranquil and beautiful hill called <em>The Sleeping Warrior</em>, LERA is a haven of warmth, tranquility and rejuvenation.
          </p>
          <p>
            Five hand-built triangular pods, two restaurants under acacia trees, and the long, quiet view of Lake Elementaita. Come for a night. Stay for the silence.
          </p>
          <Link to="/stays" className="inline-flex items-center gap-2 mt-2 text-sage-deep border-b border-sage-deep/40 pb-1 hover:border-sage-deep transition-colors">
            Discover the stays <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* VALUES */}
      <section className="bg-linen/60 py-20 md:py-28">
        <div className="container grid md:grid-cols-3 gap-12">
          {[
            { icon: Mountain, title: "Wild views", body: "Wake to the Sleeping Warrior, the conservancy and the lake — through a triangular glass facade." },
            { icon: Leaf, title: "Built with care", body: "Locally crafted timber pods. Eco-conscious systems. A footprint as light as the morning mist." },
            { icon: Coffee, title: "Slow mornings", body: "Breakfast included with every stay. Long walks, slow coffee, no agenda." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-3">
              <Icon className="text-ember" size={28} />
              <h3 className="font-display text-2xl text-sage-deep">{title}</h3>
              <p className="text-foreground/75 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PODS PREVIEW */}
      <section className="container py-24 md:py-32">
        <div className="flex items-end justify-between mb-12 md:mb-16">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ember mb-3">The Accommodations</p>
            <h2 className="font-display text-4xl md:text-5xl text-sage-deep">Five pods. Two perspectives.</h2>
          </div>
          <Link to="/stays" className="hidden md:inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-sage-deep hover:text-ember transition-colors">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {pods.map((p) => (
            <Link key={p.id} to="/stays" className="group block">
              <div className="aspect-[4/5] overflow-hidden mb-5 bg-linen">
                <img
                  src={podImages[p.slug] ?? pod1}
                  alt={p.name}
                  loading="lazy"
                  width={1280}
                  height={1280}
                  className="w-full h-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl md:text-3xl text-sage-deep">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">From KES {p.price_kes.toLocaleString()} / night</p>
                </div>
                <span className="text-sm uppercase tracking-[0.2em] text-ember group-hover:text-ember-deep transition-colors">Discover →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* QUOTE / LANDSCAPE */}
      <section className="relative h-[70vh] min-h-[460px] overflow-hidden">
        <img src={landscapeImg} alt="Lake Elementaita with The Sleeping Warrior hill at golden hour" className="absolute inset-0 w-full h-full object-cover" loading="lazy" width={1920} height={1080} />
        <div className="absolute inset-0 bg-ink/35" />
        <div className="relative h-full container flex items-center">
          <blockquote className="font-display text-bone text-3xl md:text-5xl lg:text-6xl max-w-3xl leading-[1.1] text-balance">
            "We didn't want to be louder than the wind. So we built quietly."
          </blockquote>
        </div>
      </section>
    </>
  );
};

export default Home;
