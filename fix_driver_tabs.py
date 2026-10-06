import re

with open('src/routes/driver-console.tsx', 'r') as f:
    content = f.read()

# 1. Add activeTab state
if "const [activeTab, setActiveTab]" not in content:
    content = content.replace("const [activeRides, setActiveRides] = useState<Booking[]>([]);", "const [activeRides, setActiveRides] = useState<Booking[]>([]);\n  const [activeTab, setActiveTab] = useState(\"rides\");")

# 2. Update Tabs to be controlled
content = content.replace('<Tabs defaultValue="rides" className="mt-10">', '<Tabs value={activeTab} onValueChange={setActiveTab} className="mt-10">')

# 3. Update acceptRide to switch tabs
accept_str = """    await lockBookingVehicle(supabase, bookingId, resolvedPlate, updatedVehicleName, activeBooking?.reference);

    toast.success("Ride accepted!");
    loadData();
  }"""
new_accept_str = """    await lockBookingVehicle(supabase, bookingId, resolvedPlate, updatedVehicleName, activeBooking?.reference);

    toast.success("Ride accepted!");
    setActiveTab("rides");
    loadData();
  }"""
content = content.replace(accept_str, new_accept_str)

# 4. Update preAcceptScheduledRide to switch tabs
pre_accept_str = """    if (error) { toast.error("Could not accept scheduled ride."); return; }

    toast.success("Scheduled Ride Pre-Accepted!");
    loadData();
  }"""
new_pre_accept_str = """    if (error) { toast.error("Could not accept scheduled ride."); return; }

    toast.success("Scheduled Ride Pre-Accepted!");
    setActiveTab("rides");
    loadData();
  }"""
content = content.replace(pre_accept_str, new_pre_accept_str)

# 5. Same for startScheduledRideDispatch
dispatch_str = """    if (error) { toast.error("Could not dispatch ride."); return; }
    
    toast.success("You are now En Route to the scheduled pickup!");
    loadData();
  }"""
new_dispatch_str = """    if (error) { toast.error("Could not dispatch ride."); return; }
    
    toast.success("You are now En Route to the scheduled pickup!");
    setActiveTab("rides");
    loadData();
  }"""
content = content.replace(dispatch_str, new_dispatch_str)

with open('src/routes/driver-console.tsx', 'w') as f:
    f.write(content)
