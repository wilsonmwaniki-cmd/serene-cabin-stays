import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type PromoCode = Tables<"promo_codes">;

const toStartIso = (value: string) => (value ? `${value}T00:00:00+03:00` : null);
const toEndIso = (value: string) => (value ? `${value}T23:59:59+03:00` : null);
const fromIsoDate = (value: string | null) => (value ? value.slice(0, 10) : "");

const useAllPromoCodes = () =>
  useQuery({
    queryKey: ["promo_codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PromoCode[];
    },
  });

const FieldNote = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-xs text-muted-foreground">{children}</p>
);

const PromoCodeRow = ({ promo }: { promo: PromoCode }) => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    code: promo.code,
    label: promo.label,
    description: promo.description ?? "",
    kind: promo.kind,
    discount_type: promo.discount_type,
    amount_kes: promo.amount_kes,
    percent_off: promo.percent_off ?? 0,
    is_active: promo.is_active,
    starts_at: fromIsoDate(promo.starts_at),
    ends_at: fromIsoDate(promo.ends_at),
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("promo_codes").update({
      code: draft.code.trim().toUpperCase(),
      label: draft.label.trim(),
      description: draft.description.trim() || null,
      kind: draft.kind,
      discount_type: draft.discount_type,
      amount_kes: Number(draft.amount_kes) || 0,
      percent_off: draft.discount_type === "percentage" ? Number(draft.percent_off) || 0 : null,
      is_active: draft.is_active,
      starts_at: toStartIso(draft.starts_at),
      ends_at: toEndIso(draft.ends_at),
    }).eq("id", promo.id);
    setBusy(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: draft.code });
    qc.invalidateQueries({ queryKey: ["promo_codes"] });
  };

  const remove = async () => {
    if (!confirm(`Delete "${promo.code}"?`)) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", promo.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["promo_codes"] });
  };

  return (
    <article className="border border-border/60 bg-bone/40 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-sage-deep">{promo.code}</h3>
          <p className="text-sm text-muted-foreground">{promo.label}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={draft.is_active} onCheckedChange={(value) => setDraft({ ...draft, is_active: value })} />
            <span>Active</span>
          </div>
          <Button size="sm" variant="ghost" onClick={remove}><Trash2 size={14} /></Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>Code guests enter</Label>
          <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
          <FieldNote>Example: WELCOME10 or AGENTLERA.</FieldNote>
        </div>
        <div>
          <Label>Internal name</Label>
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <FieldNote>This helps you remember what the code is for.</FieldNote>
        </div>
        <div>
          <Label>Code type</Label>
          <Select value={draft.kind} onValueChange={(value) => setDraft({ ...draft, kind: value as PromoCode["kind"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="discount">Discount</SelectItem>
              <SelectItem value="affiliate">Affiliate</SelectItem>
            </SelectContent>
          </Select>
          <FieldNote>Use discount for an offer, affiliate for a partner or referrer.</FieldNote>
        </div>
        <div>
          <Label>How the code changes the price</Label>
          <Select value={draft.discount_type} onValueChange={(value) => setDraft({ ...draft, discount_type: value as PromoCode["discount_type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed amount</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
          <FieldNote>Choose whether this removes a flat amount or a percentage.</FieldNote>
        </div>
        <div>
          <Label>{draft.discount_type === "percentage" ? "Percentage off" : "Amount off in KES"}</Label>
          <Input
            type="number"
            value={draft.discount_type === "percentage" ? draft.percent_off : draft.amount_kes}
            onChange={(e) => setDraft({
              ...draft,
              amount_kes: draft.discount_type === "fixed" ? Number(e.target.value) : draft.amount_kes,
              percent_off: draft.discount_type === "percentage" ? Number(e.target.value) : draft.percent_off,
            })}
          />
          <FieldNote>{draft.discount_type === "percentage" ? "Example: enter 10 for 10% off." : "Example: enter 500 to remove KES 500."}</FieldNote>
        </div>
        <div>
          <Label>Start date</Label>
          <Input type="date" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
          <FieldNote>Leave blank if it should work immediately.</FieldNote>
        </div>
        <div>
          <Label>End date</Label>
          <Input type="date" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
          <FieldNote>Leave blank if it should stay active until you switch it off.</FieldNote>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <FieldNote>This is just for you. Guests do not need to see it.</FieldNote>
      </div>

      <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </article>
  );
};

const AdminCodes = () => {
  const { data: promoCodes = [], isLoading } = useAllPromoCodes();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    code: "",
    label: "",
    description: "",
    kind: "discount" as PromoCode["kind"],
    discount_type: "fixed" as PromoCode["discount_type"],
    amount_kes: 0,
    percent_off: 0,
    starts_at: "",
    ends_at: "",
  });

  const create = async () => {
    if (!draft.code.trim() || !draft.label.trim()) {
      toast({ title: "Missing fields", description: "Code and label are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("promo_codes").insert({
      code: draft.code.trim().toUpperCase(),
      label: draft.label.trim(),
      description: draft.description.trim() || null,
      kind: draft.kind,
      discount_type: draft.discount_type,
      amount_kes: draft.discount_type === "fixed" ? Number(draft.amount_kes) || 0 : 0,
      percent_off: draft.discount_type === "percentage" ? Number(draft.percent_off) || 0 : null,
      is_active: true,
      starts_at: toStartIso(draft.starts_at),
      ends_at: toEndIso(draft.ends_at),
    });
    setCreating(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    setDraft({
      code: "",
      label: "",
      description: "",
      kind: "discount",
      discount_type: "fixed",
      amount_kes: 0,
      percent_off: 0,
      starts_at: "",
      ends_at: "",
    });
    qc.invalidateQueries({ queryKey: ["promo_codes"] });
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Offers</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Discount & affiliate codes</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Create codes guests can enter during booking. You can use them for discounts or to track partner and affiliate bookings.
        </p>
      </div>

      <section className="border border-dashed border-border p-5 mb-6 bg-bone/30">
        <h2 className="font-display text-lg text-sage-deep mb-3">New code</h2>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <div>
            <Label>Code guests enter</Label>
            <Input placeholder="CODE2026" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
            <FieldNote>Example: WELCOME10 or AGENTLERA.</FieldNote>
          </div>
          <div>
            <Label>Internal name</Label>
            <Input placeholder="Weekend launch offer" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <FieldNote>This helps you recognise the code later.</FieldNote>
          </div>
          <div>
            <Label>Code type</Label>
            <Select value={draft.kind} onValueChange={(value) => setDraft({ ...draft, kind: value as PromoCode["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">Discount</SelectItem>
                <SelectItem value="affiliate">Affiliate</SelectItem>
              </SelectContent>
            </Select>
            <FieldNote>Use affiliate if you want to track partner bookings.</FieldNote>
          </div>
          <div>
            <Label>How the code changes the price</Label>
            <Select value={draft.discount_type} onValueChange={(value) => setDraft({ ...draft, discount_type: value as PromoCode["discount_type"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed amount</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
            <FieldNote>Pick flat amount or percentage.</FieldNote>
          </div>
          <div>
            <Label>{draft.discount_type === "percentage" ? "Percentage off" : "Amount off in KES"}</Label>
            <Input
              type="number"
              placeholder={draft.discount_type === "percentage" ? "Example: 10" : "Example: 500"}
              value={draft.discount_type === "percentage" ? draft.percent_off : draft.amount_kes}
              onChange={(e) => setDraft({
                ...draft,
                amount_kes: draft.discount_type === "fixed" ? Number(e.target.value) : draft.amount_kes,
                percent_off: draft.discount_type === "percentage" ? Number(e.target.value) : draft.percent_off,
              })}
            />
            <FieldNote>{draft.discount_type === "percentage" ? "Enter the percent only." : "Enter how many Kenya shillings to remove."}</FieldNote>
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
            <FieldNote>Leave blank if it should start now.</FieldNote>
          </div>
        </div>
        <div className="grid md:grid-cols-[1fr_220px] gap-3 mb-3">
          <div>
            <Label>Notes</Label>
            <Textarea placeholder="What this code is for" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <FieldNote>This is optional and helps you remember the purpose of the code.</FieldNote>
          </div>
          <div>
            <Label>End date</Label>
            <Input type="date" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
            <FieldNote>Leave blank if there is no end date.</FieldNote>
          </div>
        </div>
        <Button onClick={create} disabled={creating}><Plus size={14} className="mr-1" /> Create code</Button>
      </section>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      <div className="space-y-4">
        {promoCodes.map((promo) => <PromoCodeRow key={promo.id} promo={promo} />)}
      </div>
    </div>
  );
};

export default AdminCodes;
