import { useState, useEffect } from "react";
import { useSiteContentRows, useUpdateSiteContent } from "@/hooks/useSiteContent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const Row = ({ id, label, k, value }: { id: string; label: string; k: string; value: string }) => {
  const [draft, setDraft] = useState(value);
  const update = useUpdateSiteContent();
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="border border-border/60 bg-bone/40 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <Label className="text-sm font-medium">{label}</Label>
        <code className="text-[10px] text-muted-foreground">{k}</code>
      </div>
      <Textarea rows={draft.length > 80 ? 3 : 1} value={draft} onChange={(e) => setDraft(e.target.value)} />
      {draft !== value && (
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            update.mutate({ id, value: draft }, {
              onSuccess: () => toast({ title: "Saved", description: label }),
              onError: (e) => toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }),
            });
          }}
          disabled={update.isPending}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      )}
    </div>
  );
};

const AdminContent = () => {
  const { data: rows = [], isLoading } = useSiteContentRows();
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Content</p>
        <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Site text</h1>
        <p className="text-sm text-muted-foreground mt-2">Edit text blocks shown on the public site. Changes go live immediately.</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      <div className="space-y-3 max-w-3xl">
        {rows.map((r) => <Row key={r.id} id={r.id} label={r.label ?? r.key} k={r.key} value={r.value} />)}
      </div>
    </div>
  );
};

export default AdminContent;
