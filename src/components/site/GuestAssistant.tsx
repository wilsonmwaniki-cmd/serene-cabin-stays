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

const starterMessage = `Hello, I’m the Wild by LERA booking assistant. I can help you make a booking step by step. To start, what check-in and check-out dates are you interested in?`;

const starterPrompts = [
  "I want to make a booking.",
  "Check availability for my dates.",
  "Help me choose between Pod 1 and Pod 2.",
  "Show me the restaurant menu.",
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
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-sage-deep/25 bg-sage-deep px-4 py-3 text-xs uppercase tracking-[0.18em] text-bone shadow-[0_20px_45px_rgba(54,74,43,0.35),0_0_0_1px_rgba(255,255,255,0.08),0_0_28px_rgba(126,154,111,0.28)] transition-all hover:-translate-y-0.5 hover:bg-sage hover:shadow-[0_24px_55px_rgba(54,74,43,0.42),0_0_0_1px_rgba(255,255,255,0.1),0_0_34px_rgba(126,154,111,0.34)] md:bottom-5 md:right-5 md:px-5 md:py-3 md:text-sm"
      >
        {open ? <X size={16} /> : <MessageCircle size={16} />}
        Ask LERA
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-20 z-50 overflow-hidden rounded-[20px] border border-white/20 bg-bone/45 shadow-lift backdrop-blur-2xl supports-[backdrop-filter]:bg-bone/30 md:inset-x-auto md:bottom-24 md:right-5 md:w-[min(92vw,420px)] md:rounded-[22px]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-bone/8 to-transparent" />
          <div className="relative flex items-start justify-between gap-3 border-b border-white/20 px-4 py-4 md:gap-4 md:px-5 md:py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-white/20 bg-sage-deep/90 p-2 text-bone shadow-soft">
                <Bot size={16} />
              </div>
              <div>
                <h3 className="font-display text-lg text-sage-deep md:text-xl">Wild by LERA Assistant</h3>
                <p className="text-xs text-muted-foreground md:text-sm">Helps guests choose dates, check availability, and move into booking.</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <ScrollArea className="relative h-[46vh] max-h-[420px] min-h-[280px] px-4 py-4 md:h-[420px] md:px-5">
            <div className="space-y-3">
              {visibleMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[92%] rounded-[18px] px-4 py-3 text-sm leading-relaxed shadow-soft md:max-w-[88%]",
                    message.role === "assistant"
                      ? "border border-white/25 bg-white/45 text-foreground backdrop-blur-md"
                      : "ml-auto border border-sage-deep/20 bg-sage-deep/90 text-bone",
                  )}
                >
                  {renderLinkedText(message.content)}
                </div>
              ))}

              {loading && (
                <div className="inline-flex items-center gap-2 rounded-[18px] border border-white/25 bg-white/45 px-4 py-3 text-sm text-muted-foreground shadow-soft backdrop-blur-md">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="relative border-t border-white/20 px-4 py-4 md:px-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-white/30 bg-white/35 px-3 py-1.5 text-xs text-foreground/80 backdrop-blur-md transition-colors hover:bg-white/50"
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
                className="min-w-0"
              />
              <Button type="button" onClick={() => void sendMessage()} disabled={loading || !input.trim()} className="shrink-0 px-3">
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
