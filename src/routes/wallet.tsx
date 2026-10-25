import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Wallet, TrendingDown, TrendingUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Orange Wallet — Orange Taxi" },
      {
        name: "description",
        content: "Add money to your Orange Wallet with UPI or card via Razorpay.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletPage,
});

const PRESETS = [200, 500, 1000, 2000];
const MIN = 100;
const MAX = 25000;

type Tx = {
  id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  created_at: string;
};
type CheckoutResponse = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};
type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function authedPost(path: string, body: unknown) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json };
}

function WalletPage() {
  const { user, loading } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("wallet_balance").eq("id", user.id).maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("id, amount, type, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    const bal = (profile as { wallet_balance?: number | string } | null)?.wallet_balance;
    setBalance(bal == null ? 0 : Number(bal));
    setTxs((rows as Tx[] | null) ?? []);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function topUp() {
    const rupees = Number(amount);
    if (!Number.isInteger(rupees) || rupees < MIN || rupees > MAX) {
      toast.error(`Enter a whole amount between ₹${MIN} and ₹${MAX.toLocaleString("en-IN")}.`);
      return;
    }
    setBusy(true);
    try {
      if (!(await loadCheckout())) {
        toast.error("Could not load the secure payment window. Check your connection.");
        return;
      }
      const order = await authedPost("/api/wallet-topup/order", { amount: rupees });
      if (!order.ok) {
        toast.error(String(order.json["error"] || "Could not start the payment."));
        return;
      }
      const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
      const rzp = new Razorpay({
        key: order.json["keyId"],
        order_id: order.json["orderId"],
        amount: order.json["amount"],
        currency: "INR",
        name: "Orange Taxi",
        description: "Orange Wallet top-up",
        prefill: { email: user?.email ?? "" },
        theme: { color: "#f97316" },
        handler: async (response: CheckoutResponse) => {
          const settle = await authedPost("/api/wallet-topup/settle", response);
          if (settle.ok && settle.json["settled"]) {
            toast.success(`₹${rupees} added to your Orange Wallet.`);
          } else {
            toast.error(
              `Payment received but not yet credited (${String(settle.json["error"] || "please wait")}). It will be credited automatically.`,
            );
          }
          await refresh();
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Wallet className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Orange Wallet</h1>
        <p className="mt-2 text-muted-foreground">Sign in to view your balance and add money.</p>
        <Button asChild className="mt-6">
          <Link to="/login" search={{ redirect: "/wallet" } as never}>
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Wallet className="size-6 text-primary" />
          <h1 className="text-xl font-bold">Orange Wallet</h1>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Available balance</p>
        <p className="text-4xl font-extrabold tracking-tight">
          {balance == null
            ? "…"
            : `₹${balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
        </p>

        <div className="mt-6">
          <Label htmlFor="topup-amount">Add money (₹)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={amount === String(p) ? "default" : "outline"}
                onClick={() => setAmount(String(p))}
              >
                ₹{p.toLocaleString("en-IN")}
              </Button>
            ))}
          </div>
          <Input
            id="topup-amount"
            className="mt-3"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <Button className="mt-4 w-full" disabled={busy} onClick={() => void topUp()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Pay with UPI / card
          </Button>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Payments are processed by Razorpay and credited
            only after confirmation.
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recent activity
      </h2>
      <ul className="mt-3 divide-y rounded-2xl border bg-card">
        {txs.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No wallet activity yet.</li>
        ) : (
          txs.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-4">
              {t.type === "credit" ? (
                <TrendingUp className="size-4 text-green-600" />
              ) : (
                <TrendingDown className="size-4 text-red-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <span className={t.type === "credit" ? "text-green-600" : "text-red-600"}>
                {t.type === "credit" ? "+" : "−"}₹{Number(t.amount).toLocaleString("en-IN")}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
