import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminMessages, type AdminMessage, type MessageStatus } from "@/hooks/useAdminMessages";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Archive, Mail, MailOpen, Reply, Trash2 } from "lucide-react";

const fmt = (d: string) =>
  new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const statusVariant = (s: MessageStatus) =>
  s === "new" ? "default" : s === "replied" ? "secondary" : s === "archived" ? "outline" : "secondary";

const FILTERS: Array<MessageStatus | "all"> = ["new", "read", "replied", "archived", "all"];

const AdminMessages = () => {
  const { data: messages = [], isLoading } = useAdminMessages();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MessageStatus | "all">("new");

  const filtered = messages.filter((m) => filter === "all" || m.status === filter);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin_messages"] });
    qc.invalidateQueries({ queryKey: ["admin_counts"] });
  };

  const setStatus = async (m: AdminMessage, status: MessageStatus) => {
    setBusyId(m.id);
    const { error } = await supabase.from("messages").update({ status }).eq("id", m.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const remove = async (m: AdminMessage) => {
    if (!confirm(`Delete message from ${m.name}?`)) return;
    setBusyId(m.id);
    const { error } = await supabase.from("messages").delete().eq("id", m.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Message deleted" });
    refresh();
  };

  const replyHref = (m: AdminMessage) => {
    const subject = encodeURIComponent(m.subject ? `Re: ${m.subject}` : "Re: your message to Wild by LERA");
    const body = encodeURIComponent(`Hi ${m.name},\n\n\n\n— Wild by LERA\n\n---\nOn ${fmt(m.created_at)} you wrote:\n${m.message}`);
    return `mailto:${m.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Inbox</p>
          <h1 className="font-display text-3xl md:text-4xl text-sage-deep">Messages</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-muted-foreground">No {filter === "all" ? "" : filter} messages.</p>
      )}

      <div className="space-y-4">
        {filtered.map((m) => (
          <article key={m.id} className="border border-border/60 bg-bone/40 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-display text-xl text-sage-deep">{m.name}</h2>
                  <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <a href={`mailto:${m.email}`} className="hover:text-ember">{m.email}</a>
                  {m.phone && <> · <a href={`tel:${m.phone}`} className="hover:text-ember">{m.phone}</a></>}
                  {" · "}{fmt(m.created_at)}
                </p>
                {m.subject && <p className="mt-2 text-sm font-medium text-foreground/90">{m.subject}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild onClick={() => m.status === "new" && setStatus(m, "read")}>
                  <a href={replyHref(m)}>
                    <Reply size={14} className="mr-1" /> Reply
                  </a>
                </Button>
                {m.status !== "replied" && (
                  <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => setStatus(m, "replied")}>
                    <MailOpen size={14} className="mr-1" /> Mark replied
                  </Button>
                )}
                {m.status === "new" && (
                  <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => setStatus(m, "read")}>
                    <Mail size={14} className="mr-1" /> Mark read
                  </Button>
                )}
                {m.status !== "archived" && (
                  <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => setStatus(m, "archived")}>
                    <Archive size={14} className="mr-1" /> Archive
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => remove(m)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            <p className="text-sm text-foreground/85 whitespace-pre-wrap">{m.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default AdminMessages;
