// drivers.driver_type is the single source of truth: 'partner' = commission driver (own vehicle,
// pays the company a commission), 'company' = company fleet driver (cash settlements).
export function isCommissionDriver(d: { driver_type?: string | null } | null | undefined): boolean {
  return d?.driver_type === "partner";
}

export interface PartnerLedger {
  rides: number;
  grossFare: number;
  cashRides: number;
  cashFare: number; // collected by the driver (cash / driver's own UPI)
  onlineRides: number;
  onlineFare: number; // collected by the company (online / wallet)
  commissionPct: number;
  commissionOnCash: number; // driver owes the company
  commissionTotal: number;
  driverShareOnline: number; // company owes the driver
  paidByDriver: number;
  paidToDriver: number;
  /** > 0: driver owes the company this much. < 0: the company owes the driver. */
  balance: number;
}

const DRIVER_COLLECTED = new Set(["cash", "driver_upi"]);

/** Everything a commission driver and the company owe each other, from completed rides and the
 * settlements recorded so far. */
export function partnerLedger(
  rides: Array<{ final_fare?: unknown; estimated_fare?: unknown; payment_method?: string | null }>,
  settlements: Array<{ amount?: unknown; direction?: string | null }>,
  commissionPct: number,
): PartnerLedger {
  const pct = Math.max(0, Number(commissionPct) || 0) / 100;
  let cashFare = 0;
  let onlineFare = 0;
  let cashRides = 0;
  let onlineRides = 0;
  for (const r of rides) {
    const fare = Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)) || 0;
    if (DRIVER_COLLECTED.has(String(r.payment_method || "cash"))) {
      cashFare += fare;
      cashRides++;
    } else {
      onlineFare += fare;
      onlineRides++;
    }
  }
  const commissionOnCash = Math.round(cashFare * pct);
  const commissionOnOnline = Math.round(onlineFare * pct);
  const driverShareOnline = onlineFare - commissionOnOnline;
  let paidByDriver = 0;
  let paidToDriver = 0;
  for (const s of settlements) {
    const amt = Math.round(Number(s.amount) || 0);
    if (s.direction === "company_to_driver") paidToDriver += amt;
    else paidByDriver += amt;
  }
  return {
    rides: cashRides + onlineRides,
    grossFare: cashFare + onlineFare,
    cashRides,
    cashFare,
    onlineRides,
    onlineFare,
    commissionPct: Math.round(pct * 1000) / 10,
    commissionOnCash,
    commissionTotal: commissionOnCash + commissionOnOnline,
    driverShareOnline,
    paidByDriver,
    paidToDriver,
    balance: commissionOnCash - driverShareOnline - paidByDriver + paidToDriver,
  };
}
