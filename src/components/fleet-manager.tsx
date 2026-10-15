// @ts-nocheck
import { useState, useEffect } from "react";
import {
  Car,
  Zap,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Plus,
  Search,
  X,
  Check,
  RotateCcw,
  ArrowLeftRight,
  ParkingSquare,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Clock,
  Phone,
  Copy,
  Building2,
  Handshake,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Trash2,
  Calendar,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FleetVehicle {
  id: string;
  plate_number: string;
  model: string;
  color: string;
  battery_percentage: number;
  status: "in_bay" | "assigned" | "maintenance";
  assigned_driver_id: string | null;
  assigned_at: string | null;
  bay_number: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_SAMPLE_FLEET: FleetVehicle[] = [
  {
    id: "v-1001",
    plate_number: "DL 01 EV 1001",
    model: "Mahindra BE.6",
    color: "Signature Orange",
    battery_percentage: 96,
    status: "in_bay",
    assigned_driver_id: null,
    assigned_at: null,
    bay_number: "Bay A-1",
  },
  {
    id: "v-1002",
    plate_number: "DL 01 EV 1002",
    model: "Mahindra BE.6",
    color: "Signature Orange",
    battery_percentage: 84,
    status: "in_bay",
    assigned_driver_id: null,
    assigned_at: null,
    bay_number: "Bay A-2",
  },
  {
    id: "v-1003",
    plate_number: "DL 01 EV 1003",
    model: "Mahindra BE.6",
    color: "Signature Orange",
    battery_percentage: 100,
    status: "in_bay",
    assigned_driver_id: null,
    assigned_at: null,
    bay_number: "Charging Bay 1",
  },
  {
    id: "v-1004",
    plate_number: "DL 01 EV 1004",
    model: "Mahindra BE.6",
    color: "Signature Orange",
    battery_percentage: 65,
    status: "in_bay",
    assigned_driver_id: null,
    assigned_at: null,
    bay_number: "Bay B-1",
  },
  {
    id: "v-1005",
    plate_number: "DL 01 EV 1005",
    model: "Mahindra BE.6",
    color: "Signature Orange",
    battery_percentage: 24,
    status: "in_bay",
    assigned_driver_id: null,
    assigned_at: null,
    bay_number: "Charging Bay 2",
  },
];

export interface PartnerVehicle {
  id: string;
  plate_number: string;
  chassis_number: string;
  model: string;
  year?: string;
  color?: string;
  owner_name: string;
  owner_phone: string;
  owner_email?: string;
  status: "active" | "inspection_pending" | "inactive";
  certified_standard: boolean;
  onboarded_at: string;
  notes?: string;
}

export const DEFAULT_SAMPLE_PARTNER_VEHICLES: PartnerVehicle[] = [];

export async function registerApprovedPartnerCar(carData: {
  plate_number: string;
  chassis_number: string;
  model: string;
  year?: string;
  owner_name: string;
  owner_phone: string;
  owner_email?: string;
}) {
  try {
    const cleanPlate = carData.plate_number.toUpperCase().trim();
    const newCar: PartnerVehicle = {
      id: "pv-" + Date.now(),
      plate_number: cleanPlate,
      chassis_number: carData.chassis_number?.toUpperCase().trim() || "N/A",
      model: carData.model || "Electric Vehicle",
      year: carData.year || "2024",
      color: "Signature Orange",
      owner_name: carData.owner_name,
      owner_phone: carData.owner_phone,
      owner_email: carData.owner_email,
      status: "active",
      certified_standard: true,
      onboarded_at: new Date().toISOString(),
    };

    // Try Supabase insert
    try {
      await supabase.from("partner_vehicles").insert({
        plate_number: newCar.plate_number,
        chassis_number: newCar.chassis_number,
        model: newCar.model,
        year: newCar.year,
        owner_name: newCar.owner_name,
        owner_phone: newCar.owner_phone,
        status: newCar.status,
      });
    } catch (e) {}

    // Update localStorage
    const stored = localStorage.getItem("orange_partner_vehicles");
    const list: PartnerVehicle[] = stored
      ? JSON.parse(stored)
      : [...DEFAULT_SAMPLE_PARTNER_VEHICLES];
    if (!list.some((v) => v.plate_number === cleanPlate)) {
      list.unshift(newCar);
      localStorage.setItem("orange_partner_vehicles", JSON.stringify(list));
      window.dispatchEvent(new Event("partner_vehicles_updated"));
    }
  } catch (err) {
    console.warn("Could not register partner car:", err);
  }
}

const STANDARD_BAYS = [
  "Bay A-1",
  "Bay A-2",
  "Bay A-3",
  "Bay A-4",
  "Bay B-1",
  "Bay B-2",
  "Bay B-3",
  "Bay B-4",
  "Charging Bay 1",
  "Charging Bay 2",
  "Charging Bay 3",
  "Fast DC Charger",
  "Inspection Bay",
  "Washing Bay",
];

function BayDropdown({
  currentBay,
  onSelect,
}: {
  currentBay: string;
  onSelect: (bay: string) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  if (isCustom) {
    return (
      <div className="flex items-center gap-1 ">
        <input
          type="text"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          placeholder="New Bay..."
          autoFocus
          className="h-6 w-24 rounded border border-blue-400 bg-background px-1.5 text-[11px] font-semibold outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => {
            if (customValue.trim()) onSelect(customValue.trim());
            setIsCustom(false);
          }}
          className="grid size-6 place-items-center rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          title="Save Bay"
        >
          <Check className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => setIsCustom(false)}
          className="grid size-6 place-items-center rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Cancel"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center group">
      <ParkingSquare className="absolute left-2 size-3 text-blue-600 pointer-events-none dark:text-blue-400" />
      <select
        value={STANDARD_BAYS.includes(currentBay) ? currentBay : "custom_saved"}
        onChange={(e) => {
          if (e.target.value === "custom_prompt") {
            setIsCustom(true);
            setCustomValue(currentBay);
          } else if (e.target.value !== "custom_saved") {
            onSelect(e.target.value);
          }
        }}
        className="h-6 appearance-none rounded-md border border-blue-200 bg-blue-50/90 pl-6 pr-6 text-[11px] font-semibold text-blue-700 outline-none hover:bg-blue-100/80 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
        title="Click to relocate vehicle to another bay"
      >
        {!STANDARD_BAYS.includes(currentBay) && <option value="custom_saved">{currentBay}</option>}
        <optgroup label="Terminal Bays">
          <option value="Bay A-1">Bay A-1</option>
          <option value="Bay A-2">Bay A-2</option>
          <option value="Bay A-3">Bay A-3</option>
          <option value="Bay A-4">Bay A-4</option>
          <option value="Bay B-1">Bay B-1</option>
          <option value="Bay B-2">Bay B-2</option>
          <option value="Bay B-3">Bay B-3</option>
          <option value="Bay B-4">Bay B-4</option>
        </optgroup>
        <optgroup label="Charging Docks">
          <option value="Charging Bay 1">⚡ Charging Bay 1</option>
          <option value="Charging Bay 2">⚡ Charging Bay 2</option>
          <option value="Charging Bay 3">⚡ Charging Bay 3</option>
          <option value="Fast DC Charger">⚡ Fast DC Charger</option>
        </optgroup>
        <optgroup label="Service & Maintenance">
          <option value="Inspection Bay">Inspection Bay</option>
          <option value="Washing Bay">Washing Bay</option>
        </optgroup>
        <optgroup label="Custom">
          <option value="custom_prompt">+ Custom Bay Name...</option>
        </optgroup>
      </select>
      <ChevronDown className="absolute right-1.5 size-3 text-blue-600/70 pointer-events-none group-hover:text-blue-700" />
    </div>
  );
}

const SQL_CREATE_TABLE = `-- Run this in Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text UNIQUE NOT NULL,
  model text NOT NULL DEFAULT 'Mahindra BE.6',
  color text DEFAULT 'Signature Orange',
  battery_percentage integer NOT NULL DEFAULT 100 CHECK (battery_percentage >= 0 AND battery_percentage <= 100),
  status text NOT NULL DEFAULT 'in_bay' CHECK (status IN ('in_bay', 'assigned', 'maintenance')),
  assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  bay_number text DEFAULT 'Bay 1',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on fleet_vehicles"
ON public.fleet_vehicles FOR ALL
TO public
USING (true)
WITH CHECK (true);

INSERT INTO public.fleet_vehicles (plate_number, model, color, battery_percentage, status, bay_number)
VALUES
  ('DL 01 EV 1001', 'Mahindra BE.6', 'Signature Orange', 96, 'in_bay', 'Bay A-1'),
  ('DL 01 EV 1002', 'Mahindra BE.6', 'Signature Orange', 84, 'in_bay', 'Bay A-2'),
  ('DL 01 EV 1003', 'Mahindra BE.6', 'Signature Orange', 100, 'in_bay', 'Charging Bay 1'),
  ('DL 01 EV 1004', 'Mahindra BE.6', 'Signature Orange', 65, 'in_bay', 'Bay B-1'),
  ('DL 01 EV 1005', 'Mahindra BE.6', 'Signature Orange', 24, 'in_bay', 'Charging Bay 2')
ON CONFLICT (plate_number) DO NOTHING;`;

interface FleetManagerProps {
  drivers: any[];
  onRefresh: () => void;
}

export function FleetManager({ drivers, onRefresh }: FleetManagerProps) {
  // Sub-navigation: "company" (Depot & Bays) vs "partner" (Driver-Owned Cars)
  const [activeSubTab, setActiveSubTab] = useState<"company" | "partner">("company");

  // Company fleet state
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "bay" | "assigned" | "low_battery">("all");

  // Partner fleet state
  const [partnerVehicles, setPartnerVehicles] = useState<PartnerVehicle[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [isRegisteringPartner, setIsRegisteringPartner] = useState(false);
  const [partnerPlate, setPartnerPlate] = useState("");
  const [partnerChassis, setPartnerChassis] = useState("");
  const [partnerModel, setPartnerModel] = useState("Tata Nexon EV");
  const [partnerYear, setPartnerYear] = useState("2024");
  const [partnerOwnerName, setPartnerOwnerName] = useState("");
  const [partnerOwnerPhone, setPartnerOwnerPhone] = useState("");
  const [savingPartner, setSavingPartner] = useState(false);

  // Registration modal (Company)
  const [isRegistering, setIsRegistering] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [newModel, setNewModel] = useState("Mahindra BE.6");
  const [newColor, setNewColor] = useState("Signature Orange");
  const [newBattery, setNewBattery] = useState(100);
  const [newBay, setNewBay] = useState("Bay A-1");
  const [savingNew, setSavingNew] = useState(false);

  // Quick assignment state
  const [assigningVehicleId, setAssigningVehicleId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  // Returning state
  const [returningVehicleId, setReturningVehicleId] = useState<string | null>(null);
  const [returnBayNumber, setReturnBayNumber] = useState("Bay A-1");

  // Load fleet data from Supabase, fallback to localStorage
  async function loadFleet() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fleet_vehicles")
        .select("*")
        .order("created_at", { ascending: true });

      if (error || !data) {
        setIsUsingFallback(true);
        const stored = localStorage.getItem("orange_fleet_vehicles");
        if (stored) {
          setVehicles(JSON.parse(stored));
        } else {
          setVehicles(DEFAULT_SAMPLE_FLEET);
          localStorage.setItem("orange_fleet_vehicles", JSON.stringify(DEFAULT_SAMPLE_FLEET));
        }
      } else {
        setIsUsingFallback(false);
        if (data.length === 0) {
          for (const v of DEFAULT_SAMPLE_FLEET) {
            await supabase.from("fleet_vehicles").insert({
              plate_number: v.plate_number,
              model: v.model,
              color: v.color,
              battery_percentage: v.battery_percentage,
              status: v.status,
              bay_number: v.bay_number,
            });
          }
          const { data: refreshed } = await supabase.from("fleet_vehicles").select("*");
          setVehicles((refreshed as any[]) || DEFAULT_SAMPLE_FLEET);
        } else {
          setVehicles(data as any[]);
        }
      }
    } catch (e) {
      setIsUsingFallback(true);
      setVehicles(DEFAULT_SAMPLE_FLEET);
    }
    setLoading(false);
  }

  // Load partner fleet
  async function loadPartnerFleet() {
    try {
      const { data, error } = await supabase
        .from("partner_vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data && data.length > 0) {
        const cleaned = (data as any[]).filter(
          (pv) => pv.owner_name !== "Vikramaditya Rao" && pv.owner_name !== "Sunil Gowda",
        );
        setPartnerVehicles(cleaned);
        return;
      }
    } catch (e) {}

    const stored = localStorage.getItem("orange_partner_vehicles");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const cleaned = parsed.filter(
          (pv: any) =>
            pv.id !== "pv-2001" &&
            pv.id !== "pv-2002" &&
            pv.owner_name !== "Vikramaditya Rao" &&
            pv.owner_name !== "Sunil Gowda",
        );
        setPartnerVehicles(cleaned);
        localStorage.setItem("orange_partner_vehicles", JSON.stringify(cleaned));
      } catch (e) {
        setPartnerVehicles([]);
      }
    } else {
      setPartnerVehicles([]);
    }
  }

  async function handleRegisterPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerPlate.trim()) {
      toast.error("Vehicle plate number is required");
      return;
    }
    if (!partnerChassis.trim()) {
      toast.error("Chassis number (VIN) is required for compliance");
      return;
    }
    if (!partnerOwnerName.trim()) {
      toast.error("Driver / Owner name is required");
      return;
    }

    setSavingPartner(true);
    await registerApprovedPartnerCar({
      plate_number: partnerPlate,
      chassis_number: partnerChassis,
      model: partnerModel,
      year: partnerYear,
      owner_name: partnerOwnerName,
      owner_phone: partnerOwnerPhone || "+91 98000 00000",
    });

    toast.success("Partner EV registered successfully into fleet!");
    setPartnerPlate("");
    setPartnerChassis("");
    setPartnerOwnerName("");
    setPartnerOwnerPhone("");
    setIsRegisteringPartner(false);
    setSavingPartner(false);
    loadPartnerFleet();
  }

  async function removePartnerVehicle(id: string, plate: string) {
    if (!confirm(`Are you sure you want to remove partner vehicle ${plate}?`)) return;
    try {
      await supabase.from("partner_vehicles").delete().eq("id", id);
    } catch (e) {}
    const updated = partnerVehicles.filter((v) => v.id !== id);
    setPartnerVehicles(updated);
    localStorage.setItem("orange_partner_vehicles", JSON.stringify(updated));
    toast.success(`Vehicle ${plate} unlinked from partner fleet`);
  }

  useEffect(() => {
    loadFleet();
    loadPartnerFleet();

    const handlePartnerUpdate = () => loadPartnerFleet();
    window.addEventListener("partner_vehicles_updated", handlePartnerUpdate);
    window.addEventListener("storage", handlePartnerUpdate);

    // Subscribe to real-time changes
    const channel = supabase
      .channel("fleet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fleet_vehicles" }, () => {
        loadFleet();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("partner_vehicles_updated", handlePartnerUpdate);
      window.removeEventListener("storage", handlePartnerUpdate);
    };
  }, []);

  // Save vehicles state to DB or localStorage
  async function persistVehicleUpdate(updatedVehicle: FleetVehicle) {
    if (!isUsingFallback) {
      await supabase
        .from("fleet_vehicles")
        .update({
          battery_percentage: updatedVehicle.battery_percentage,
          status: updatedVehicle.status,
          assigned_driver_id: updatedVehicle.assigned_driver_id,
          assigned_at: updatedVehicle.assigned_at,
          bay_number: updatedVehicle.bay_number,
          model: updatedVehicle.model,
          color: updatedVehicle.color,
          updated_at: new Date().toISOString(),
        })
        .eq("id", updatedVehicle.id);
    } else {
      const updatedList = vehicles.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v));
      setVehicles(updatedList);
      localStorage.setItem("orange_fleet_vehicles", JSON.stringify(updatedList));
    }
  }

  // Quick battery update
  async function updateBattery(vehicle: FleetVehicle, newPct: number) {
    const clamped = Math.max(0, Math.min(100, newPct));
    const updated = { ...vehicle, battery_percentage: clamped };
    setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? updated : v)));
    await persistVehicleUpdate(updated);
    toast.success(`${vehicle.plate_number} battery updated to ${clamped}%`);
  }

  // Quick bay update directly from dropdown
  async function changeBay(vehicle: FleetVehicle, newBay: string) {
    if (!newBay || newBay === vehicle.bay_number) return;
    const updated: FleetVehicle = { ...vehicle, bay_number: newBay };
    setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? updated : v)));
    await persistVehicleUpdate(updated);
    toast.success(`🅿️ ${vehicle.plate_number} relocated to ${newBay}!`);
  }

  // Register a new vehicle
  async function handleRegisterVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlate.trim()) {
      toast.error("Please enter a registration plate number");
      return;
    }
    const cleanPlate = newPlate.trim().toUpperCase();
    if (vehicles.some((v) => v.plate_number === cleanPlate)) {
      toast.error(`Vehicle with plate ${cleanPlate} already registered`);
      return;
    }

    setSavingNew(true);
    const newVehicle: FleetVehicle = {
      id: "v-" + Date.now(),
      plate_number: cleanPlate,
      model: newModel.trim() || "Mahindra BE.6",
      color: newColor.trim() || "Signature Orange",
      battery_percentage: Math.max(0, Math.min(100, Number(newBattery) || 100)),
      status: "in_bay",
      assigned_driver_id: null,
      assigned_at: null,
      bay_number: newBay.trim() || "Bay 1",
    };

    if (!isUsingFallback) {
      const { data, error } = await supabase
        .from("fleet_vehicles")
        .insert({
          plate_number: newVehicle.plate_number,
          model: newVehicle.model,
          color: newVehicle.color,
          battery_percentage: newVehicle.battery_percentage,
          status: newVehicle.status,
          bay_number: newVehicle.bay_number,
        })
        .select()
        .single();

      if (error) {
        toast.error("Could not register in Supabase: " + error.message);
        setSavingNew(false);
        return;
      }
      if (data) newVehicle.id = data.id;
    }

    const updated = [...vehicles, newVehicle];
    setVehicles(updated);
    if (isUsingFallback) {
      localStorage.setItem("orange_fleet_vehicles", JSON.stringify(updated));
    }

    toast.success(
      `🎉 ${cleanPlate} (${newVehicle.model}) registered to fleet in ${newVehicle.bay_number}!`,
    );
    setNewPlate("");
    setIsRegistering(false);
    setSavingNew(false);
  }

  /**
   * CORE BUSINESS LOGIC:
   * When assigning vehicle A to Driver X:
   * 1. If Driver X already has vehicle B assigned:
   *    -> Vehicle B status becomes "in_bay", assigned_driver_id = null, bay_number = "Bay 1" (parked in bay)
   * 2. Vehicle A becomes "assigned" to Driver X
   * 3. Driver X in drivers table is updated with vehicle A's plate number & model
   */
  async function assignToDriver(vehicle: FleetVehicle, driverId: string) {
    if (!driverId) {
      toast.error("Please choose a driver");
      return;
    }
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    // Check if this driver already has another vehicle assigned
    const olderVehicle = vehicles.find(
      (v) => v.assigned_driver_id === driverId && v.id !== vehicle.id,
    );

    let updatedList = [...vehicles];

    // 1. If older vehicle exists, park it back in the bay
    if (olderVehicle) {
      const olderParked: FleetVehicle = {
        ...olderVehicle,
        status: "in_bay",
        assigned_driver_id: null,
        assigned_at: null,
        bay_number: olderVehicle.bay_number || "Bay A-1",
      };
      await persistVehicleUpdate(olderParked);
      updatedList = updatedList.map((v) => (v.id === olderVehicle.id ? olderParked : v));
      toast.info(
        `🅿️ Older vehicle ${olderVehicle.plate_number} has been parked back in ${olderParked.bay_number}.`,
      );
    }

    // 2. Assign the new vehicle
    const newlyAssigned: FleetVehicle = {
      ...vehicle,
      status: "assigned",
      assigned_driver_id: driver.id,
      assigned_at: new Date().toISOString(),
    };
    await persistVehicleUpdate(newlyAssigned);
    updatedList = updatedList.map((v) => (v.id === vehicle.id ? newlyAssigned : v));
    setVehicles(updatedList);

    // 3. Update driver's vehicle_number & vehicle_model in Supabase drivers table
    const { error: driverErr } = await supabase
      .from("drivers")
      .update({
        vehicle_number: newlyAssigned.plate_number,
        vehicle_model: newlyAssigned.model,
      })
      .eq("id", driver.id);

    if (driverErr) {
      console.warn("Could not update driver table:", driverErr);
    }

    toast.success(
      `🚗 ${newlyAssigned.plate_number} successfully assigned to ${driver.full_name}! Customer rides updated.`,
    );
    setAssigningVehicleId(null);
    setSelectedDriverId("");
    onRefresh();
  }

  // Return vehicle to bay
  async function returnVehicleToBay(vehicle: FleetVehicle, targetBay: string) {
    const bayToUse = targetBay?.trim() || vehicle.bay_number || "Bay A-1";
    const previousDriverId = vehicle.assigned_driver_id;
    const previousDriver = drivers.find((d) => d.id === previousDriverId);

    const updated: FleetVehicle = {
      ...vehicle,
      status: "in_bay",
      assigned_driver_id: null,
      assigned_at: null,
      bay_number: bayToUse,
    };

    await persistVehicleUpdate(updated);
    setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? updated : v)));

    // Unassign driver's vehicle in drivers table
    if (previousDriverId) {
      await supabase
        .from("drivers")
        .update({
          vehicle_number: "Unassigned",
        })
        .eq("id", previousDriverId);
    }

    toast.success(
      `🅿️ ${vehicle.plate_number} parked in ${bayToUse}. ${previousDriver ? `${previousDriver.full_name}'s daily car unassigned.` : ""}`,
    );
    setReturningVehicleId(null);
    onRefresh();
  }

  // Filtered vehicles
  const inBayVehicles = vehicles.filter((v) => v.status === "in_bay");
  const assignedVehicles = vehicles.filter((v) => v.status === "assigned");

  const filteredInBay = inBayVehicles.filter((v) => {
    const matchSearch =
      v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
      v.bay_number.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "low_battery") return v.battery_percentage < 30;
    return true;
  });

  const filteredAssigned = assignedVehicles.filter((v) => {
    const driver = drivers.find((d) => d.id === v.assigned_driver_id);
    const matchSearch =
      v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      (driver && driver.full_name.toLowerCase().includes(search.toLowerCase()));
    if (!matchSearch) return false;
    if (filter === "low_battery") return v.battery_percentage < 30;
    return true;
  });

  // Filtered partner vehicles
  const filteredPartnerVehicles = partnerVehicles.filter((v) => {
    const term = partnerSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      v.plate_number.toLowerCase().includes(term) ||
      v.chassis_number.toLowerCase().includes(term) ||
      v.model.toLowerCase().includes(term) ||
      v.owner_name.toLowerCase().includes(term) ||
      v.owner_phone?.toLowerCase().includes(term)
    );
  });

  // Calculate fleet stats
  const totalFleetCount = vehicles.length;
  const avgBattery =
    totalFleetCount > 0
      ? Math.round(vehicles.reduce((acc, v) => acc + v.battery_percentage, 0) / totalFleetCount)
      : 0;
  const lowBatteryCount = vehicles.filter((v) => v.battery_percentage < 30).length;

  return (
    <div className="space-y-6">
      {/* Top Banner if using local fallback */}
      {isUsingFallback && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-bold">Operating on Local Fleet Storage</p>
              <p className="text-[11px] opacity-80">
                To sync fleet vehicles to your permanent cloud database, run the SQL setup script in
                your Supabase SQL Editor.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-8 gap-1.5 border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            onClick={() => {
              navigator.clipboard.writeText(SQL_CREATE_TABLE);
              toast.success("SQL script copied! Paste and run in Supabase SQL Editor.");
            }}
          >
            <Copy className="size-3.5" /> Copy SQL Setup
          </Button>
        </div>
      )}

      {/* Operating Model Sub-Tabs: Company Fleet vs Partner Fleet */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveSubTab("company")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === "company"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-4" />
            <span>Company-Owned Fleet (Depot & Bays)</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {vehicles.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("partner")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === "partner"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Handshake className="size-4" />
            <span>Partner / Driver-Owned Cars</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {partnerVehicles.length}
            </Badge>
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          {activeSubTab === "company" ? (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" /> Fixed Salary Drivers · Depot Bays
              & Charging
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> 15% Platform Commission Model
              · Owner-Operators
            </span>
          )}
        </div>
      </div>

      {activeSubTab === "company" ? (
        <div className="space-y-6">
          {/* Header & Registration CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="display-serif text-2xl font-bold">Fleet & Bay Operations</h2>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/30 text-xs"
                >
                  Mahindra BE.6 Fleet
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Track EV battery telemetry, manage parked cars in the bay, and assign daily vehicles
                to drivers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsRegistering(!isRegistering)}
                className="gap-2 text-xs font-semibold h-9"
              >
                <Plus className="size-4" /> Register New Vehicle
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadFleet}
                className="h-9 px-2 text-muted-foreground hover:text-foreground"
                title="Refresh Fleet"
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>

          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Total Fleet
                </span>
                <Car className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold">{totalFleetCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mahindra BE.6 EVs</p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Parked in Bay
                </span>
                <ParkingSquare className="size-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-600">{inBayVehicles.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Available for drivers</p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Active on Shift
                </span>
                <Zap className="size-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{assignedVehicles.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Assigned to drivers</p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Avg Battery
                </span>
                <BatteryCharging className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold text-primary">{avgBattery}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lowBatteryCount > 0 ? `${lowBatteryCount} low (<30%)` : "All healthy"}
              </p>
            </div>
          </div>

          {/* New Registration Form */}
          {isRegistering && (
            <form
              onSubmit={handleRegisterVehicle}
              className="rounded-xl border border-primary/40 bg-primary/5 p-5  slide-in-from-top-3 duration-200"
            >
              <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="size-4 text-primary" />
                  <p className="text-sm font-bold uppercase tracking-wider text-primary">
                    Register New EV into Orange Fleet
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Registration Plate *
                  </label>
                  <input
                    type="text"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    placeholder="e.g. DL 01 EV 8092"
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono font-bold uppercase outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="Mahindra BE.6"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Color
                  </label>
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="Signature Orange"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Initial Battery %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newBattery}
                    onChange={(e) => setNewBattery(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Initial Bay Location
                  </label>
                  <input
                    type="text"
                    value={newBay}
                    onChange={(e) => setNewBay(e.target.value)}
                    placeholder="e.g. Bay A-3"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-primary/20 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRegistering(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingNew}
                  className="text-xs font-semibold"
                >
                  {savingNew ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <Check className="size-3.5 mr-1" />
                  )}
                  Save & Register to Bay
                </Button>
              </div>
            </form>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plate, bay, or driver..."
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-8 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "All Vehicles", count: vehicles.length },
                { id: "bay", label: "In Bay", count: inBayVehicles.length },
                { id: "assigned", label: "Assigned", count: assignedVehicles.length },
                { id: "low_battery", label: "Low Battery (<30%)", count: lowBatteryCount },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id as any)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === btn.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-background border border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <span>{btn.label}</span>
                  <span className="rounded-full bg-background/20 px-1.5 py-0.2 text-[10px]">
                    {btn.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* SECTION 1: VEHICLES IN BAY */}
              {(filter === "all" || filter === "bay" || filter === "low_battery") && (
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                        <ParkingSquare className="size-4" />
                      </span>
                      <div>
                        <h3 className="font-bold text-sm">
                          Vehicles in Bay (Available & Charging)
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Ready to be assigned to drivers starting their shift
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                    >
                      {filteredInBay.length} in bay
                    </Badge>
                  </div>

                  {filteredInBay.length === 0 ? (
                    <p className="p-8 text-center text-xs text-muted-foreground">
                      No vehicles currently in bay matching your filter.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                      {filteredInBay.map((v) => {
                        const isAssigning = assigningVehicleId === v.id;
                        const isLowBattery = v.battery_percentage < 30;

                        return (
                          <div
                            key={v.id}
                            className={`rounded-xl border p-4 transition-all ${
                              isLowBattery
                                ? "border-red-200 bg-red-50/30 dark:border-red-950 dark:bg-red-950/10"
                                : "border-border bg-background hover:border-primary/40 shadow-sm"
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-base font-bold tracking-wider text-foreground">
                                  {v.plate_number}
                                </span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {v.model} · {v.color}
                                </p>
                              </div>
                              <BayDropdown
                                currentBay={v.bay_number}
                                onSelect={(newBay) => changeBay(v, newBay)}
                              />
                            </div>

                            {/* Battery Level Meter & Telemetry */}
                            <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-3">
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                                  {v.battery_percentage >= 80 ? (
                                    <BatteryFull className="size-4 text-emerald-600" />
                                  ) : v.battery_percentage >= 30 ? (
                                    <BatteryMedium className="size-4 text-amber-600" />
                                  ) : (
                                    <BatteryLow className="size-4 text-red-600" />
                                  )}
                                  Battery Telemetry
                                </span>
                                <span
                                  className={`font-mono font-bold text-sm ${
                                    v.battery_percentage >= 60
                                      ? "text-emerald-600"
                                      : v.battery_percentage >= 30
                                        ? "text-amber-600"
                                        : "text-red-600"
                                  }`}
                                >
                                  {v.battery_percentage}%
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    v.battery_percentage >= 60
                                      ? "bg-emerald-500"
                                      : v.battery_percentage >= 30
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`}
                                  style={{ width: `${v.battery_percentage}%` }}
                                />
                              </div>

                              {/* Quick battery adjustments */}
                              <div className="mt-2.5 flex items-center justify-between gap-1 text-[10px]">
                                <span className="text-muted-foreground font-medium">
                                  Quick Adjust:
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateBattery(v, v.battery_percentage - 10)}
                                    className="rounded border border-border bg-background px-1.5 py-0.5 hover:bg-accent"
                                    title="-10%"
                                  >
                                    -10%
                                  </button>
                                  <button
                                    onClick={() => updateBattery(v, v.battery_percentage + 10)}
                                    className="rounded border border-border bg-background px-1.5 py-0.5 hover:bg-accent"
                                    title="+10%"
                                  >
                                    +10%
                                  </button>
                                  <button
                                    onClick={() => updateBattery(v, 100)}
                                    className="inline-flex items-center gap-1 rounded bg-emerald-600/10 text-emerald-600 px-2 py-0.5 font-semibold hover:bg-emerald-600/20"
                                    title="Mark 100% Charged"
                                  >
                                    <Zap className="size-2.5" /> 100%
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Assign to Driver Flow */}
                            {!isAssigning ? (
                              <div className="mt-4 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="w-full h-8 text-xs font-semibold gap-1.5"
                                  onClick={() => {
                                    setAssigningVehicleId(v.id);
                                    setSelectedDriverId("");
                                  }}
                                >
                                  <Car className="size-3.5" /> Assign to Driver
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-primary">Assign Driver</span>
                                  <button
                                    onClick={() => setAssigningVehicleId(null)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>

                                <select
                                  value={selectedDriverId}
                                  onChange={(e) => setSelectedDriverId(e.target.value)}
                                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                                >
                                  <option value="">-- Choose Active Driver --</option>
                                  {drivers.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.full_name} {d.is_online ? "● Online" : "(Offline)"}{" "}
                                      {d.vehicle_number && d.vehicle_number !== "Unassigned"
                                        ? `[Current: ${d.vehicle_number}]`
                                        : ""}
                                    </option>
                                  ))}
                                </select>

                                {/* Driver already has older car notice */}
                                {(() => {
                                  const chosen = drivers.find((d) => d.id === selectedDriverId);
                                  const older = vehicles.find(
                                    (veh) =>
                                      veh.assigned_driver_id === selectedDriverId &&
                                      veh.id !== v.id,
                                  );
                                  if (chosen && older) {
                                    return (
                                      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                                        <p className="font-semibold flex items-center gap-1">
                                          <RotateCcw className="size-3 text-amber-600" />
                                          Auto Bay Return:
                                        </p>
                                        <p className="mt-0.5 opacity-90">
                                          {chosen.full_name} currently has{" "}
                                          <strong>{older.plate_number}</strong>. It will be moved
                                          back to the bay automatically!
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    disabled={!selectedDriverId}
                                    onClick={() => assignToDriver(v, selectedDriverId)}
                                    className="flex-1 h-7 text-xs font-semibold"
                                  >
                                    Confirm Assignment
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setAssigningVehicleId(null)}
                                    className="h-7 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: VEHICLES ASSIGNED TO DRIVERS */}
              {(filter === "all" || filter === "assigned" || filter === "low_battery") && (
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                        <Zap className="size-4" />
                      </span>
                      <div>
                        <h3 className="font-bold text-sm">Assigned Vehicles (On Shift / Road)</h3>
                        <p className="text-xs text-muted-foreground">
                          Actively operating with drivers. Live battery & car-swap management.
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                    >
                      {filteredAssigned.length} on road
                    </Badge>
                  </div>

                  {filteredAssigned.length === 0 ? (
                    <p className="p-8 text-center text-xs text-muted-foreground">
                      No vehicles currently assigned to drivers.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                      {filteredAssigned.map((v) => {
                        const driver = drivers.find((d) => d.id === v.assigned_driver_id);
                        const isReturning = returningVehicleId === v.id;

                        return (
                          <div
                            key={v.id}
                            className="rounded-xl border border-border bg-background p-4 shadow-sm"
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-base font-bold tracking-wider text-foreground">
                                  {v.plate_number}
                                </span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {v.model} · {v.color}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  ● On Duty
                                </span>
                                <BayDropdown
                                  currentBay={v.bay_number}
                                  onSelect={(newBay) => changeBay(v, newBay)}
                                />
                              </div>
                            </div>

                            {/* Assigned Driver Card */}
                            <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                  {driver ? driver.full_name.charAt(0).toUpperCase() : "?"}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-foreground">
                                    {driver ? driver.full_name : "Assigned Driver"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {driver?.phone ? driver.phone : "No phone"} ·{" "}
                                    {driver?.is_online ? "Online" : "Offline"}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {v.assigned_at
                                  ? new Date(v.assigned_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Active"}
                              </span>
                            </div>

                            {/* Battery Level Meter & Telemetry */}
                            <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-2.5">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground text-[11px]">
                                  <BatteryCharging className="size-3.5 text-primary" />
                                  Live Battery
                                </span>
                                <span
                                  className={`font-mono font-bold text-xs ${
                                    v.battery_percentage >= 60
                                      ? "text-emerald-600"
                                      : v.battery_percentage >= 30
                                        ? "text-amber-600"
                                        : "text-red-600"
                                  }`}
                                >
                                  {v.battery_percentage}%
                                </span>
                              </div>

                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    v.battery_percentage >= 60
                                      ? "bg-emerald-500"
                                      : v.battery_percentage >= 30
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`}
                                  style={{ width: `${v.battery_percentage}%` }}
                                />
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
                                <span className="text-muted-foreground">Telemetry update:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateBattery(v, v.battery_percentage - 10)}
                                    className="rounded border border-border bg-background px-1.5 py-0.5 hover:bg-accent"
                                  >
                                    -10%
                                  </button>
                                  <button
                                    onClick={() => updateBattery(v, v.battery_percentage + 10)}
                                    className="rounded border border-border bg-background px-1.5 py-0.5 hover:bg-accent"
                                  >
                                    +10%
                                  </button>
                                  <button
                                    onClick={() => updateBattery(v, 100)}
                                    className="rounded bg-emerald-600/10 text-emerald-600 px-1.5 py-0.5 font-semibold hover:bg-emerald-600/20"
                                  >
                                    ⚡ 100%
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Actions: Return to Bay / Park */}
                            {!isReturning ? (
                              <div className="mt-3 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
                                  onClick={() => {
                                    setReturningVehicleId(v.id);
                                    setReturnBayNumber(v.bay_number || "Bay A-1");
                                  }}
                                >
                                  <ParkingSquare className="size-3.5 text-blue-600" /> Park Back in
                                  Bay
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20 p-3 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-blue-700 dark:text-blue-300">
                                    Park in Bay
                                  </span>
                                  <button
                                    onClick={() => setReturningVehicleId(null)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                                    Destination Bay Number
                                  </label>
                                  <input
                                    type="text"
                                    value={returnBayNumber}
                                    onChange={(e) => setReturnBayNumber(e.target.value)}
                                    placeholder="e.g. Bay A-1"
                                    className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-primary"
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    onClick={() => returnVehicleToBay(v, returnBayNumber)}
                                    className="flex-1 h-7 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    Confirm Park in Bay
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setReturningVehicleId(null)}
                                    className="h-7 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ================= PARTNER / DRIVER-OWNED CARS TAB ================= */
        <div className="space-y-6">
          {/* Header & Registration CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="display-serif text-2xl font-bold">Partner / Driver-Owned Fleet</h2>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1"
                >
                  <Sparkles className="size-3" /> Orange Standard Certified
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vehicles brought by partner owner-operators under the 15% platform commission model.
                Segregated from company depot bays.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsRegisteringPartner(!isRegisteringPartner)}
                className="gap-2 text-xs font-semibold h-9 bg-primary"
              >
                <Plus className="size-4" /> Register Partner Vehicle
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadPartnerFleet}
                className="h-9 px-2 text-muted-foreground hover:text-foreground"
                title="Refresh Partner Fleet"
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>

          {/* Partner KPI Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Partner Cars
                </span>
                <Car className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold">{partnerVehicles.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Driver-owned EVs</p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Orange Standard
                </span>
                <ShieldCheck className="size-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">100% BEV</p>
              <p className="text-xs text-muted-foreground mt-0.5">Zero Emissions & Clean AC</p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Operating Model
                </span>
                <Handshake className="size-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-600">15% Comm.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Partner keeps 85% fare</p>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Active Status
                </span>
                <CheckCircle2 className="size-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {partnerVehicles.filter((v) => v.status === "active").length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Onboarded & Approved</p>
            </div>
          </div>

          {/* Partner Vehicle Registration Form */}
          {isRegisteringPartner && (
            <form
              onSubmit={handleRegisterPartner}
              className="rounded-xl border border-primary/40 bg-primary/5 p-5  slide-in-from-top-3 duration-200"
            >
              <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="size-4 text-primary" />
                  <p className="text-sm font-bold uppercase tracking-wider text-primary">
                    Register Partner-Owned Orange Standard EV
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegisteringPartner(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Registration Plate (Plate No.) *
                  </label>
                  <input
                    type="text"
                    value={partnerPlate}
                    onChange={(e) => setPartnerPlate(e.target.value)}
                    placeholder="e.g. DL 01 EV 8092"
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono font-bold uppercase outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Chassis Number (VIN) *
                  </label>
                  <input
                    type="text"
                    value={partnerChassis}
                    onChange={(e) => setPartnerChassis(e.target.value)}
                    placeholder="e.g. MA3EHB6S7P99999"
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono font-bold uppercase outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Vehicle Model *
                  </label>
                  <input
                    type="text"
                    value={partnerModel}
                    onChange={(e) => setPartnerModel(e.target.value)}
                    placeholder="e.g. Tata Nexon EV / Mahindra BE.6"
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Manufacturing Year
                  </label>
                  <input
                    type="text"
                    value={partnerYear}
                    onChange={(e) => setPartnerYear(e.target.value)}
                    placeholder="2024 / 2025"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Owner / Driver Full Name *
                  </label>
                  <input
                    type="text"
                    value={partnerOwnerName}
                    onChange={(e) => setPartnerOwnerName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Owner Contact Phone *
                  </label>
                  <input
                    type="tel"
                    value={partnerOwnerPhone}
                    onChange={(e) => setPartnerOwnerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRegisteringPartner(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingPartner}
                  className="text-xs font-semibold gap-1.5"
                >
                  {savingPartner ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Add to Partner Fleet
                </Button>
              </div>
            </form>
          )}

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search partner cars by plate, chassis number, model, or driver name..."
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            {partnerSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPartnerSearch("")}
                className="text-xs h-10 px-3"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Partner Vehicles Grid */}
          {filteredPartnerVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center bg-background/50">
              <Handshake className="size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-semibold">No Partner Vehicles Found</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Vehicles submitted by partner drivers at /drive will appear here upon admin
                approval, or you can register one manually.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPartnerVehicles.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-border bg-background p-5 hover:border-primary/40 transition-all shadow-xs space-y-3.5"
                >
                  {/* Plate & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-base font-black tracking-wider text-foreground bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md inline-block">
                        {v.plate_number}
                      </span>
                      <p className="text-xs font-semibold text-muted-foreground mt-1.5 flex items-center gap-1.5">
                        <Car className="size-3.5 text-primary" />
                        <span>{v.model}</span>
                        {v.year && <span className="opacity-70">({v.year})</span>}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3" /> Active
                    </span>
                  </div>

                  {/* Chassis Number (VIN) */}
                  <div className="rounded-lg bg-muted/40 p-2.5 text-xs flex items-center justify-between gap-2">
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Chassis / VIN
                      </p>
                      <p className="font-mono font-bold text-foreground truncate">
                        {v.chassis_number || "N/A"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(v.chassis_number);
                        toast.success("Chassis number copied!");
                      }}
                      className="size-7 rounded bg-background border border-border grid place-items-center text-muted-foreground hover:text-foreground shrink-0"
                      title="Copy Chassis No."
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>

                  {/* Owner / Driver Details */}
                  <div className="space-y-1.5 text-xs pt-1 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Owner / Driver:</span>
                      <span className="font-bold text-foreground">{v.owner_name}</span>
                    </div>
                    {v.owner_phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Phone:</span>
                        <a
                          href={`tel:${v.owner_phone.replace(/\s+/g, "")}`}
                          className="font-mono text-primary font-semibold hover:underline flex items-center gap-1"
                        >
                          <Phone className="size-3" /> {v.owner_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Orange Standard Badge & Commission Info */}
                  <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <ShieldCheck className="size-3.5" /> Orange Standard EV
                    </span>
                    <span className="rounded bg-primary/10 text-primary font-bold px-2 py-0.5 text-[10px]">
                      15% Commission
                    </span>
                  </div>

                  {/* Remove button */}
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removePartnerVehicle(v.id, v.plate_number)}
                      className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="size-3" /> Unlink Car
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
