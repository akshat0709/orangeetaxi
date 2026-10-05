with open('src/routes/driver-console.tsx', 'r') as f:
    content = f.read()

old_req = """    const reqList = rawReqList.filter(r => {
      // 5km radius check
      if (driverData.current_lat && driverData.current_lng && r.pickup_lat && r.pickup_lng) {
        const d = getDistanceInKm(driverData.current_lat, driverData.current_lng, r.pickup_lat, r.pickup_lng);
        if (d > 5) return false;
      }
      // decline check
      const dec = declines[r.id];
      if (dec) {
        if (dec.count >= 2) return false; // declined twice, never show
        if (dec.count === 1 && (now - dec.lastDeclinedAt < 30000)) return false; // 30s cooldown
      }
      return true;
    }).slice(0, 5); // take top 5 visible
    
    setNewRequests(reqList);"""

new_req = """    let reqList: any[] = [];
    if (driverData.is_online) {
      reqList = rawReqList.filter(r => {
        // 5km radius check
        if (driverData.current_lat && driverData.current_lng && r.pickup_lat && r.pickup_lng) {
          const d = getDistanceInKm(driverData.current_lat, driverData.current_lng, r.pickup_lat, r.pickup_lng);
          if (d > 5) return false;
        }
        // decline check
        const dec = declines[r.id];
        if (dec) {
          if (dec.count >= 2) return false; // declined twice, never show
          if (dec.count === 1 && (now - dec.lastDeclinedAt < 30000)) return false; // 30s cooldown
        }
        return true;
      }).slice(0, 5); // take top 5 visible
    }
    
    setNewRequests(reqList);"""

content = content.replace(old_req, new_req)

with open('src/routes/driver-console.tsx', 'w') as f:
    f.write(content)

