import { useMemo, useState } from "react";
import restaurantImg from "@/assets/restaurant.jpg";
import { Link } from "react-router-dom";
import { useRestaurantMenu } from "@/hooks/useRestaurantMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const kes = (value: number) => `KES ${value.toLocaleString()}`;

const Restaurant = () => {
  const { data: menuItems = [], isLoading } = useRestaurantMenu();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentPreference, setPaymentPreference] = useState<"bill_later" | "pay_now">("bill_later");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(
    () =>
      menuItems.reduce<Record<string, typeof menuItems>>((acc, item) => {
        acc[item.section] = acc[item.section] ?? [];
        acc[item.section].push(item);
        return acc;
      }, {}),
    [menuItems],
  );

  const selectedItems = menuItems
    .map((item) => ({
      menu_item_id: item.id,
      quantity: quantities[item.id] ?? 0,
      title: item.title,
      price_kes: item.price_kes,
    }))
    .filter((item) => item.quantity > 0);

  const orderTotal = selectedItems.reduce((sum, item) => sum + item.quantity * item.price_kes, 0);

  const submitOrder = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast({
        title: "Missing details",
        description: "Please enter your name and phone number before sending your meal choices.",
        variant: "destructive",
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: "No meals selected",
        description: "Please choose at least one menu item.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/restaurant-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim(),
          notes: notes.trim(),
          payment_preference: paymentPreference,
          items: selectedItems.map((item) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
          })),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Could not place your meal order");
      }

      toast({
        title: "Meal choices received",
        description:
          paymentPreference === "pay_now"
            ? body?.promptSent
              ? "Your order has been recorded and an M-Pesa prompt has been sent."
              : body?.promptError || "Your order was recorded, but the payment prompt was not sent."
            : "Your order has been added to your stay bill.",
      });

      setQuantities({});
      setNotes("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not place your meal order";
      toast({ title: "Order not sent", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="relative min-h-[70vh] flex items-center">
        <img
          src={restaurantImg}
          alt="Restaurant tables at Wild By LERA"
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1200}
        />
        <div className="absolute inset-0 bg-ink/65" />
        <div className="relative container py-32 md:py-40">
          <p className="text-bone/80 text-xs uppercase tracking-[0.4em] mb-6">The Restaurant</p>
          <h1 className="font-display text-bone text-5xl md:text-7xl lg:text-[88px] leading-[0.95] max-w-4xl text-balance">
            Seasonal menu under the acacias.
          </h1>
          <p className="mt-8 text-bone/85 text-lg md:text-xl max-w-2xl font-extralight font-serif">
            Browse what is currently available, with prices included. We only show dishes that are active right now.
          </p>
        </div>
      </section>

      <section className="container py-20 md:py-28">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ember mb-4">Current menu</p>
            <h2 className="font-display text-4xl md:text-5xl text-sage-deep mb-5 text-balance">
              Choose what you would like us to prepare.
            </h2>
            <p className="text-foreground/75 leading-relaxed mb-4">
              Menu items appear here only when they are available. Prices are shown for each dish.
            </p>
            <p className="text-foreground/75 leading-relaxed">
              Tell us your meal choices in your booking notes, by WhatsApp, or when we confirm your stay.
            </p>
            <Link
              to="/contact#booking"
              className="inline-flex items-center mt-6 px-6 py-3 bg-sage-deep text-bone text-sm uppercase tracking-[0.2em] hover:bg-sage transition-colors"
            >
              Book your stay
            </Link>
          </div>

          <div className="lg:col-span-8">
            {isLoading && <p className="text-muted-foreground">Loading menu…</p>}

            {!isLoading && menuItems.length === 0 && (
              <div className="border border-border/60 bg-bone/40 p-8">
                <h3 className="font-display text-2xl text-sage-deep mb-3">Seasonal menu coming through shortly.</h3>
                <p className="text-foreground/75">
                  We are updating the currently available dishes. Please check back soon or message us directly.
                </p>
              </div>
            )}

            <div className="space-y-10">
              {Object.entries(grouped).map(([section, items]) => (
                <section key={section} className="border border-border/60 bg-bone/40 p-6 md:p-8">
                  <h3 className="font-display text-3xl text-sage-deep mb-6">{section}</h3>
                  <div className="space-y-5">
                    {items.map((item) => (
                      <article key={item.id} className="flex items-start justify-between gap-6 border-b border-border/50 pb-5 last:border-b-0 last:pb-0">
                        <div>
                          <h4 className="font-display text-2xl text-sage-deep">{item.title}</h4>
                          {item.description && (
                            <p className="text-foreground/75 mt-2 leading-relaxed">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display text-2xl text-sage-deep">{kes(item.price_kes)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {menuItems.length > 0 && (
              <section className="mt-10 border border-dashed border-border bg-linen/50 p-6 md:p-8 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-ember mb-2">Meal order</p>
                  <h3 className="font-display text-3xl text-sage-deep">Send us your food choices</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Choose your meals before arrival or while staying with us. You can pay now by M-Pesa or add the order to your stay bill.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Your name</Label>
                    <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Email</Label>
                    <Input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>How would you like to pay?</Label>
                  <Select value={paymentPreference} onValueChange={(value) => setPaymentPreference(value as "bill_later" | "pay_now")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bill_later">Add this order to my stay bill</SelectItem>
                      <SelectItem value="pay_now">Send me an M-Pesa prompt now</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label>Select meals and quantities</Label>
                  <div className="space-y-3">
                    {menuItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 border border-border/60 bg-bone/40 p-4">
                        <div>
                          <p className="font-display text-xl text-sage-deep">{item.title}</p>
                          {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                          <p className="text-sm text-foreground/80 mt-2">{kes(item.price_kes)}</p>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min={0}
                            value={quantities[item.id] ?? 0}
                            onChange={(e) =>
                              setQuantities((current) => ({
                                ...current,
                                [item.id]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Notes or special requests</Label>
                  <Textarea
                    rows={3}
                    placeholder="Any dietary notes, serving time requests, or preferences"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} selected
                    </span>
                    <span className="font-display text-2xl text-sage-deep">{kes(orderTotal)}</span>
                  </div>
                  <Button onClick={submitOrder} disabled={submitting}>
                    {submitting ? "Sending order…" : paymentPreference === "pay_now" ? "Order and Pay Now" : "Add Order to My Stay Bill"}
                  </Button>
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default Restaurant;
