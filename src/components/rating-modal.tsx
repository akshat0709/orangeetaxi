import { useState } from "react";
import { Check, Loader2, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    reference: string;
    pickup_area?: string;
    drop_area?: string;
    driver_id?: string;
    estimated_fare?: number;
    final_fare?: number;
  } | null;
  driver: {
    id?: string;
    full_name?: string;
    vehicle_model?: string;
    vehicle_number?: string;
  } | null;
  onSubmitted: () => void;
}

const COMPLIMENT_OPTIONS = [
  { id: "smooth", label: "Smooth & Safe Driving" },
  { id: "ac", label: "Chilled Pre-Cooled AC" },
  { id: "clean", label: "Spotless EV Cabin" },
  { id: "polite", label: "Courteous Driver" },
  { id: "route", label: "Fast & Direct Route" },
  { id: "water", label: "Chilled Water Bottle" },
];

const STAR_LABELS: Record<number, string> = {
  1: "Disappointing",
  2: "Needs Improvement",
  3: "Good Ride",
  4: "Very Good!",
  5: "Exceptional Experience!",
};

const TIP_OPTIONS = [0, 20, 50, 100];

export function RatingModal({
  open,
  onOpenChange,
  booking,
  driver,
  onSubmitted,
}: RatingModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([]);
  const [tip, setTip] = useState<number>(0);
  const [isCustomTip, setIsCustomTip] = useState(false);
  const [customTipVal, setCustomTipVal] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function toggleCompliment(label: string) {
    setSelectedCompliments((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    );
  }

  async function handleSubmit() {
    if (!booking) return;
    setSubmitting(true);

    try {
      // 1. Update the booking with rating and review
      const fullReview = [...selectedCompliments, comment.trim()].filter(Boolean).join(" · ");

      const { error: bookingErr } = await supabase
        .from("bookings")
        .update({
          rating: rating,
          review: fullReview,
        })
        .eq("id", booking.id);

      if (bookingErr) {
        // Previously only logged, and the UI still said "Thank you for your rating!".
        console.warn("Could not save rating in bookings table:", bookingErr);
        toast.error("Could not save your rating. Please try again.", {
          description: bookingErr.message,
        });
        setSubmitting(false);
        return;
      }

      // Driver rating and trip totals are recomputed by the handle_booking_driver_stats trigger.
      // The old client-side write to `drivers` was blocked by RLS for passengers.
      const driverId = driver?.id || booking.driver_id;

      // Store in local storage as well for audit persistence
      try {
        const storedReviews = JSON.parse(localStorage.getItem("orange_driver_reviews") || "[]");
        storedReviews.push({
          booking_id: booking.id,
          reference: booking.reference,
          driver_id: driverId,
          driver_name: driver?.full_name,
          rating,
          tip,
          compliments: selectedCompliments,
          comment,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem("orange_driver_reviews", JSON.stringify(storedReviews));
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

      setIsSuccess(true);
      toast.success("Thank you for your rating!");

      setTimeout(() => {
        setIsSuccess(false);
        onOpenChange(false);
        onSubmitted();
      }, 1500);
    } catch (err: any) {
      toast.error("Failed to submit rating: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const activeStars = hoverRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-background rounded-2xl border border-border shadow-2xl text-foreground">
        {isSuccess ? (
          <div className="py-10 text-center flex flex-col items-center justify-center space-y-3">
            <div className="size-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Check className="size-8 stroke-[3]" />
            </div>
            <h3 className="text-xl font-bold font-serif">Thank You!</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your feedback directly supports our drivers and ensures an exceptional Orange
              experience.
            </p>
          </div>
        ) : (
          <div>
            <DialogHeader className="text-center pb-3 border-b border-border">
              <div className="mx-auto size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
                <Sparkles className="size-6" />
              </div>
              <DialogTitle className="text-xl font-bold font-serif">Ride Completed</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                How was your experience with{" "}
                <strong className="text-foreground">{driver?.full_name || "your driver"}</strong>?
              </p>
              {driver?.vehicle_number && driver.vehicle_number !== "Unassigned" && (
                <div className="mt-1">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
                    {driver.vehicle_number}
                  </span>
                </div>
              )}
            </DialogHeader>

            <div className="mt-6 flex flex-col items-center space-y-2">
              {/* Star Rating Row */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                  >
                    <Star
                      className={`size-8 transition-colors ${
                        star <= activeStars
                          ? "text-amber-400 fill-amber-400 drop-shadow-md"
                          : "text-muted-foreground/30 hover:text-muted-foreground/60"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold text-primary tracking-wide">
                {STAR_LABELS[activeStars] || "Select your rating"}
              </p>
            </div>

            {/* Compliment Badges */}
            <div className="mt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                What went well?
              </p>
              <div className="flex flex-wrap gap-2">
                {COMPLIMENT_OPTIONS.map((c) => {
                  const isSelected = selectedCompliments.includes(c.label);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCompliment(c.label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold scale-105"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Driver Tip */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Add a Tip for Driver (Optional)
                </p>
                {tip > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    +₹{tip} Tip
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {TIP_OPTIONS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setIsCustomTip(false);
                      setCustomTipVal("");
                      setTip(amt);
                    }}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all border ${
                      !isCustomTip && tip === amt
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold scale-105"
                        : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {amt === 0 ? "No Tip" : `₹${amt}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomTip(true);
                    if (TIP_OPTIONS.includes(tip)) setTip(0);
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all border ${
                    isCustomTip
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold scale-105"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomTip && (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground pl-1">₹</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    placeholder="Enter custom tip amount..."
                    value={customTipVal}
                    onChange={(e) => {
                      setCustomTipVal(e.target.value);
                      const parsed = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setTip(parsed);
                    }}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Comments Input */}
            <div className="mt-5">
              <Textarea
                placeholder="Leave any additional feedback for the driver or Orange team..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onSubmitted();
                }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Skip
              </Button>
              <Button
                type="button"
                className="flex-1 font-bold text-xs"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>Submit Rating {tip > 0 && `(₹${tip} Tip)`}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
