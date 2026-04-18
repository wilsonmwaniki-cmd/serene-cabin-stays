import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePods, type Pod } from "@/hooks/usePods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const PodEditor = ({ pod }: { pod: Pod }) => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    name: pod.name,
    description: pod.description,
    price_kes: pod.price_kes,
    capacity: pod.capacity,
    size_sqft: pod.size_sqft ?? 0,
    total_units: pod.total_units,
    amenities: pod.amenities.join("\n"),
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("pods").update({
      name: draft.name,
      description: draft.description,
      price_kes: Number(draft.price_kes),
      capacity: Number(draft.capacity),
      size_sqft: Number(draft.size_sqft) || null,
      total_units: Number(draft.total_units),
      amenities: draft.amenities.split("\n").map((s) => s.trim()).filter(Boolean),
    }).eq("id", pod.id);
    setBusy(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Saved", description: pod.name });
      qc.invalidateQueries({ queryKey: ["pods"] });
    }
  };

  return (
    <article className="border border-border/60 bg-bone/40 p-5 md:p-6 space-y-4">
      <h2 className="font-display text-2xl text-sage-deep">{pod.name}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Name</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <Label>Price (KES / night)</Label>
          <Input type="number" value={draft.price_kes} onChange={(e) => setDraft({ ...draft, price_kes: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Capacity</Label>
          <Input type="number" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Size (ft²)</Label>
          <Input type="number" value={draft.size_sqft} onChange={(e) => setDraft({ ...draft, size_sqft: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Total units</Label>
          <Input type="number" value={draft.total_units} onChange={(e) => setDraft({ ...draft, total_units: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={6} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>
      <div>
        <Label>Amenities (one per line)</Label>
        <Textarea rows={5} value={draft.amenities} onChange={(e) => setDraft({ ...draft, amenities: e.target.value })} />
      </div>
      <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
    </article>
  );
};

const AdminPods = () => {
  const { data: pods = [], isLoading } = usePods();
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Accommodations</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Pods</h1>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      <div className="space-y-6">
        {pods.map((p) => <PodEditor key={p.id} pod={p} />)}
      </div>
    </div>
  );
};

export default AdminPods;
