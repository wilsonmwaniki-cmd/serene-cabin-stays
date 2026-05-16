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
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/25 bg-bone/35 px-5 py-3 text-sm uppercase tracking-[0.18em] text-sage-deep shadow-lift backdrop-blur-xl transition-all hover:bg-bone/50 supports-[backdrop-filter]:bg-bone/25"
      >
        {open ? <X size={16} /> : <MessageCircle size={16} />}
        Ask LERA
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[min(92vw,420px)] overflow-hidden rounded-[22px] border border-white/20 bg-bone/45 shadow-lift backdrop-blur-2xl supports-[backdrop-filter]:bg-bone/30">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-bone/8 to-transparent" />
          <div className="relative flex items-start justify-between gap-4 border-b border-white/20 px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-white/20 bg-sage-deep/90 p-2 text-bone shadow-soft">
                <Bot size={16} />
              </div>
              <div>
                <h3 className="font-display text-xl text-sage-deep">Wild by LERA Assistant</h3>
                <p className="text-sm text-muted-foreground">Helps guests choose dates, check availability, and move into booking.</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <ScrollArea className="relative h-[420px] px-5 py-4">
            <div className="space-y-3">
              {visibleMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[88%] rounded-[18px] px-4 py-3 text-sm leading-relaxed shadow-soft",
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

          <div className="relative border-t border-white/20 px-5 py-4">
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
