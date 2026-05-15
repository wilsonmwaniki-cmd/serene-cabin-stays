import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const starterMessage = `Hello, I’m the Wild by LERA booking assistant. I can help with pods, prices, stay rules, menu questions, availability checks, and direct booking links.`;

const starterPrompts = [
  "What is the difference between Pod 1 and Pod 2?",
  "What are your booking rules?",
  "Can you help me choose the right stay?",
  "Show me the restaurant menu options.",
];

const renderLinkedText = (text: string) => {
  const segments = text.split(/(\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return segments.map((segment, index) => {
    const match = segment.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) {
      return (
        <span key={`${segment}-${index}`}>
          {segment.split("\n").map((line, lineIndex, list) => (
            <span key={`${line}-${lineIndex}`}>
              {line}
              {lineIndex < list.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    }

    const [, label, href] = match;
    const isInternal = href.startsWith("/");

    return isInternal ? (
      <Link key={`${href}-${index}`} to={href} className="underline underline-offset-4">
        {label}
      </Link>
    ) : (
      <a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        {label}
      </a>
    );
  });
};

export const GuestAssistant = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: starterMessage },
  ]);

  const visibleMessages = useMemo(() => messages.slice(-14), [messages]);

  const sendMessage = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/guest-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPath: location.pathname,
          messages: nextMessages,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "The assistant could not reply");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: body?.reply || "I’m here to help with stays, menu, and booking questions.",
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The assistant could not reply";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `I couldn’t reply just now. ${message}. You can still use [Book now](/book) or [Contact us](/contact).`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-sage-deep px-5 py-3 text-sm uppercase tracking-[0.18em] text-bone shadow-lift transition-colors hover:bg-sage"
      >
        {open ? <X size={16} /> : <MessageCircle size={16} />}
        Ask LERA
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[min(92vw,420px)] overflow-hidden rounded-sm border border-border bg-bone shadow-lift">
          <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-linen/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-sage-deep p-2 text-bone">
                <Bot size={16} />
              </div>
              <div>
                <h3 className="font-display text-xl text-sage-deep">Wild by LERA Assistant</h3>
                <p className="text-sm text-muted-foreground">Help with stays, menu, pricing, and booking links.</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <ScrollArea className="h-[420px] px-4 py-4">
            <div className="space-y-3">
              {visibleMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[88%] rounded-sm px-4 py-3 text-sm leading-relaxed",
                    message.role === "assistant"
                      ? "bg-linen text-foreground"
                      : "ml-auto bg-sage-deep text-bone",
                  )}
                >
                  {renderLinkedText(message.content)}
                </div>
              ))}

              {loading && (
                <div className="inline-flex items-center gap-2 rounded-sm bg-linen px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border/70 px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-linen"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask about pods, dates, menu, or booking rules…"
              />
              <Button type="button" onClick={() => void sendMessage()} disabled={loading || !input.trim()}>
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
