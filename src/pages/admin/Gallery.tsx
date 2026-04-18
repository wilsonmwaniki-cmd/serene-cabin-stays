import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePods } from "@/hooks/usePods";
import { usePodImages, podImagesBucket, type PodImage } from "@/hooks/usePodImages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Trash2, UploadCloud, ImageIcon } from "lucide-react";

const PodSection = ({ podId, name }: { podId: string; name: string }) => {
  const { data: images = [] } = usePodImages(podId);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [alt, setAlt] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PodImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: list.length });
    let baseOrder = images.length;
    let success = 0;
    try {
      for (const file of list) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${podId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(podImagesBucket)
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("pod_images").insert({
          pod_id: podId, storage_path: path, alt: alt || null, display_order: baseOrder++,
        });
        if (insErr) throw insErr;
        success += 1;
        setProgress({ done: success, total: list.length });
      }
      setAlt("");
      qc.invalidateQueries({ queryKey: ["pod_images", podId] });
      toast({ title: "Upload complete", description: `${success} image${success === 1 ? "" : "s"} added to ${name}.` });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["pod_images", podId] });
      toast({
        title: "Upload error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const img = pendingDelete;
    setPendingDelete(null);
    await supabase.storage.from(podImagesBucket).remove([img.storage_path]);
    const { error } = await supabase.from("pod_images").delete().eq("id", img.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["pod_images", podId] });
      toast({ title: "Image removed" });
    }
  };

  return (
    <section className="border border-border/60 bg-bone/40 overflow-hidden">
      <header className="flex items-end justify-between gap-4 px-5 md:px-6 py-4 border-b border-border/60 bg-bone/60">
        <div>
          <h2 className="font-display text-2xl text-sage-deep leading-tight">{name}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {images.length} image{images.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0"
        >
          {uploading ? (
            <><Loader2 size={16} className="mr-2 animate-spin" /> Uploading…</>
          ) : (
            <><ImagePlus size={16} className="mr-2" /> Upload images</>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </header>

      <div className="p-5 md:p-6 space-y-5">
        <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <Label htmlFor={`alt-${podId}`} className="text-xs uppercase tracking-wider text-muted-foreground">
              Alt text for next batch <span className="normal-case text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              id={`alt-${podId}`}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="e.g. Sunset view from the deck"
              className="mt-1.5"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            upload(e.dataTransfer.files);
          }}
          disabled={uploading}
          className={cn(
            "w-full border border-dashed rounded-sm px-6 py-8 flex flex-col items-center justify-center gap-2 text-center transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-sage-deep/40",
            dragOver
              ? "border-sage-deep bg-sage-deep/5 text-sage-deep"
              : "border-border hover:border-sage-deep/60 hover:bg-bone/60 text-muted-foreground",
            uploading && "opacity-60 cursor-not-allowed"
          )}
        >
          <UploadCloud size={22} className={cn(dragOver ? "text-sage-deep" : "text-muted-foreground")} />
          <p className="text-sm">
            {progress
              ? `Uploading ${progress.done} of ${progress.total}…`
              : <><span className="font-medium text-foreground">Click to upload</span> or drag & drop</>}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
            JPG · PNG · WEBP — multiple files supported
          </p>
        </button>

        {images.length === 0 ? (
          <div className="border border-dashed border-border/70 py-10 flex flex-col items-center text-center text-muted-foreground">
            <ImageIcon size={20} className="mb-2 opacity-60" />
            <p className="text-sm">No images yet for this pod.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <figure
                key={img.id}
                className="group relative aspect-[4/3] bg-linen overflow-hidden border border-border/40"
              >
                <img
                  src={img.url}
                  alt={img.alt ?? ""}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {img.alt && (
                  <figcaption className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 text-[11px] text-bone opacity-0 group-hover:opacity-100 transition-opacity line-clamp-1">
                    {img.alt}
                  </figcaption>
                )}
                <button
                  type="button"
                  onClick={() => setPendingDelete(img)}
                  className="absolute top-2 right-2 p-1.5 bg-background/95 hover:bg-destructive hover:text-destructive-foreground rounded-sm opacity-0 group-hover:opacity-100 transition shadow-sm"
                  aria-label="Delete image"
                >
                  <Trash2 size={14} />
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the image from storage and the gallery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

const AdminGallery = () => {
  const { data: pods = [], isLoading } = usePods();
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Media</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Pod gallery</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Upload, organise and remove photos for each pod. Images appear on the public booking page in the order they were added.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading pods…</p>
      ) : (
        <div className="space-y-6">
          {pods.map((p) => <PodSection key={p.id} podId={p.id} name={p.name} />)}
        </div>
      )}
    </div>
  );
};

export default AdminGallery;
