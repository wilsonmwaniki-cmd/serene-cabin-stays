import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Maximize2, Users } from "lucide-react";
import { usePods } from "@/hooks/usePods";
import pod1 from "@/assets/pod-1.jpg";
import pod2 from "@/assets/pod-2.jpg";

const podImages: Record<string, string> = {
  "glamping-pod-1": pod2,
  "glamping-pod-2": pod1,
};

const Book = () => {
  const { data: pods = [], isLoading } = usePods();
  const [params] = useSearchParams();
  const qs = params.toString();

  return (
    <section className="pt-36 md:pt-44 pb-24 container">
      <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">Reserve</p>
      <h1 className="font-display text-5xl md:text-6xl text-sage-deep max-w-3xl text-balance mb-5">
        Choose your pod.
      </h1>
      <p className="text-foreground/75 max-w-2xl mb-12">
        Both pods share the same view and quiet — Pod 2 is slightly larger and carries a small surcharge per night.
      </p>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      <div className="grid md:grid-cols-2 gap-8 md:gap-10">
        {pods.map((pod) => {
          const surcharge = pod.surcharge_kes ?? 0;
          return (
            <Link
              key={pod.id}
              to={`/book/${pod.slug}${qs ? `?${qs}` : ""}`}
              className="group bg-bone border border-border hover:border-ember transition-colors flex flex-col"
            >
              <div className="bg-linen overflow-hidden aspect-[4/3]">
                <img
                  src={podImages[pod.slug] ?? pod1}
                  alt={pod.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
              <div className="p-6 md:p-8 flex flex-col flex-1">
                <div className="text-xs uppercase tracking-[0.3em] text-ember mb-2">
                  From KES {(pod.price_kes + surcharge).toLocaleString()} / night
                  {surcharge > 0 && <span className="text-muted-foreground normal-case tracking-normal ml-2">(+KES {surcharge}/room)</span>}
                </div>
                <h2 className="font-display text-3xl md:text-4xl text-sage-deep mb-3">{pod.name}</h2>
                <p className="text-foreground/75 text-sm leading-relaxed mb-5 flex-1">{pod.description}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground mb-6">
                  {pod.size_sqft && (
                    <span className="inline-flex items-center gap-2">
                      <Maximize2 size={14} /> {pod.size_sqft} ft²
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <Users size={14} /> {pod.capacity} guests
                  </span>
                </div>
                <span className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-sage-deep group-hover:text-ember transition-colors">
                  Book {pod.name} <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default Book;
