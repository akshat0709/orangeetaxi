// Shows a one-time Razorpay UPI QR and waits for the payment. The money goes to Orange Taxi's
// Razorpay account; the server records it (ride paid online / cash hand-in / commission).
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export type UpiQrRequest =
  | { kind: "ride"; bookingId: string }
  | { kind: "cash_deposit" | "commission"; driverId: string; amount: number };

type Qr = { id: string; amount: number; status: "pending" | "paid" | "closed"; image_url: string };

async function authed(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; qr?: Qr };
  if (!res.ok || !body.ok || !body.qr)
    throw new Error(body.error || `Request failed (${res.status})`);
  return body.qr;
}

export function UpiQrDialog({
  request,
  title,
  onClose,
  onPaid,
}: {
  request: UpiQrRequest | null;
  title: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paidRef = useRef(false);

  useEffect(() => {
    if (!request) return;
    let stop = false;
    paidRef.current = false;
    setQr(null);
    setError(null);
    const body =
      request.kind === "ride"
        ? { bookingId: request.bookingId }
        : { driverId: request.driverId, amount: request.amount, kind: request.kind };
    authed(request.kind === "ride" ? "/api/qr/ride" : "/api/qr/deposit", {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then((q) => {
        if (stop) return;
        setQr(q);
        const poll = async () => {
          if (stop) return;
          try {
            const latest = await authed(`/api/qr/status?id=${encodeURIComponent(q.id)}`);
            if (stop) return;
            setQr(latest);
            if (latest.status === "paid") {
              if (!paidRef.current) {
                paidRef.current = true;
                onPaid();
              }
              return;
            }
            if (latest.status === "closed") return;
          } catch {
            /* network blip: keep polling */
          }
          setTimeout(poll, 4000);
        };
        setTimeout(poll, 4000);
      })
      .catch((e: Error) => !stop && setError(e.message));
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95svh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>
            Scan with any UPI app (GPay, PhonePe, Paytm…). Paid straight to Orange Taxi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2 text-center">
          {error ? (
            <>
              <XCircle className="size-10 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </>
          ) : !qr ? (
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          ) : qr.status === "paid" ? (
            <>
              <CheckCircle2 className="size-16 text-green-600" />
              <p className="text-lg font-bold">Payment received</p>
              <p className="text-sm text-muted-foreground">
                ₹{qr.amount.toLocaleString("en-IN")} paid by UPI.
              </p>
            </>
          ) : qr.status === "closed" ? (
            <>
              <XCircle className="size-10 text-muted-foreground" />
              <p className="text-sm">This QR expired. Close and try again.</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold">₹{qr.amount.toLocaleString("en-IN")}</p>
              <img
                src={qr.image_url}
                alt="UPI QR code"
                className="h-auto max-h-[min(52svh,460px)] w-auto max-w-full rounded-lg border bg-white object-contain"
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Waiting for payment…
              </p>
            </>
          )}
        </div>
        <Button variant={qr?.status === "paid" ? "default" : "outline"} onClick={onClose}>
          {qr?.status === "paid" ? "Done" : "Close"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
