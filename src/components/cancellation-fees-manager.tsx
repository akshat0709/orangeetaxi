// Admin → Cancellation Fees: every cancellation fee (unpaid, settled, waived), searchable.
// A fee is added to the passenger's next ride and settled when that ride is paid; admins can waive
// an unpaid one (e.g. after a complaint). Settled fees are refunded from Support → Refund this ride.
import { useEffect, useMemo, useState } from "react";
import { Ban, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FeeRow {
  id: string;
  customer_id: string | null;
  amount: number;
  status: "due" | "settled" | "waived";
  created_at: string;
  settled_at: string | null;
  booking: {
    reference: string | null;
    pickup_area: string | null;
    drop_area: string | null;
  } | null;
  carried: { reference: string | null; status: string | null } | null;
}

interface Person {
  id: string;
  full_name: string | null;
  phone: string | null;
}

const STATUS_STYLE: Record<FeeRow["status"], string> = {
  due: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  settled: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  waived: "bg-muted text-muted-foreground border-border",
};
const STATUS_LABEL: Record<FeeRow["status"], string> = {
  due: "Unpaid",
  settled: "Paid",
  waived: "Waived",
};

const db = supabase as any; // cancellation_dues isn't in the generated types yet

export function CancellationFeesManager() {
  const [rows, setRows] = useState<FeeRow[] | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | FeeRow["status"]>("due");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await db
      .from("cancellation_dues")
      .select(
        "id, customer_id, amount, status, created_at, settled_at, booking:bookings!cancellation_dues_booking_id_fkey(reference, pickup_area, drop_area), carried:bookings!cancellation_dues_carried_by_fkey(reference, status)",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast.error("Could not load cancellation fees: " + error.message);
      setRows([]);
      return;
    }
    const list = (data as FeeRow[]) || [];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.customer_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: ps } = await db.from("profiles").select("id, full_name, phone").in("id", ids);
      setPeople(Object.fromEntries(((ps as Person[]) || []).map((p) => [p.id, p])));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function waive(r: FeeRow) {
    setBusy(r.id);
    const { error } = await db
      .from("cancellation_dues")
      .update({ status: "waived" })
      .eq("id", r.id);
    setBusy(null);
    if (error) {
      toast.error("Could not waive: " + error.message);
      return;
    }
    toast.success(`₹${Number(r.amount)} fee waived.`);
    setRows((prev) => (prev || []).map((x) => (x.id === r.id ? { ...x, status: "waived" } : x)));
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      const p = r.customer_id ? people[r.customer_id] : undefined;
      return [
        r.booking?.reference,
        r.carried?.reference,
        r.booking?.pickup_area,
        r.booking?.drop_area,
        p?.full_name,
        p?.phone,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, people, search, status]);

  const totals = useMemo(() => {
    const sum = (s: FeeRow["status"]) =>
      (rows || []).filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount || 0), 0);
    return { due: sum("due"), settled: sum("settled"), waived: sum("waived") };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="display-serif text-2xl font-bold flex items-center gap-2">
            <Ban className="size-6 text-primary" /> Cancellation Fees
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Each fee is added to the passenger&apos;s next ride and marked paid when that ride is
            paid. Waive an unpaid fee here; refund a paid one from Support.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} title="Refresh">
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 dark:bg-amber-950/20">
          <p className="text-[11px] font-semibold uppercase text-amber-700">Unpaid</p>
          <p className="text-3xl font-bold text-amber-700">₹{Math.round(totals.due)}</p>
        </div>
        <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
          <p className="text-[11px] font-semibold uppercase text-emerald-700">Collected</p>
          <p className="text-3xl font-bold text-emerald-700">₹{Math.round(totals.settled)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Waived</p>
          <p className="text-3xl font-bold text-muted-foreground">₹{Math.round(totals.waived)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search passenger name, phone, ride reference or place…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="due">Unpaid</option>
          <option value="settled">Paid</option>
          <option value="waived">Waived</option>
          <option value="all">All</option>
        </select>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No fees match.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Passenger</th>
                <th className="p-3">Cancelled ride</th>
                <th className="p-3">Fee</th>
                <th className="p-3">Status</th>
                <th className="p-3">Added to ride</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const p = r.customer_id ? people[r.customer_id] : undefined;
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-3 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold">{p?.full_name || "—"}</div>
                      {p?.phone && (
                        <a
                          href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}
                          className="text-xs text-primary hover:underline"
                        >
                          {p.phone}
                        </a>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs font-bold">
                        #{r.booking?.reference || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.booking?.pickup_area} → {r.booking?.drop_area}
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold">₹{Number(r.amount)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_STYLE[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                      {r.settled_at && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(r.settled_at).toLocaleDateString("en-IN")}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {r.carried?.reference ? (
                        <span className="font-mono">
                          #{r.carried.reference}
                          {r.status === "due" ? ` (${r.carried.status})` : ""}
                        </span>
                      ) : r.status === "due" ? (
                        <span className="text-muted-foreground">Waiting for next ride</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {r.status === "due" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.id}
                          onClick={() => waive(r)}
                        >
                          {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : "Waive"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
