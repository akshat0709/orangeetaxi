import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { usePricingSettings } from "@/lib/pricing";

interface WaitingFeeTimerProps {
  arrivedAt?: string | null;
  isDriver?: boolean;
}

export function WaitingFeeTimer({ arrivedAt, isDriver = false }: WaitingFeeTimerProps) {
  // Free minutes and the per-minute rate come from the admin Pricing tab.
  const pricing = usePricingSettings();
  const FREE_WAITING_SECONDS = Math.round(pricing.waiting_free_minutes * 60);
  const WAITING_RATE_PER_MIN = pricing.waiting_charge_per_min;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startTime = arrivedAt ? new Date(arrivedAt).getTime() : Date.now();

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const isFree = elapsedSeconds < FREE_WAITING_SECONDS;
  const remainingFreeSec = Math.max(0, FREE_WAITING_SECONDS - elapsedSeconds);
  const freeMins = Math.floor(remainingFreeSec / 60);
  const freeSecs = remainingFreeSec % 60;

  const overdueSec = Math.max(0, elapsedSeconds - FREE_WAITING_SECONDS);
  const overdueMins = Math.ceil(overdueSec / 60);
  const accumulatedCharge = overdueMins * WAITING_RATE_PER_MIN;

  const progressPercent = Math.min(100, (elapsedSeconds / Math.max(1, FREE_WAITING_SECONDS)) * 100);

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isFree
          ? "border-amber-500/40 bg-amber-500/10 text-foreground"
          : "border-rose-500/50 bg-rose-500/10 text-foreground animate-pulse"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className={`size-4.5 ${isFree ? "text-amber-500" : "text-rose-500"}`} />
          <span className="text-xs font-bold uppercase tracking-wider">
            {isFree ? "Complimentary Waiting Window" : "Waiting Charges Applying"}
          </span>
        </div>
        <span
          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
            isFree ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-rose-500 text-white"
          }`}
        >
          {isFree
            ? `${String(freeMins).padStart(2, "0")}:${String(freeSecs).padStart(2, "0")} Free`
            : `+₹${accumulatedCharge}`}
        </span>
      </div>

      {isFree ? (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {isDriver
                ? `Customer has ${pricing.waiting_free_minutes} minutes complimentary waiting upon arrival.`
                : "Driver is waiting at pickup. Please meet at vehicle."}
            </span>
            <span className="font-semibold text-foreground font-mono">
              {String(freeMins).padStart(2, "0")}:{String(freeSecs).padStart(2, "0")} left
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full bg-amber-500 transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-2 text-xs space-y-1">
          <div className="flex items-center justify-between font-semibold">
            <span className="text-rose-600 dark:text-rose-400">
              Free waiting ended ({Math.floor(elapsedSeconds / 60)} mins total)
            </span>
            <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
              ₹{WAITING_RATE_PER_MIN}/min thereafter
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isDriver
              ? `Waiting fee of ₹${accumulatedCharge} is being recorded and will be added to total fare upon completion.`
              : `To keep drivers compensated fairly, ₹${accumulatedCharge} has accumulated so far.`}
          </p>
        </div>
      )}
    </div>
  );
}
