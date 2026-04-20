import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, AlertCircle } from "lucide-react";

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: apiKey },
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState("invalid");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") setState("already");
        else if (data.valid === true) setState("valid");
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setErrorMsg(error.message);
      setState("error");
      return;
    }
    if (data?.success || data?.reason === "already_unsubscribed") setState("done");
    else {
      setErrorMsg("Could not process unsubscribe.");
      setState("error");
    }
  };

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md bg-bone border border-border p-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-ember mb-3">Wild by LERA</p>
        <h1 className="font-display text-3xl text-sage-deep mb-4">Email preferences</h1>

        {state === "loading" && (
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={16} /> Checking your link…
          </p>
        )}

        {state === "valid" && (
          <>
            <p className="text-foreground/80 mb-6">
              Click below to unsubscribe from emails from Wild by LERA.
            </p>
            <button
              onClick={confirm}
              className="bg-sage-deep hover:bg-sage text-bone py-3 px-6 text-sm uppercase tracking-[0.2em] transition-colors"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state === "submitting" && (
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={16} /> Updating your preferences…
          </p>
        )}

        {(state === "done" || state === "already") && (
          <div>
            <div className="mx-auto w-12 h-12 rounded-full bg-sage-deep text-bone flex items-center justify-center mb-4">
              <Check size={22} />
            </div>
            <p className="text-foreground/80">
              {state === "already" ? "You're already unsubscribed." : "You've been unsubscribed. We're sorry to see you go."}
            </p>
          </div>
        )}

        {(state === "invalid" || state === "error") && (
          <div>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <AlertCircle size={22} />
            </div>
            <p className="text-foreground/80">
              {errorMsg || "This link is invalid or has expired."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
};

export default Unsubscribe;