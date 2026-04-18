import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { usePods } from "@/hooks/usePods";
import { usePodImages, podImagesBucket } from "@/hooks/usePodImages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Trash2, LogOut } from "lucide-react";

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
        const { error: upErr } = await supabase.storage
          .from(podImagesBucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("pod_images").insert({
          pod_id: podId,
          storage_path: path,
          alt: alt || null,
          display_order: images.length,
        });
        if (insErr) throw insErr;
      }
      setAlt("");
      qc.invalidateQueries({ queryKey: ["pod_images", podId] });
      toast({ title: "Uploaded", description: `${files.length} image(s) added.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload error", description: message, variant: "destructive" });
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
    <section className="border border-border/60 p-6 bg-bone/40">
      <h2 className="font-display text-2xl text-sage-deep mb-4">{name}</h2>
      <div className="space-y-3 mb-6">
        <div>
          <Label htmlFor={`alt-${podId}`}>Alt text (optional, applies to next upload batch)</Label>
          <Input id={`alt-${podId}`} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Sunset view from the deck" />
        </div>
        <div>
          <Label htmlFor={`file-${podId}`}>Add images</Label>
          <Input
            id={`file-${podId}`}
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group aspect-[4/3] bg-linen overflow-hidden">
              <img src={img.url} alt={img.alt ?? ""} className="w-full h-full object-cover" />
              <button
                onClick={() => remove(img.id, img.storage_path)}
                className="absolute top-2 right-2 p-1.5 bg-background/90 hover:bg-destructive hover:text-destructive-foreground rounded-sm opacity-0 group-hover:opacity-100 transition"
                aria-label="Delete image"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const { data: pods = [] } = usePods();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  if (authLoading || roleLoading) {
    return <section className="pt-36 container"><p className="text-muted-foreground">Loading…</p></section>;
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <section className="pt-36 md:pt-44 pb-24 container max-w-2xl">
        <h1 className="font-display text-4xl text-sage-deep mb-4">Not authorized</h1>
        <p className="text-foreground/75 mb-2">Your account ({user.email}) doesn't have admin access yet.</p>
        <p className="text-sm text-muted-foreground mb-6">
          To grant yourself admin, run this in your Lovable Cloud SQL editor (replace with your user id: <code className="bg-linen px-1">{user.id}</code>):
        </p>
        <pre className="bg-linen p-4 text-xs overflow-auto">{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${user.id}', 'admin');`}</pre>
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>
          <LogOut size={16} className="mr-2" /> Sign out
        </Button>
      </section>
    );
  }

  return (
    <section className="pt-36 md:pt-44 pb-24 container">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Admin</p>
          <h1 className="font-display text-4xl md:text-5xl text-sage-deep">Pod galleries</h1>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          <LogOut size={16} className="mr-2" /> Sign out
        </Button>
      </div>
      <div className="space-y-8">
        {pods.map((p) => (
          <PodSection key={p.id} podId={p.id} name={p.name} />
        ))}
      </div>
    </section>
  );
};

export default Admin;
