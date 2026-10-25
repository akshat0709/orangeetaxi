// Current fares as set in the admin Pricing tab, for pages that describe pricing in words.
import {
  cancellationPolicyText,
  surgeOf,
  usePricingSettings,
  useVehicleCategories,
} from "@/lib/pricing";

export function LiveTariffList() {
  const vehicles = useVehicleCategories();
  const p = usePricingSettings();
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
      {vehicles.length === 0 ? (
        <li>Current base fare, per-km rate and minimum fare are shown on the booking page.</li>
      ) : (
        vehicles.map((v) => (
          <li key={v.code}>
            <strong>{v.name}:</strong> ₹{v.base_fare} base fare + ₹{v.per_km} per km, minimum fare ₹
            {v.minimum_fare}.
          </li>
        ))
      )}
      {p.tax_percent > 0 && (
        <li>
          <strong>GST:</strong> {p.tax_percent}% on the ride fare.
        </li>
      )}
      {p.platform_fee > 0 && (
        <li>
          <strong>Platform fee:</strong> ₹{p.platform_fee} per ride.
        </li>
      )}
      {surgeOf(p) > 1 && (
        <li>
          <strong>Surge:</strong> currently {surgeOf(p)}× on the ride fare (shown before you book).
        </li>
      )}
      <li>
        <strong>Waiting:</strong> {p.waiting_free_minutes} minutes free at pickup, then ₹
        {p.waiting_charge_per_min} per minute.
      </li>
      <li>
        <strong>Cancellation:</strong> {cancellationPolicyText(p)}
      </li>
    </ul>
  );
}
