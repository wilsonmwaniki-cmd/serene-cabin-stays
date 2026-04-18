import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Addon = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_kes: number;
  pricing_unit: "per_night" | "per_night_per_adult" | "one_time";
  is_active: boolean;
  display_order: number;
};

const useAllAddons = () =>
  useQuery({
    queryKey: ["all_addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("addons").select("*").order("display_order");
      if (error) throw error;
      return data as Addon[];
    },
  });

const AddonRow = ({ addon }: { addon: Addon }) => {
  const qc = useQueryClient();
  const [d, setD] = useState(addon);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("addons").update({
      name: d.name, description: d.description, price_kes: Number(d.price_kes),
      pricing_unit: d.pricing_unit, is_active: d.is_active,
    }).eq("id", addon.id);
    setBusy(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Saved", description: d.name });
      qc.invalidateQueries({ queryKey: ["all_addons"] });
      qc.invalidateQueries({ queryKey: ["addons"] });
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${addon.name}"?`)) return;
    const { error } = await supabase.from("addons").delete().eq("id", addon.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      qc.invalidateQueries({ queryKey: ["all_addons"] });
      qc.invalidateQueries({ queryKey: ["addons"] });
    }
  };

  return (
    <article className="border border-border/60 bg-bone/40 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-xl text-sage-deep">{addon.name}</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={d.is_active} onCheckedChange={(v) => setD({ ...d, is_active: v })} />
            <span>Active</span>
          </div>
          <Button size="sm" variant="ghost" onClick={remove}><Trash2 size={14} /></Button>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </div>
        <div>
          <Label>Price (KES)</Label>
          <Input type="number" value={d.price_kes} onChange={(e) => setD({ ...d, price_kes: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Pricing unit</Label>
          <Select value={d.pricing_unit} onValueChange={(v) => setD({ ...d, pricing_unit: v as Addon["pricing_unit"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="per_night">Per night</SelectItem>
              <SelectItem value="per_night_per_adult">Per night per adult</SelectItem>
              <SelectItem value="one_time">One-time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} />
      </div>
      <Button onClick={save} disabled={busy} size="sm">{busy ? "Saving…" : "Save"}</Button>
    </article>
  );
};

const AdminAddons = () => {
  const { data: addons = [], isLoading } = useAllAddons();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", slug: "", price_kes: 0, pricing_unit: "per_night" as Addon["pricing_unit"], description: "" });

  const create = async () => {
    if (!draft.name || !draft.slug) {
      toast({ title: "Missing fields", description: "Name and slug are required", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("addons").insert({
      ...draft, display_order: addons.length, is_active: true,
    });
    setCreating(false);
    if (error) toast({ title: "Create failed", description: error.message, variant: "destructive" });
    else {
      setDraft({ name: "", slug: "", price_kes: 0, pricing_unit: "per_night", description: "" });
      qc.invalidateQueries({ queryKey: ["all_addons"] });
      qc.invalidateQueries({ queryKey: ["addons"] });
    }
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Extras</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Add-ons</h1>
      </div>

      <section className="border border-dashed border-border p-5 mb-6 bg-bone/30">
        <h2 className="font-display text-lg text-sage-deep mb-3">New add-on</h2>
        <div className="grid md:grid-cols-4 gap-3 mb-3">
          <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="slug-like-this" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          <Input type="number" placeholder="Price KES" value={draft.price_kes} onChange={(e) => setDraft({ ...draft, price_kes: Number(e.target.value) })} />
          <Select value={draft.pricing_unit} onValueChange={(v) => setDraft({ ...draft, pricing_unit: v as Addon["pricing_unit"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="per_night">Per night</SelectItem>
              <SelectItem value="per_night_per_adult">Per night per adult</SelectItem>
              <SelectItem value="one_time">One-time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea placeholder="Description" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="mb-3" />
        <Button onClick={create} disabled={creating}><Plus size={14} className="mr-1" /> Create</Button>
      </section>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      <div className="space-y-4">
        {addons.map((a) => <AddonRow key={a.id} addon={a} />)}
      </div>
    </div>
  );
};

export default AdminAddons;
