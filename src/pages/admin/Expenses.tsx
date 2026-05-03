import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  useAdminExpenses,
  useAdminStatementImports,
  useAdminStatementTransactions,
} from "@/hooks/useAdminFinance";
import { parsePaymentStatementPdf, toStatementTransactionRows } from "@/lib/payment-statement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Expense = Tables<"expenses">;
type StatementImport = Tables<"statement_imports">;
type StatementTransaction = Tables<"statement_transactions">;
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

const transactionTone = (transaction: StatementTransaction) =>
  transaction.credit_kes > 0 ? "default" : "secondary";

const formatPeriod = (statementImport: StatementImport) => {
  if (!statementImport.statement_from || !statementImport.statement_to) return "Statement period unavailable";
  return `${statementImport.statement_from} to ${statementImport.statement_to}`;
};

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

const StatementImportRow = ({
  statementImport,
  onDelete,
}: {
  statementImport: StatementImport;
  onDelete: (statementImport: StatementImport) => Promise<void>;
}) => (
  <article className="border border-border/60 bg-bone/40 p-4 space-y-2">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="font-medium text-sage-deep">{statementImport.original_filename}</h3>
        <p className="text-sm text-muted-foreground">
          {statementImport.source_name} · {areaLabel(statementImport.business_area)}
        </p>
        <p className="text-xs text-muted-foreground">{formatPeriod(statementImport)}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={() => void onDelete(statementImport)}>
        <Trash2 size={14} />
      </Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">{statementImport.transaction_count} transaction{statementImport.transaction_count === 1 ? "" : "s"}</Badge>
      <Badge variant="outline">Imported {statementImport.created_at.slice(0, 10)}</Badge>
    </div>
  </article>
);

const StatementTransactionRow = ({
  transaction,
  onCreateExpense,
}: {
  transaction: StatementTransaction;
  onCreateExpense: (transaction: StatementTransaction) => Promise<void>;
}) => {
  const hasOutflow = transaction.debit_kes > 0;

  return (
    <article className="border border-border/60 bg-bone/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sage-deep">{transaction.description}</p>
            <Badge variant={transactionTone(transaction)}>
              {transaction.credit_kes > 0 ? "Money in" : "Money out"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(transaction.transaction_at).toLocaleString()} · {areaLabel(transaction.business_area)}
          </p>
          <p className="text-xs text-muted-foreground">
            {transaction.reference ? `Ref ${transaction.reference}` : "No reference"}
            {transaction.account_number ? ` · Till ${transaction.account_number}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium text-sage-deep">
            {transaction.credit_kes > 0 ? `+${kes(transaction.credit_kes)}` : `-${kes(transaction.debit_kes)}`}
          </p>
          {transaction.balance_kes !== null && (
            <p className="text-xs text-muted-foreground">Balance {kes(transaction.balance_kes)}</p>
          )}
        </div>
      </div>

      {hasOutflow && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onCreateExpense(transaction)}
          disabled={!!transaction.linked_expense_id}
        >
          {transaction.linked_expense_id ? "Saved to expenses" : "Save as expense"}
        </Button>
      )}
    </article>
  );
};

const AdminExpenses = () => {
  const { data: expenses = [], isLoading: expensesLoading } = useAdminExpenses();
  const { data: statementImports = [], isLoading: importsLoading } = useAdminStatementImports();
  const { data: statementTransactions = [], isLoading: transactionsLoading } = useAdminStatementTransactions();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importArea, setImportArea] = useState<BusinessArea>("cabins");
  const [statementFiles, setStatementFiles] = useState<File[]>([]);
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
    statementIncome: statementTransactions.reduce((sum, transaction) => sum + transaction.credit_kes, 0),
    statementOutflow: statementTransactions.reduce((sum, transaction) => sum + transaction.debit_kes, 0),
  }), [expenses, statementTransactions]);

  const isLoading = expensesLoading || importsLoading || transactionsLoading;

  const refreshFinance = () => {
    qc.invalidateQueries({ queryKey: ["admin_expenses"] });
    qc.invalidateQueries({ queryKey: ["admin_statement_imports"] });
    qc.invalidateQueries({ queryKey: ["admin_statement_transactions"] });
  };

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

  const importStatements = async () => {
    if (statementFiles.length === 0) {
      toast({ title: "No files selected", description: "Choose one or more PDF statements first.", variant: "destructive" });
      return;
    }

    setImporting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      for (const file of statementFiles) {
        const parsed = await parsePaymentStatementPdf(file);
        const importId = crypto.randomUUID();

        const { error: importError } = await supabase.from("statement_imports").insert({
          id: importId,
          source_name: parsed.sourceName,
          original_filename: file.name,
          business_area: importArea,
          statement_from: parsed.statementFrom,
          statement_to: parsed.statementTo,
          transaction_count: parsed.transactions.length,
          imported_by: user?.id ?? null,
        });

        if (importError) throw importError;

        const rows = toStatementTransactionRows(parsed, importId, importArea);
        const { error: transactionError } = await supabase.from("statement_transactions").insert(rows);
        if (transactionError) throw transactionError;
      }

      setStatementFiles([]);
      refreshFinance();
      toast({
        title: "Statements imported",
        description: `${statementFiles.length} statement${statementFiles.length === 1 ? "" : "s"} added successfully.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import statement.";
      toast({ title: "Import failed", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const createExpenseFromTransaction = async (transaction: StatementTransaction) => {
    if (transaction.linked_expense_id || transaction.debit_kes <= 0) return;

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_date: transaction.transaction_at.slice(0, 10),
        business_area: transaction.business_area,
        category: "Statement import",
        vendor: transaction.account_number || null,
        description: transaction.description,
        amount_kes: transaction.debit_kes,
        notes: transaction.reference ? `Imported from payment statement · Ref ${transaction.reference}` : "Imported from payment statement",
      })
      .select("id")
      .single();

    if (error || !data) {
      toast({ title: "Could not save expense", description: error?.message ?? "Please try again.", variant: "destructive" });
      return;
    }

    const { error: linkError } = await supabase
      .from("statement_transactions")
      .update({ linked_expense_id: data.id })
      .eq("id", transaction.id);

    if (linkError) {
      toast({ title: "Expense saved but not linked", description: linkError.message, variant: "destructive" });
      refreshFinance();
      return;
    }

    refreshFinance();
    toast({ title: "Saved to expenses", description: transaction.description });
  };

  const deleteStatementImport = async (statementImport: StatementImport) => {
    if (!confirm(`Delete imported statement "${statementImport.original_filename}"? This removes its transactions too.`)) return;
    const { error } = await supabase.from("statement_imports").delete().eq("id", statementImport.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    refreshFinance();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Finance</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Expenses & statement imports</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          Log manual costs, upload payment statements, and keep a cleaner picture of money in and money out.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Manual expenses" value={kes(totals.all)} />
        <SummaryCard label="Cabins" value={kes(totals.cabins)} />
        <SummaryCard label="Restaurant" value={kes(totals.restaurant)} />
        <SummaryCard label="Shared overhead" value={kes(totals.shared)} />
        <SummaryCard label="Statement money in" value={kes(totals.statementIncome)} />
        <SummaryCard label="Statement money out" value={kes(totals.statementOutflow)} />
      </section>

      <section className="border border-dashed border-border p-5 bg-bone/30 space-y-4">
        <div>
          <h2 className="font-display text-lg text-sage-deep mb-1">Import payment statements</h2>
          <p className="text-sm text-muted-foreground">
            Upload PDF statements from your payments app and the system will extract money in and money out automatically.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Business area</Label>
            <Select value={importArea} onValueChange={(value) => setImportArea(value as BusinessArea)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cabins">Cabins</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="shared">Shared overhead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Statement PDFs</Label>
            <Input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(event) => setStatementFiles(Array.from(event.target.files ?? []))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              You can select multiple monthly statements at once.
            </p>
          </div>
        </div>
        {statementFiles.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {statementFiles.length} file{statementFiles.length === 1 ? "" : "s"} ready:
            {" "}
            {statementFiles.map((file) => file.name).join(", ")}
          </div>
        )}
        <Button onClick={importStatements} disabled={importing}>
          {importing ? <Loader2 size={14} className="mr-2 animate-spin" /> : <FileUp size={14} className="mr-2" />}
          Import statement{statementFiles.length === 1 ? "" : "s"}
        </Button>
      </section>

      <section className="border border-dashed border-border p-5 bg-bone/30">
        <h2 className="font-display text-lg text-sage-deep mb-3">Add manual expense</h2>
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

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-sage-deep">Imported statements</h2>
          <p className="text-sm text-muted-foreground">Each uploaded statement stays saved so you can trace where imported transactions came from.</p>
        </div>
        {statementImports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No statements imported yet.</p>
        ) : (
          <div className="space-y-3">
            {statementImports.map((statementImport) => (
              <StatementImportRow key={statementImport.id} statementImport={statementImport} onDelete={deleteStatementImport} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-sage-deep">Imported statement transactions</h2>
          <p className="text-sm text-muted-foreground">Money in and money out captured from uploaded statements.</p>
        </div>
        {statementTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No statement transactions imported yet.</p>
        ) : (
          <div className="space-y-3">
            {statementTransactions.map((transaction) => (
              <StatementTransactionRow
                key={transaction.id}
                transaction={transaction}
                onCreateExpense={createExpenseFromTransaction}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-sage-deep">Manual expenses</h2>
          <p className="text-sm text-muted-foreground">Costs you have logged yourself or saved out of imported statement outflows.</p>
        </div>
        <div className="space-y-4">
          {expenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}
        </div>
      </section>
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
