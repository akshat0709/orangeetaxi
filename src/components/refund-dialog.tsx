// Admin: refund (part of) what a passenger paid for a ride. The website server makes the refund
// (Razorpay, Orange Wallet, or a recorded manual cash/UPI refund) and keeps the ledger.
import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface RefundTarget {
  bookingId: string;
  reference: string | null;
  paidAmount: number;
  alreadyRefunded: number;
  paymentMethod: string | null;
  paymentIntentId: string | null;
  ticketId?: string | null;
  suggestedReason?: string;
}

function autoMethodLabel(t: RefundTarget) {
  if (t.paymentMethod === "wallet") return "Back to the passenger's Orange Wallet";
  if (t.paymentIntentId?.startsWith("pay_")) return "Back to the original UPI / card (Razorpay)";
  return "Record a refund you paid by cash / UPI yourself";
}

export function RefundDialog({
  target,
  onClose,
  onDone,
}: {
  target: RefundTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const refundable = target ? Math.max(0, target.paidAmount - target.alreadyRefunded) : 0;
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<"auto" | "wallet" | "manual">("auto");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setAmount(refundable || "");
    setMethod("auto");
    setReason(target.suggestedReason || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.bookingId, target?.ticketId]);

  async function submit() {
    if (!target) return;
    const amt = Math.round(Number(amount));
    if (!amt || amt < 1 || amt > refundable) {
      toast.error(`Enter an amount between ₹1 and ₹${refundable}.`);
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Please write a short reason.");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          bookingId: target.bookingId,
          amount: amt,
          reason: reason.trim(),
          method,
          ticketId: target.ticketId || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        refund?: { method: string; status: string };
      };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success(
        json.refund?.method === "razorpay"
          ? `₹${amt} refund sent via Razorpay${json.refund.status === "pending" ? " (processing, 5–7 working days)" : ""}.`
          : json.refund?.method === "wallet"
            ? `₹${amt} credited to the passenger's wallet.`
            : `₹${amt} manual refund recorded.`,
      );
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-5 text-primary" /> Refund ride {target?.reference || ""}
          </DialogTitle>
          <DialogDescription>
            Paid ₹{target?.paidAmount ?? 0}
            {target && target.alreadyRefunded > 0
              ? ` · already refunded ₹${target.alreadyRefunded}`
              : ""}{" "}
            · refundable ₹{refundable}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Amount (₹)</Label>
            <Input
              type="number"
              min={1}
              max={refundable}
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Math.round(Number(e.target.value)) : "")}
              className="font-mono font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Refund to</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "auto" | "wallet" | "manual")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="auto">
                {target ? autoMethodLabel(target) : "Original payment method"}
              </option>
              <option value="wallet">Orange Wallet credit</option>
              <option value="manual">Manual (I paid it back by cash / UPI)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Reason (shown in the ledger)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Driver didn't arrive; cancellation fee charged by mistake"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submit} disabled={busy || refundable <= 0}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : `Refund ₹${amount || 0}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
