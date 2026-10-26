// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Phone,
  PhoneCall,
  MessageSquare,
  Share2,
  AlertTriangle,
  UserCheck,
  Pencil,
  Copy,
  Check,
  X,
  ExternalLink,
  LifeBuoy,
  Radio,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBookingVehiclePlate } from "@/lib/ride-vehicle";

export interface GuardianContact {
  name: string;
  phone: string;
  relationship?: string;
}

interface GuardianSafetyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingData?: { id: string; reference: string; otp?: string };
  driverInfo?: {
    full_name: string;
    phone: string;
    vehicle_number?: string;
    vehicle_model?: string;
  };
  pickup?: { name: string };
  drop?: { name: string };
  vehicle?: { name: string };
}

export function GuardianSafetyModal({
  open,
  onOpenChange,
  bookingData,
  driverInfo,
  pickup,
  drop,
  vehicle,
}: GuardianSafetyModalProps) {
  const [guardian, setGuardian] = useState<GuardianContact | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [sosActive, setSosActive] = useState(false);
  const countdownTimerRef = useRef<any>(null);

  // Countdown timer effect
  useEffect(() => {
    if (sosCountdown === null) return;

    if (sosCountdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setSosCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (sosCountdown === 0) {
      executeEmergencySos();
      setSosCountdown(null);
    }

    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [sosCountdown]);

  function startSosCountdown() {
    setSosCountdown(3);
    toast.warning("🚨 EMERGENCY SOS INITIATED — Calling 112 in 3 seconds!", {
      duration: 3500,
    });
  }

  function cancelSosCountdown() {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setSosCountdown(null);
    toast.info("SOS Cancelled.");
  }

  async function executeEmergencySos() {
    setSosActive(true);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://orangeetaxi.vercel.app";
    const refStr = bookingData?.reference ? `#${bookingData.reference}` : "Active Ride";
    const driverName = driverInfo?.full_name || "Assigned Driver";
    const driverPhone = driverInfo?.phone || "Direct";
    const carPlate = driverInfo?.vehicle_number || "BE.6";
    const trackUrl = `${origin}/track?ref=${bookingData?.reference || ""}`;

    // 1. Mark SOS in bookings table
    if (bookingData?.id) {
      try {
        await supabase.from("bookings").update({ sos_raised: true }).eq("id", bookingData.id);
      } catch (e) {
        console.warn("Could not mark SOS in booking:", e);
      }
    }

    // 2. Dispatch emergency WhatsApp / SMS to Guardian if available
    const sosMessage =
      `🚨 *URGENT EMERGENCY SOS ALERT*\n\n` +
      `I have raised an emergency SOS in my Orange Electric Taxi.\n\n` +
      `• *Booking Ref:* ${refStr}\n` +
      `• *Vehicle:* ${carPlate}\n` +
      `• *Driver:* ${driverName} (${driverPhone})\n` +
      `• *Live Radar Tracking:* ${trackUrl}\n\n` +
      `Police (112) is being notified. Please check on me immediately!`;

    const targetPhone = guardian?.phone ? guardian.phone.replace(/[^0-9]/g, "") : "";
    if (targetPhone) {
      const cleanTarget = targetPhone.startsWith("91") ? targetPhone : `91${targetPhone}`;
      const waUrl = `https://wa.me/${cleanTarget}?text=${encodeURIComponent(sosMessage)}`;
      window.open(waUrl, "_blank");
    }

    toast.error("🚨 EMERGENCY SOS ACTIVE! Connecting to 112 Emergency Desk...", { duration: 6000 });

    // 3. Dial National Emergency Helpline (112)
    setTimeout(() => {
      window.location.href = "tel:112";
    }, 500);
  }

  // Load guardian from localStorage on mount & when opened
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("orange_guardian_contact");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name && parsed?.phone) {
          setGuardian(parsed);
          setNameInput(parsed.name);
          setPhoneInput(parsed.phone);
          return;
        }
      }
      // If no stored contact, default to editing mode
      setIsEditing(true);
    } catch (e) {
      setIsEditing(true);
    }
  }, [open]);

  function saveGuardianContact(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!nameInput.trim()) {
      toast.error("Please enter a guardian name (e.g. Mom, Brother, Rohit)");
      return;
    }
    if (!phoneInput.trim() || phoneInput.trim().length < 6) {
      toast.error("Please enter a valid phone number for your guardian");
      return;
    }

    const newContact: GuardianContact = {
      name: nameInput.trim(),
      phone: phoneInput.trim(),
    };

    localStorage.setItem("orange_guardian_contact", JSON.stringify(newContact));
    setGuardian(newContact);
    setIsEditing(false);
    toast.success(`Guardian contact saved: ${newContact.name} (${newContact.phone})`);

    // Dispatch event for other components in same browser
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("guardian_contact_updated", { detail: newContact }));
    }
  }

  function handleCallGuardian() {
    if (!guardian?.phone) {
      setIsEditing(true);
      return;
    }
    const cleanNumber = guardian.phone.replace(/[^0-9+]/g, "");
    navigator.clipboard?.writeText(cleanNumber);
    toast.success(`Calling Guardian ${guardian.name}: ${guardian.phone} (Copied to clipboard)`);
    window.location.href = `tel:${cleanNumber}`;
  }

  function handleShareWhatsApp() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://orangeetaxi.vercel.app";
    const refStr = bookingData?.reference ? `#${bookingData.reference}` : "Active Ride";
    const driverName = driverInfo?.full_name || "Assigned Chauffeur";
    const driverPhone = driverInfo?.phone || "Pending";
    const carModel = driverInfo?.vehicle_model || vehicle?.name || "Mahindra BE.6";
    const carPlate =
      driverInfo?.vehicle_number && driverInfo.vehicle_number !== "Unassigned"
        ? driverInfo.vehicle_number
        : getBookingVehiclePlate(bookingData, driverInfo);
    const pName = pickup?.name || "Pickup Point";
    const dName = drop?.name || "Destination";
    const trackUrl = `${origin}/track?ref=${bookingData?.reference || ""}`;

    const message =
      `🚨 *Orange Taxi Safety & Live Ride Alert*\n\n` +
      `Hi, I am currently traveling in an Orange Electric Taxi.\n\n` +
      `• *Booking Ref:* ${refStr}\n` +
      `• *Vehicle:* ${carModel} (${carPlate})\n` +
      `• *Driver:* ${driverName} (${driverPhone})\n` +
      `• *Pickup:* ${pName}\n` +
      `• *Destination:* ${dName}\n\n` +
      `• *Track My Live Ride:* ${trackUrl}\n\n` +
      `_Sent via Orange Taxi Guardian Safety System_`;

    const targetPhone = guardian?.phone ? guardian.phone.replace(/[^0-9]/g, "") : "";
    let waUrl = "";
    if (targetPhone) {
      const cleanTarget = targetPhone.startsWith("91") ? targetPhone : `91${targetPhone}`;
      waUrl = `https://wa.me/${cleanTarget}?text=${encodeURIComponent(message)}`;
    } else {
      waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    }

    window.open(waUrl, "_blank");
    toast.success("Opening WhatsApp with live trip details for your Guardian!");
  }

  function handleCopyDetails() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://orangeetaxi.vercel.app";
    const refStr = bookingData?.reference ? `#${bookingData.reference}` : "Active Ride";
    const trackUrl = `${origin}/track?ref=${bookingData?.reference || ""}`;
    const summary = `Orange Taxi Ride Ref: ${refStr} | Driver: ${driverInfo?.full_name || "Assigned"} (${driverInfo?.phone || "Pending"}) | Vehicle: ${driverInfo?.vehicle_number || "BE.6"} | Track Live: ${trackUrl}`;
    navigator.clipboard?.writeText(summary);
    setCopied(true);
    toast.success("Ride details copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background text-foreground border-border p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                Guardian Safety & SOS
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Instant 1-tap emergency call & live trip sharing with your family
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* SETUP / EDIT GUARDIAN FORM */}
        {isEditing ? (
          <form onSubmit={saveGuardianContact} className="mt-4 space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
              <span>
                Add a trusted contact (parent, partner, friend). During any ride, you can call them
                with 1 tap or share your live driver & plate details.
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <Label
                  htmlFor="guardian-name"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Guardian Name or Relationship
                </Label>
                <Input
                  id="guardian-name"
                  placeholder="e.g. Mom, Rohit (Brother), Partner"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <Label
                  htmlFor="guardian-phone"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Guardian Phone Number
                </Label>
                <Input
                  id="guardian-phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="mt-1.5 font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {guardian && (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 text-xs"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground font-bold text-xs"
              >
                Save Guardian Contact
              </Button>
            </div>
          </form>
        ) : (
          /* ACTIVE GUARDIAN DASHBOARD */
          <div className="mt-4 space-y-4">
            {/* Critical Emergency SOS Card */}
            <div className="rounded-2xl border-2 border-red-600 bg-red-500/10 p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                  <AlertTriangle className="size-5 animate-pulse" />
                  <span>National Emergency Police SOS</span>
                </div>
                <span className="rounded bg-red-600 text-white font-mono text-[10px] font-bold px-2 py-0.5">
                  112 POLICE
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                In distress, trigger instant SOS. Automatically dials 112, dispatches live GPS
                tracking to your guardian, and alerts Orange Command.
              </p>

              {sosCountdown !== null ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-red-600 text-white font-bold text-center py-3 rounded-xl text-sm animate-pulse">
                    Calling 112 in {sosCountdown}s...
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelSosCountdown}
                    className="h-11 px-4 font-bold border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={startSosCountdown}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm py-5 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all tracking-wide"
                >
                  <AlertTriangle className="size-4 sm:size-5" />
                  <span>TRIGGER EMERGENCY SOS (112)</span>
                </Button>
              )}
            </div>

            {/* Guardian Contact Info Card */}
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {guardian?.name?.charAt(0).toUpperCase() || "G"}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Your Designated Guardian
                  </p>
                  <p className="font-bold text-foreground truncate">{guardian?.name}</p>
                  <p className="font-mono text-xs font-semibold text-primary">{guardian?.phone}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Edit guardian contact"
              >
                <Pencil className="size-3" /> Edit
              </button>
            </div>

            {/* Main Action: Call Guardian Now */}
            <Button
              type="button"
              size="lg"
              onClick={handleCallGuardian}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-6 rounded-xl flex items-center justify-center gap-2.5 shadow-lg active:scale-98 transition-all"
            >
              <PhoneCall className="size-5 animate-pulse" />
              <span>Call Guardian Now ({guardian?.name})</span>
            </Button>

            {/* Secondary Action: WhatsApp Live Alert */}
            <Button
              type="button"
              variant="outline"
              onClick={handleShareWhatsApp}
              className="w-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 font-semibold text-xs py-5 rounded-xl flex items-center justify-center gap-2"
            >
              <MessageSquare className="size-4" />
              <span>Send Live Ride Details to {guardian?.name} via WhatsApp</span>
            </Button>

            {/* Copy Details */}
            <button
              type="button"
              onClick={handleCopyDetails}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/20 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copied ? "Trip details copied!" : "Copy Trip Details to Clipboard"}</span>
            </button>

            {/* Emergency Helplines Section */}
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Emergency & Safety Helplines
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="tel:112"
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-red-700 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase">Police / Emergency</p>
                    <p className="text-xs font-bold font-mono">Dial 112</p>
                  </div>
                </a>

                <a
                  href="tel:7294073222"
                  className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-2.5 text-primary hover:bg-primary/20 transition-colors"
                >
                  <LifeBuoy className="size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase">Orange 24/7 Desk</p>
                    <p className="text-xs font-bold font-mono">+91 72940 73222</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
