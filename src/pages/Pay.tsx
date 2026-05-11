import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type PayTarget = {
  kind: string;
  id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  amount_kes: number;
  description: string;
};

const kes = (value: number) => `KES ${value.toLocaleString()}`;

const Pay = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [target, setTarget] = useState<PayTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("This payment link is missing or invalid.");
      return;
    }

    const load = async () => {
      try {
        const response = await fetch(`/api/payment-link?token=${encodeURIComponent(token)}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || "Could not load payment details");
        setTarget(body.target ?? null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not load payment details";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token]);

  useEffect(() => {
    if (!target || paying || message || error) return;
    void triggerPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const triggerPayment = async () => {
    if (!token) return;
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not send payment prompt");
      setMessage("An M-Pesa prompt has been sent to your phone. Please complete the payment there.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send payment prompt";
      setError(msg);
    } finally {
      setPaying(false);
    }
  };

  return (
    <section className="min-h-[70vh] container py-28 md:py-36 flex items-center justify-center">
      <div className="max-w-xl w-full border border-border bg-bone/50 p-8 md:p-10 text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ember">Pay by M-Pesa</p>
        <h1 className="font-display text-4xl md:text-5xl text-sage-deep">Complete your payment</h1>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" size={16} /> Loading payment details…
          </div>
        )}

        {!loading && target && (
          <>
            <div className="space-y-2">
              <p className="text-foreground/75">{target.description}</p>
              <p className="font-display text-3xl text-sage-deep">{kes(target.amount_kes)}</p>
              <p className="text-sm text-muted-foreground">We will send the M-Pesa prompt to {target.guest_phone}.</p>
            </div>
            {!message && (
              <Button onClick={triggerPayment} disabled={paying} className="w-full">
                {paying ? "Sending M-Pesa prompt…" : "Send M-Pesa Prompt"}
              </Button>
            )}
          </>
        )}

        {message && <p className="text-sage-deep">{message}</p>}
        {error && <p className="text-destructive">{error}</p>}
      </div>
    </section>
  );
};

export default Pay;
