import re

with open('src/routes/driver-console.tsx', 'r') as f:
    content = f.read()

# Replace the sequential block with Promise.all
start_marker = '    // Fetch areas for coordinates\n    const { data: areaData } = await supabase.from("service_areas").select("*");'
end_marker = '        setSettlements(settleData);\n      } else {'

# Find the block we need to replace
match = re.search(re.escape(start_marker) + r'.*?try \{\n      const \{ data: settleData \} = await supabase\n        \.from\("driver_cash_settlements"\)\n        \.select\("\*"\)\n        \.eq\("driver_id", driverData.id\)\n        \.order\("created_at", \{ ascending: false \}\);\n      if \(settleData\) \{\n        setSettlements\(settleData\);\n      \} else \{', content, re.DOTALL)

if match:
    old_block = match.group(0)
    
    new_block = """    // Parallelize all main dashboard queries!
    const [
      { data: areaData },
      { data: active },
      { data: requests },
      { data: schedData },
      { data: recent },
      { data: settleData }
    ] = await Promise.all([
      supabase.from("service_areas").select("*"),
      supabase.from("bookings").select("*").eq("driver_id", driverData.id).in("status", ["accepted", "arrived", "in_progress"]).order("created_at", { ascending: false }),
      supabase.from("bookings").select("*").eq("status", "searching").is("driver_id", null).order("created_at", { ascending: false }).limit(20),
      supabase.from("bookings").select("*").eq("status", "scheduled").order("scheduled_at", { ascending: true }).limit(30),
      supabase.from("bookings").select("*").eq("driver_id", driverData.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(100),
      supabase.from("driver_cash_settlements").select("*").eq("driver_id", driverData.id).order("created_at", { ascending: false })
    ]);

    const areaMap: Record<string, ServiceArea> = {};
    (areaData || []).forEach((a: any) => areaMap[a.name] = a);
    setAreas(areaMap);

    const activeList = (active as Booking[]) ?? [];
    setActiveRides(activeList);

    const rawReqList = (requests as Booking[]) ?? [];
    const now = Date.now();
    const declines = JSON.parse(localStorage.getItem("orange_declines") || "{}");
    
    let reqList: any[] = [];
    if (driverData.is_online) {
      reqList = rawReqList.filter(r => {
        if (driverData.current_lat && driverData.current_lng && r.pickup_lat && r.pickup_lng) {
          const d = getDistanceInKm(driverData.current_lat, driverData.current_lng, r.pickup_lat, r.pickup_lng);
          if (d > 5) return false;
        }
        const dec = declines[r.id];
        if (dec) {
          if (dec.count >= 2) return false;
          if (dec.count === 1 && (now - dec.lastDeclinedAt < 30000)) return false;
        }
        return true;
      }).slice(0, 5);
    }
    setNewRequests(reqList);

    const rawSchedList = (schedData as Booking[]) ?? [];
    const schedList = rawSchedList.filter(b => !b.driver_id || b.driver_id === driverData.id);
    setScheduledBookings(schedList);

    const allCustIds = Array.from(new Set([
      ...activeList.map(b => b.customer_id),
      ...reqList.map(b => b.customer_id),
      ...schedList.map(b => b.customer_id),
    ].filter(Boolean)));

    if (allCustIds.length > 0) {
      try {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", allCustIds);
        if (profs) {
          const map: Record<string, { full_name: string; phone: string }> = {};
          profs.forEach((p: any) => { map[p.id] = { full_name: p.full_name || "Passenger", phone: p.phone || "" }; });
          setCustomerProfiles(prev => ({ ...prev, ...map }));
        }
      } catch (e) {}
    }

    if (reqList.length > prevRequestsCountRef.current && prevRequestsCountRef.current !== -1) {
      if (soundEnabled && driverData?.is_online) {
        playRideRequestChime();
        toast.info("🔔 New ride request available nearby!", { duration: 4000 });
      }
    }
    prevRequestsCountRef.current = reqList.length;

    const recentList = (recent as Booking[]) ?? [];
    if (driverData.vehicle_number && driverData.vehicle_number !== "Unassigned") {
      recentList.forEach(r => saveRideVehiclePlate(r.id, driverData.vehicle_number, r.reference));
    }
    setRecentRides(recentList);

    const totalCompleted = recentList.length;
    const ratedRides = recentList.filter(r => r.rating);
    const calculatedAvgRating = ratedRides.length > 0
      ? Number((ratedRides.reduce((s, r) => s + Number(r.rating || 0), 0) / ratedRides.length).toFixed(1))
      : driverData.rating || 5.0;

    if (totalCompleted > (driverData.total_rides || 0) || (ratedRides.length > 0 && Math.abs((driverData.rating || 0) - calculatedAvgRating) > 0.05)) {
      try {
        const nextRides = Math.max(driverData.total_rides || 0, totalCompleted);
        await supabase.from("drivers").update({ total_rides: nextRides, rating: calculatedAvgRating }).eq("id", driverData.id);
        driverData.total_rides = nextRides;
        driverData.rating = calculatedAvgRating;
        setDriver(prev => prev ? { ...prev, total_rides: nextRides, rating: calculatedAvgRating } : prev);
      } catch (e) {}
    }

    try {
      if (settleData) {
        setSettlements(settleData);
      } else {"""
    
    content = content.replace(old_block, new_block)
    
    with open('src/routes/driver-console.tsx', 'w') as f:
        f.write(content)
    print("Optimization applied!")
else:
    print("Could not find block to replace.")
