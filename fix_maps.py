import re

with open('src/routes/book.tsx', 'r') as f:
    content = f.read()

hook_code = """
import { useState, useEffect } from 'react';

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
}
"""

if "function useMediaQuery" not in content:
    content = content.replace('import { APIProvider } from "@vis.gl/react-google-maps";', 'import { APIProvider } from "@vis.gl/react-google-maps";\n' + hook_code)

hook_usage = """export default function BookRide() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');"""

content = content.replace("export default function BookRide() {", hook_usage)

# Remove the mobile map
old_mobile = """    {/* Live Map (Mobile View) */}
    <div className="mt-6 lg:hidden">
      <LiveRideMap
        id="mobile-live-map"
        pickup={pickup}
        dropoff={drop}
        driverLocation={driverInfo}
        rideStatus={status}
        distKm={distKm}
      />
    </div>"""

new_mobile = """    {/* Live Map (Mobile View) */}
    {!isDesktop && (
      <div className="mt-6 lg:hidden">
        <LiveRideMap
          id="mobile-live-map"
          pickup={pickup}
          dropoff={drop}
          driverLocation={driverInfo}
          rideStatus={status}
          distKm={distKm}
        />
      </div>
    )}"""
content = content.replace(old_mobile, new_mobile)

# Update the desktop map
old_desktop = """            <div className="hidden lg:block sticky top-24 min-w-0 max-w-full">
              <LiveRideMap
                id="desktop-live-map"
                pickup={pickup}
                dropoff={drop}
                driverLocation={liveDriverInfo}
                rideStatus={liveRideStatus}
                distKm={distKm}
              />
            </div>"""

new_desktop = """            {isDesktop && (
              <div className="hidden lg:block sticky top-24 min-w-0 max-w-full">
                <LiveRideMap
                  id="desktop-live-map"
                  pickup={pickup}
                  dropoff={drop}
                  driverLocation={liveDriverInfo}
                  rideStatus={liveRideStatus}
                  distKm={distKm}
                />
              </div>
            )}"""
content = content.replace(old_desktop, new_desktop)

with open('src/routes/book.tsx', 'w') as f:
    f.write(content)

