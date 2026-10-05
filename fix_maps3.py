with open('src/routes/book.tsx', 'r') as f:
    content = f.read()

bad_jsx = """          {step === 4 && pickup && drop ? (
            {isDesktop && (
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
            )}
          ) : ("""

good_jsx = """          {step === 4 && pickup && drop ? (
            isDesktop ? (
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
            ) : null
          ) : ("""

content = content.replace(bad_jsx, good_jsx)

with open('src/routes/book.tsx', 'w') as f:
    f.write(content)
