import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAdminExpenses } from "@/hooks/useAdminFinance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Expense = Tables<"expenses">;
type BusinessArea = Expense["business_area"];
type ExpenseCategoryOption = typeof EXPENSE_CATEGORIES[number];

const kes = (value: number) => `KES ${value.toLocaleString()}`;
const OTHER_CATEGORY = "__other__";

const EXPENSE_CATEGORIES = [
  "Staff",
  "Laundry",
  "Cleaning supplies",
  "Repairs",
  "Utilities",
  "Food stock",
  "Marketing",
  "Transport",
  "Fuel",
  "Internet",
  "Security",
  "Maintenance",
  "Furniture",
  "Equipment",
  "Licences & permits",
  "Professional fees",
] as const;

const areaLabel = (value: BusinessArea) =>
  value === "cabins" ? "Cabins" : value === "restaurant" ? "Restaurant" : "Shared overhead";

const isPresetCategory = (value: string) =>
  EXPENSE_CATEGORIES.includes(value as ExpenseCategoryOption);

const CategoryField = ({
  category,
  setCategory,
}: {
  category: string;
  setCategory: (value: string) => void;
}) => {
  const [mode, setMode] = useState<string>(isPresetCategory(category) ? category : OTHER_CATEGORY);

  const handleSelect = (value: string) => {
    setMode(value);
    if (value !== OTHER_CATEGORY) {
      setCategory(value);
    } else if (isPresetCategory(category)) {
      setCategory("");
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>Category</Label>
        <Select value={mode} onValueChange={handleSelect}>
          <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
            <SelectItem value={OTHER_CATEGORY}>Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === OTHER_CATEGORY && (
        <Input
          placeholder="Type a custom category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      )}
    </div>
  );
};

const ExpenseRow = ({ expense }: { expense: Expense }) => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    expense_date: expense.expense_date,
    business_area: expense.business_area,
    category: expense.category,
    vendor: expense.vendor ?? "",
    description: expense.description,
    amount_kes: expense.amount_kes,
    notes: expense.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("expenses")
      .update({
        expense_date: draft.expense_date,
        business_area: draft.business_area,
        category: draft.category.trim(),
        vendor: draft.vendor.trim() || null,
        description: draft.description.trim(),
        amount_kes: Number(draft.amount_kes) || 0,
        notes: draft.notes.trim() || null,
      })
      .eq("id", expense.id);
    setBusy(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Expense updated", description: draft.description });
    qc.invalidateQueries({ queryKey: ["admin_expenses"] });
  };

  const remove = async () => {
    if (!confirm(`Delete "${expense.description}"?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin_expenses"] });
  };

  return (
    <article className="border border-border/60 bg-bone/40 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-sage-deep">{expense.description}</h3>
          <p className="text-sm text-muted-foreground">
            {areaLabel(expense.business_area)} · {expense.category} · {kes(expense.amount_kes)}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={remove}>
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>Date</Label>
          <Input type="date" value={draft.expense_date} onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })} />
        </div>
        <div>
          <Label>Area</Label>
          <Select value={draft.business_area} onValueChange={(value) => setDraft({ ...draft, business_area: value as BusinessArea })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cabins">Cabins</SelectItem>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="shared">Shared overhead</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CategoryField category={draft.category} setCategory={(value) => setDraft({ ...draft, category: value })} />
        <div>
          <Label>Vendor or supplier</Label>
          <Input value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
        </div>
        <div>
          <Label>Amount (KES)</Label>
          <Input type="number" value={draft.amount_kes} onChange={(e) => setDraft({ ...draft, amount_kes: Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </div>

      <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </article>
  );
};

const AdminExpenses = () => {
  const { data: expenses = [], isLoading } = useAdminExpenses();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    business_area: "cabins" as BusinessArea,
    category: "",
    vendor: "",
    description: "",
    amount_kes: 0,
    notes: "",
  });

  const totals = useMemo(() => ({
    all: expenses.reduce((sum, expense) => sum + expense.amount_kes, 0),
    cabins: expenses.filter((expense) => expense.business_area === "cabins").reduce((sum, expense) => sum + expense.amount_kes, 0),
    restaurant: expenses.filter((expense) => expense.business_area === "restaurant").reduce((sum, expense) => sum + expense.amount_kes, 0),
    shared: expenses.filter((expense) => expense.business_area === "shared").reduce((sum, expense) => sum + expense.amount_kes, 0),
  }), [expenses]);

  const create = async () => {
    if (!draft.category.trim() || !draft.description.trim()) {
      toast({ title: "Missing fields", description: "Category and description are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("expenses").insert({
      expense_date: draft.expense_date,
      business_area: draft.business_area,
      category: draft.category.trim(),
      vendor: draft.vendor.trim() || null,
      description: draft.description.trim(),
      amount_kes: Number(draft.amount_kes) || 0,
      notes: draft.notes.trim() || null,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    setDraft({
      expense_date: new Date().toISOString().slice(0, 10),
      business_area: "cabins",
      category: "",
      vendor: "",
      description: "",
      amount_kes: 0,
      notes: "",
    });
    qc.invalidateQueries({ queryKey: ["admin_expenses"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Finance</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Expense tracker</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          Log every cost here so you can compare real spending against booking revenue. You can already split costs between cabins, restaurant, and shared overhead.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="All expenses" value={kes(totals.all)} />
        <SummaryCard label="Cabins" value={kes(totals.cabins)} />
        <SummaryCard label="Restaurant" value={kes(totals.restaurant)} />
        <SummaryCard label="Shared overhead" value={kes(totals.shared)} />
      </section>

      <section className="border border-dashed border-border p-5 bg-bone/30">
        <h2 className="font-display text-lg text-sage-deep mb-3">Add expense</h2>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={draft.expense_date} onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })} />
          </div>
          <div>
            <Label>Area</Label>
            <Select value={draft.business_area} onValueChange={(value) => setDraft({ ...draft, business_area: value as BusinessArea })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cabins">Cabins</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="shared">Shared overhead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CategoryField category={draft.category} setCategory={(value) => setDraft({ ...draft, category: value })} />
          <div>
            <Label>Vendor or supplier</Label>
            <Input placeholder="Optional" value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input type="number" placeholder="0" value={draft.amount_kes} onChange={(e) => setDraft({ ...draft, amount_kes: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Description</Label>
            <Input placeholder="What was paid for?" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
        </div>
        <div className="mb-3">
          <Label>Notes</Label>
          <Textarea placeholder="Optional details" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
        <Button onClick={create} disabled={creating}><Plus size={14} className="mr-1" /> Add expense</Button>
      </section>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      <div className="space-y-4">
        {expenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-border/60 bg-bone/40 p-4">
    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</div>
    <div className="font-display text-3xl text-sage-deep">{value}</div>
  </div>
);

export default AdminExpenses;
