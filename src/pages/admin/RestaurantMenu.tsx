import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAdminRestaurantMenu } from "@/hooks/useRestaurantMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type MenuItem = Tables<"restaurant_menu_items">;

const kes = (value: number) => `KES ${value.toLocaleString()}`;

const MenuItemRow = ({ item }: { item: MenuItem }) => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    title: item.title,
    description: item.description ?? "",
    section: item.section,
    price_kes: item.price_kes,
    is_active: item.is_active ? "active" : "inactive",
    display_order: item.display_order,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("restaurant_menu_items")
      .update({
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        section: draft.section.trim(),
        price_kes: Number(draft.price_kes) || 0,
        is_active: draft.is_active === "active",
        display_order: Number(draft.display_order) || 0,
      })
      .eq("id", item.id);
    setBusy(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin_restaurant_menu"] });
    qc.invalidateQueries({ queryKey: ["restaurant_menu"] });
    toast({ title: "Menu item updated", description: draft.title });
  };

  const remove = async () => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const { error } = await supabase.from("restaurant_menu_items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin_restaurant_menu"] });
    qc.invalidateQueries({ queryKey: ["restaurant_menu"] });
  };

  return (
    <article className="border border-border/60 bg-bone/40 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl text-sage-deep">{item.title}</h3>
            <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.section} · {kes(item.price_kes)}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={remove}>
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Item name</Label>
          <Input value={draft.title} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} />
        </div>
        <div>
          <Label>Section</Label>
          <Input placeholder="Breakfast, Lunch, Dinner, Drinks" value={draft.section} onChange={(e) => setDraft((current) => ({ ...current, section: e.target.value }))} />
        </div>
        <div>
          <Label>Price (KES)</Label>
          <Input type="number" value={draft.price_kes} onChange={(e) => setDraft((current) => ({ ...current, price_kes: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Availability</Label>
          <Select value={draft.is_active} onValueChange={(value) => setDraft((current) => ({ ...current, is_active: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Display order</Label>
          <Input type="number" value={draft.display_order} onChange={(e) => setDraft((current) => ({ ...current, display_order: Number(e.target.value) }))} />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} />
      </div>

      <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save item"}</Button>
    </article>
  );
};

const AdminRestaurantMenu = () => {
  const qc = useQueryClient();
  const { data: menuItems = [], isLoading } = useAdminRestaurantMenu();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    section: "Seasonal Menu",
    price_kes: 0,
    is_active: "active",
    display_order: 0,
  });

  const grouped = useMemo(
    () =>
      menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
        acc[item.section] = acc[item.section] ?? [];
        acc[item.section].push(item);
        return acc;
      }, {}),
    [menuItems],
  );

  const create = async () => {
    if (!draft.title.trim() || !draft.section.trim()) {
      toast({ title: "Missing details", description: "Item name and section are required.", variant: "destructive" });
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("restaurant_menu_items").insert({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      section: draft.section.trim(),
      price_kes: Number(draft.price_kes) || 0,
      is_active: draft.is_active === "active",
      display_order: Number(draft.display_order) || 0,
    });
    setCreating(false);

    if (error) {
      toast({ title: "Could not save menu item", description: error.message, variant: "destructive" });
      return;
    }

    setDraft({
      title: "",
      description: "",
      section: "Seasonal Menu",
      price_kes: 0,
      is_active: "active",
      display_order: 0,
    });
    qc.invalidateQueries({ queryKey: ["admin_restaurant_menu"] });
    qc.invalidateQueries({ queryKey: ["restaurant_menu"] });
    toast({ title: "Menu item added", description: "The restaurant menu has been updated." });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Restaurant</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Seasonal menu</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          Add menu items, prices, and switch each one on or off depending on what is available that day or season.
        </p>
      </div>

      <section className="border border-dashed border-border p-5 bg-bone/30 space-y-4">
        <h2 className="font-display text-lg text-sage-deep">Add menu item</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Item name</Label>
            <Input value={draft.title} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} />
          </div>
          <div>
            <Label>Section</Label>
            <Input placeholder="Breakfast, Lunch, Dinner, Drinks" value={draft.section} onChange={(e) => setDraft((current) => ({ ...current, section: e.target.value }))} />
          </div>
          <div>
            <Label>Price (KES)</Label>
            <Input type="number" value={draft.price_kes} onChange={(e) => setDraft((current) => ({ ...current, price_kes: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Availability</Label>
            <Select value={draft.is_active} onValueChange={(value) => setDraft((current) => ({ ...current, is_active: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Display order</Label>
            <Input type="number" value={draft.display_order} onChange={(e) => setDraft((current) => ({ ...current, display_order: Number(e.target.value) }))} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} />
        </div>
        <Button onClick={create} disabled={creating}>{creating ? "Saving…" : "Add item"}</Button>
      </section>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      <div className="space-y-8">
        {Object.entries(grouped).map(([section, items]) => (
          <section key={section} className="space-y-4">
            <div>
              <h2 className="font-display text-2xl text-sage-deep">{section}</h2>
              <p className="text-sm text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</p>
            </div>
            <div className="space-y-4">
              {items.map((item) => (
                <MenuItemRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default AdminRestaurantMenu;
