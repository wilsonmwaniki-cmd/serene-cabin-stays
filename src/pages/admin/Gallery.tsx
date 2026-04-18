import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePods } from "@/hooks/usePods";
import { usePodImages, podImagesBucket } from "@/hooks/usePodImages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

const PodSection = ({ podId, name }: { podId: string; name: string }) => {
  const { data: images = [] } = usePodImages(podId);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [alt, setAlt] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${podId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(podImagesBucket).upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("pod_images").insert({
          pod_id: podId, storage_path: path, alt: alt || null, display_order: images.length,
        });
        if (insErr) throw insErr;
      }
      setAlt("");
      qc.invalidateQueries({ queryKey: ["pod_images", podId] });
      toast({ title: "Uploaded", description: `${files.length} image(s) added.` });
    } catch (err) {
      toast({ title: "Upload error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete this image?")) return;
    await supabase.storage.from(podImagesBucket).remove([path]);
    const { error } = await supabase.from("pod_images").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else qc.invalidateQueries({ queryKey: ["pod_images", podId] });
  };

  return (
    <section className="border border-border/60 p-5 bg-bone/40">
      <h2 className="font-display text-xl text-sage-deep mb-4">{name}</h2>
      <div className="grid md:grid-cols-2 gap-3 mb-5">
        <div>
          <Label>Alt text (next batch)</Label>
          <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Sunset view" />
        </div>
        <div>
          <Label>Add images</Label>
          <Input type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => upload(e.target.files)} />
        </div>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group aspect-[4/3] bg-linen overflow-hidden">
              <img src={img.url} alt={img.alt ?? ""} className="w-full h-full object-cover" />
              <button onClick={() => remove(img.id, img.storage_path)} className="absolute top-2 right-2 p-1.5 bg-background/90 hover:bg-destructive hover:text-destructive-foreground rounded-sm opacity-0 group-hover:opacity-100 transition" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const AdminGallery = () => {
  const { data: pods = [] } = usePods();
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Media</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Pod gallery</h1>
      </div>
      <div className="space-y-5">
        {pods.map((p) => <PodSection key={p.id} podId={p.id} name={p.name} />)}
      </div>
    </div>
  );
};

export default AdminGallery;
