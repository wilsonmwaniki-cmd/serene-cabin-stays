import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Maximize2, Users } from "lucide-react";
import { usePods } from "@/hooks/usePods";
import { InquiryForm } from "@/components/booking/InquiryForm";
import pod1 from "@/assets/pod-1.jpg";
import pod2 from "@/assets/pod-2.jpg";

const podImages: Record<string, string> = {
  "glamping-pod-1": pod2,
  "glamping-pod-2": pod1,
};

const BookPod = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const qs = params.toString();
  const { data: pods = [], isLoading } = usePods();
  const pod = pods.find((p) => p.slug === slug);

  if (isLoading) {
    return (
      <section className="pt-36 md:pt-44 pb-24 container">
        <p className="text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (!pod) {
    return (
      <section className="pt-36 md:pt-44 pb-24 container">
        <p className="text-foreground/75 mb-6">We couldn't find that pod.</p>
        <Link to="/book" className="text-sage-deep underline">Back to all pods</Link>
      </section>
    );
  }

  const surcharge = pod.surcharge_kes ?? 0;

  return (
    <>
      <section className="pt-36 md:pt-44 pb-10 container">
        <Link
          to={`/book${qs ? `?${qs}` : ""}`}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-ember mb-6 hover:text-ember-deep"
        >
          <ArrowLeft size={14} /> Choose a different pod
        </Link>
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
          <div className="md:col-span-6 bg-linen overflow-hidden">
            <img
              src={podImages[pod.slug] ?? pod1}
              alt={pod.name}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>
          <div className="md:col-span-6">
            <div className="text-xs uppercase tracking-[0.3em] text-ember mb-3">
              From KES {(pod.price_kes + surcharge).toLocaleString()} / night
              {surcharge > 0 && (
                <span className="text-muted-foreground normal-case tracking-normal ml-2">
                  (includes +KES {surcharge}/room surcharge)
                </span>
              )}
            </div>
            <h1 className="font-display text-4xl md:text-5xl text-sage-deep mb-5">
              Book {pod.name}
            </h1>
            <p className="text-foreground/75 leading-relaxed mb-5">{pod.description}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {pod.size_sqft && (
                <span className="inline-flex items-center gap-2">
                  <Maximize2 size={14} /> {pod.size_sqft} ft²
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <Users size={14} /> Sleeps {pod.capacity}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-linen/50 py-16 md:py-24">
        <div className="container max-w-3xl">
          <InquiryForm pods={[pod]} defaultPodId={pod.id} />
        </div>
      </section>
    </>
  );
};

export default BookPod;
