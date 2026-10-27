// Admin → Support: tickets from the Support page and the apps (complaints, lost items, refund
// requests), and the refunds ledger.
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RefundDialog, type RefundTarget } from "@/components/refund-dialog";

interface Ticket {
  id: string;
  docket_number: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string;
  complaint_type: string;
  booking_reference: string | null;
  booking_id: string | null;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  admin_notes: string | null;
  resolution_at: string | null;
  created_at: string;
}

interface RefundRow {
  id: string;
  booking_id: string | null;
  amount: number;
  method: string;
  status: string;
  razorpay_refund_id: string | null;
  reason: string;
  created_at: string;
  bookings?: { reference: string | null } | null;
}

interface BookingLite {
  id: string;
  reference: string | null;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  payment_intent_id: string | null;
  estimated_fare: number | null;
  final_fare: number | null;
}

const STATUS_STYLE: Record<Ticket["status"], string> = {
  open: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const TYPE_LABEL: Record<string, string> = {
  refund: "Refund request",
  general: "General",
  billing: "Billing / fare",
  driver: "Chauffeur conduct",
  safety: "Safety",
  lost_found: "Lost item",
  privacy: "Privacy / data",
  app: "App / technical",
};

const db = supabase as any; // support_tickets / refunds are not in the generated types yet

export function SupportManager() {
  const [view, setView] = useState<"tickets" | "refunds">("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | Ticket["status"] | "all">("active");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);

  async function load() {
    setLoading(true);
    const [t, r] = await Promise.all([
      db.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(500),
      db
        .from("refunds")
        .select("*, bookings(reference)")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (t.error) toast.error("Could not load tickets: " + t.error.message);
    else setTickets(t.data as Ticket[]);
    if (!r.error) setRefunds(r.data as RefundRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-support-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter === "active" && !(t.status === "open" || t.status === "in_progress"))
        return false;
      if (statusFilter !== "active" && statusFilter !== "all" && t.status !== statusFilter)
        return false;
      if (!term) return true;
      return [t.docket_number, t.name, t.email, t.phone, t.booking_reference, t.message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [tickets, statusFilter, search]);

  const counts = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === "open").length,
      in_progress: tickets.filter((t) => t.status === "in_progress").length,
      refunds: tickets.filter(
        (t) => t.complaint_type === "refund" && (t.status === "open" || t.status === "in_progress"),
      ).length,
    }),
    [tickets],
  );

  async function updateTicket(t: Ticket, patch: Partial<Ticket>) {
    const { error } = await db.from("support_tickets").update(patch).eq("id", t.id);
    if (error) {
      toast.error("Could not update: " + error.message);
      return;
    }
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    toast.success("Ticket updated.");
  }

  async function openRefund(t: Ticket) {
    let q = db
      .from("bookings")
      .select(
        "id, reference, status, payment_method, payment_status, payment_intent_id, estimated_fare, final_fare",
      );
    if (t.booking_id) q = q.eq("id", t.booking_id);
    else if (t.booking_reference) q = q.eq("reference", t.booking_reference.trim().toUpperCase());
    else {
      toast.error("This ticket has no booking reference. Ask the passenger for it first.");
      return;
    }
    const { data, error } = await q.limit(1);
    const b = (data as BookingLite[] | null)?.[0];
    if (error || !b) {
      toast.error(`No booking found for "${t.booking_reference}".`);
      return;
    }
    const paid =
      b.payment_status === "paid" ? Math.round(Number(b.final_fare ?? b.estimated_fare) || 0) : 0;
    if (paid <= 0) {
      toast.error(
        "Nothing was paid for this booking. Unpaid cancellation fees can be waived in Admin → Pricing.",
      );
      return;
    }
    const done = refunds
      .filter((r) => r.booking_id === b.id && r.status !== "failed")
      .reduce((s, r) => s + Math.round(Number(r.amount) || 0), 0);
    setRefundTarget({
      bookingId: b.id,
      reference: b.reference,
      paidAmount: paid,
      alreadyRefunded: done,
      paymentMethod: b.payment_method,
      paymentIntentId: b.payment_intent_id,
      ticketId: t.id,
      suggestedReason: `Ticket ${t.docket_number}`,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Complaints and refund requests from the website and apps. Acknowledge within 48 hours,
            resolve within 30 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "tickets" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("tickets")}
          >
            Tickets
            {counts.open > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {counts.open}
              </span>
            )}
          </Button>
          <Button
            variant={view === "refunds" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("refunds")}
          >
            Refunds
          </Button>
          <Button variant="ghost" size="sm" onClick={load} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4 border-border bg-background">
          <p className="text-sm text-muted-foreground">Open</p>
          <p className="text-3xl font-semibold">{counts.open}</p>
        </div>
        <div className="rounded-xl border p-4 border-border bg-background">
          <p className="text-sm text-muted-foreground">In progress</p>
          <p className="text-3xl font-semibold">{counts.in_progress}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Refund requests waiting</p>
          <p className="text-3xl font-semibold">{counts.refunds}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === "tickets" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docket, name, phone, booking reference…"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="active">Open + in progress</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No tickets here.</p>
          ) : (
            <div className="space-y-2">
              {visible.map((t) => {
                const open = expanded === t.id;
                return (
                  <div key={t.id} className="rounded-xl border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : t.id)}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold">{t.docket_number}</span>
                          <Badge variant="outline" className={STATUS_STYLE[t.status]}>
                            {t.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline">
                            {TYPE_LABEL[t.complaint_type] || t.complaint_type}
                          </Badge>
                          {t.booking_reference && (
                            <span className="text-xs text-muted-foreground">
                              Ride {t.booking_reference}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm">
                          <strong>{t.name}</strong> · {t.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>

                    {open && (
                      <div className="space-y-3 border-t border-border p-4 text-sm">
                        <p className="whitespace-pre-wrap">{t.message}</p>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`tel:${t.phone.replace(/[^\d+]/g, "")}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            <Phone className="size-3.5" /> {t.phone}
                          </a>
                          {t.email && (
                            <a
                              href={`mailto:${t.email}?subject=${encodeURIComponent(`Your Orange Taxi ticket ${t.docket_number}`)}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                            >
                              <Mail className="size-3.5" /> {t.email}
                            </a>
                          )}
                          {(t.booking_reference || t.booking_id) && (
                            <Button size="sm" variant="outline" onClick={() => openRefund(t)}>
                              <RotateCcw className="size-3.5 mr-1" /> Refund this ride
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-bold">Internal notes</p>
                          <Textarea
                            rows={2}
                            value={notes[t.id] ?? t.admin_notes ?? ""}
                            onChange={(e) => setNotes((p) => ({ ...p, [t.id]: e.target.value }))}
                            placeholder="What was done, who called back…"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={t.status}
                            onChange={(e) =>
                              updateTicket(t, {
                                status: e.target.value as Ticket["status"],
                                admin_notes: notes[t.id] ?? t.admin_notes,
                              })
                            }
                            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                          <Button
                            size="sm"
                            onClick={() =>
                              updateTicket(t, { admin_notes: notes[t.id] ?? t.admin_notes })
                            }
                          >
                            Save notes
                          </Button>
                          {t.resolution_at && (
                            <span className="text-xs text-muted-foreground">
                              Resolved {new Date(t.resolution_at).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : refunds.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No refunds yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Ride</th>
                <th className="p-3">Amount</th>
                <th className="p-3">To</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("en-IN")}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.bookings?.reference || "—"}</td>
                  <td className="p-3 font-bold">₹{Math.round(Number(r.amount))}</td>
                  <td className="p-3">
                    {r.method === "razorpay"
                      ? `Razorpay${r.razorpay_refund_id ? ` (${r.razorpay_refund_id})` : ""}`
                      : r.method === "wallet"
                        ? "Orange Wallet"
                        : "Manual (cash / UPI)"}
                  </td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3 text-muted-foreground">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RefundDialog target={refundTarget} onClose={() => setRefundTarget(null)} onDone={load} />
    </div>
  );
}
