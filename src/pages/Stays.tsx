import { usePods } from "@/hooks/usePods";
import pod1 from "@/assets/pod-1.jpg";
import pod2 from "@/assets/pod-2.jpg";
import interior from "@/assets/pod-interior-v2.jpg";
import { InquiryForm } from "@/components/booking/InquiryForm";
import { PodGallery } from "@/components/pods/PodGallery";
import { Maximize2, Users } from "lucide-react";

const podImages: Record<string, string> = {
  "glamping-pod-1": pod2,
  "glamping-pod-2": pod1,
};

const Stays = () => {
  const { data: pods = [], isLoading } = usePods();

  return (
    <>
      <section className="pt-36 md:pt-44 pb-12 container">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">The Accommodations</p>
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-sage-deep max-w-3xl text-balance">
          Pods built around the view.
        </h1>
        <p className="mt-5 text-lg text-foreground/75 max-w-2xl">
          Each cabin is hand-built from local timber, with a triangular glass facade framing the savannah, the lake, or the hill.
        </p>
      </section>

      <section className="container pb-24 space-y-20 md:space-y-28">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {pods.map((pod, i) => (
          <article key={pod.id} className={`grid md:grid-cols-12 gap-8 md:gap-14 items-center ${i % 2 === 1 ? "md:[&>div:first-child]:order-2" : ""}`}>
            <div className="md:col-span-7 bg-linen overflow-hidden">
              <img src={podImages[pod.slug] ?? pod1} alt={pod.name} loading="lazy" width={1280} height={960} className="w-full h-auto object-contain" />
            </div>
            <div className="md:col-span-5">
              <div className="text-xs uppercase tracking-[0.3em] text-ember mb-3">From KES {pod.price_kes.toLocaleString()} / night</div>
              <h2 className="font-display text-4xl md:text-5xl text-sage-deep mb-5">{pod.name}</h2>
              <p className="text-foreground/75 leading-relaxed mb-6">{pod.description}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-6">
                {pod.size_sqft && <span className="inline-flex items-center gap-2"><Maximize2 size={14} /> {pod.size_sqft} ft²</span>}
                <span className="inline-flex items-center gap-2"><Users size={14} /> {pod.capacity} guests</span>
              </div>
              <ul className="grid grid-cols-2 gap-y-2 text-sm text-foreground/80">
                {pod.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-ember before:rounded-full">{a}</li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-12">
              <PodGallery podId={pod.id} />
            </div>
          </article>
        ))}
      </section>

      {/* Interior strip */}
      <section className="relative h-[60vh] min-h-[420px]">
        <img src={interior} alt="Inside an A-frame pod looking out to the Kenyan landscape" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      </section>

      {/* Booking */}
      <section id="availability" className="bg-linen/50 py-24 md:py-32">
        <div className="container grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">Reserve</p>
            <h2 className="font-display text-4xl md:text-5xl text-sage-deep mb-5 text-balance">Check availability and request your stay.</h2>
            <p className="text-foreground/75 leading-relaxed">We'll confirm by email within a few hours. No payment required to hold an inquiry.</p>
          </div>
          <div className="lg:col-span-7">
            {pods.length > 0 && <InquiryForm pods={pods} />}
          </div>
        </div>
      </section>
    </>
  );
};

export default Stays;
