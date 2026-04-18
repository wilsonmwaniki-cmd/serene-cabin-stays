import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePodImages } from "@/hooks/usePodImages";
import { cn } from "@/lib/utils";

type Props = { podId: string };

export const PodGallery = ({ podId }: Props) => {
  const { data: images = [], isLoading } = usePodImages(podId);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (isLoading || images.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">Gallery</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setOpenIdx(i)}
            className={cn(
              "group relative aspect-[4/3] overflow-hidden bg-linen",
              "focus:outline-none focus:ring-2 focus:ring-sage-deep"
            )}
            aria-label={img.alt ?? "Open image"}
          >
            <img
              src={img.url}
              alt={img.alt ?? ""}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </button>
        ))}
      </div>

      <Dialog open={openIdx !== null} onOpenChange={(o) => !o && setOpenIdx(null)}>
        <DialogContent className="max-w-5xl p-0 bg-transparent border-0 shadow-none">
          {openIdx !== null && (
            <img
              src={images[openIdx].url}
              alt={images[openIdx].alt ?? ""}
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
