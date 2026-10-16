import React, { useEffect, useState } from "react";

interface CoolCarSplashScreenProps {
  onFinish: () => void;
}

export function CoolCarSplashScreen({ onFinish }: CoolCarSplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Car animation runs for 1.8s. Start fade-out at 1.95s, finish at 2.3s
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 1950);

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2350);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  const handleSkip = () => {
    setFadingOut(true);
    setTimeout(() => {
      onFinish();
    }, 200);
  };

  return (
    <div
      id="splash-overlay"
      className={`fixed inset-0 z-[9999999] flex flex-col justify-between overflow-hidden bg-[#07090E] transition-opacity duration-400 select-none ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* Ambient Radial Orange Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[120px]" />

      {/* Skip Button */}
      <div className="absolute right-6 top-6 z-50">
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-slate-300 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white"
        >
          Skip ➔
        </button>
      </div>

      {/* Top Branding Section */}
      <div className="relative z-10 mx-auto mt-12 flex flex-col items-center px-4 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black tracking-widest text-[#F97316] sm:text-4xl md:text-5xl">
            ORANGE
          </span>
          <span className="text-3xl font-black tracking-widest text-white sm:text-4xl md:text-5xl">
            TAXI
          </span>
          <span className="h-2.5 w-2.5 rounded-full bg-[#F97316] shadow-[0_0_12px_#F97316]" />
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-500/15 px-3.5 py-1 text-[11px] font-extrabold tracking-widest text-orange-400">
          <span>⚡</span>
          <span>100% ELECTRIC CHAUFFEUR FLEET</span>
        </div>

        <p className="mt-2 text-xs font-medium tracking-wide text-slate-400 sm:text-sm">
          Mahindra BE.6 Signature Luxury EV
        </p>
      </div>

      {/* Center Highway Road & Speeding Car Canvas */}
      <div className="relative my-auto flex h-48 w-full items-center overflow-hidden">
        {/* Top Guardrail Neon Line */}
        <div className="absolute top-0 h-[2px] w-full bg-orange-500/30 shadow-[0_0_8px_#F97316]" />

        {/* Asphalt Surface */}
        <div className="relative flex h-full w-full items-center justify-center bg-[#0D111A]">
          {/* Dashed Road Lane Markers Moving in Speed */}
          <div className="dashed-road-lane absolute top-1/2 flex -translate-y-1/2 gap-6 opacity-60">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="h-[3px] w-10 flex-shrink-0 rounded-full bg-yellow-200/60 shadow-[0_0_6px_#FEF08A]"
              />
            ))}
          </div>

          {/* Speed Streaks Overlay */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="speed-streak speed-streak-1" />
            <div className="speed-streak speed-streak-2" />
            <div className="speed-streak speed-streak-3" />
          </div>

          {/* The High-Speed Animated Orange Taxi EV Car */}
          <div className="speeding-car-container absolute left-0 flex items-center">
            {/* Forward Headlight Beam */}
            <div className="headlight-beam pointer-events-none absolute left-[214px] top-1/2 -translate-y-1/2">
              <svg width="220" height="90" viewBox="0 0 220 90" fill="none">
                <defs>
                  <linearGradient id="webHeadlightGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.8" />
                    <stop offset="35%" stopColor="#FEF08A" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#FEF08A" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points="0,42 220,0 220,90 0,54" fill="url(#webHeadlightGrad)" />
              </svg>
            </div>

            {/* Twin Rear High-Speed Light Trails */}
            <div className="pointer-events-none absolute -left-28 top-1/2 -translate-y-1/2">
              <div className="h-[2px] w-28 bg-gradient-to-l from-red-500 to-transparent opacity-90 shadow-[0_0_8px_#EF4444]" />
              <div className="mt-1 h-[2px] w-36 bg-gradient-to-l from-orange-500 to-transparent opacity-90 shadow-[0_0_8px_#F97316]" />
            </div>

            {/* Neon Underglow */}
            <div className="absolute bottom-1 left-8 h-3 w-44 rounded-full bg-orange-500/70 blur-md shadow-[0_0_18px_#F97316]" />

            {/* Vector Illustration of Mahindra BE.6 Signature EV */}
            <svg
              width="230"
              height="72"
              viewBox="0 0 230 72"
              className="relative z-10 drop-shadow-[0_10px_20px_rgba(249,115,22,0.4)]"
            >
              <defs>
                {/* Body Metallic Gradient */}
                <linearGradient id="webCarBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FB923C" />
                  <stop offset="40%" stopColor="#F97316" />
                  <stop offset="85%" stopColor="#EA580C" />
                  <stop offset="100%" stopColor="#C2410C" />
                </linearGradient>

                {/* Roof / Glass Tint Gradient */}
                <linearGradient id="webGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0F172A" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#1E293B" stopOpacity="0.8" />
                </linearGradient>

                {/* Wheel Rim Gradient */}
                <radialGradient id="webRimGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#94A3B8" />
                  <stop offset="55%" stopColor="#475569" />
                  <stop offset="100%" stopColor="#0F172A" />
                </radialGradient>
              </defs>

              {/* 1. Sleek Aerodynamic Roof & Glasshouse */}
              <path
                d="M 60 28 L 92 12 Q 130 9 162 13 L 186 28 Z"
                fill="url(#webGlassGrad)"
                stroke="#F97316"
                strokeWidth="0.8"
              />

              {/* Chauffeur & Cabin silhouette */}
              <circle cx="120" cy="22" r="5" fill="#334155" opacity="0.85" />
              <path d="M 112 28 Q 120 25 128 28 Z" fill="#334155" />

              {/* Glass Pillar separator */}
              <rect x="127" y="12" width="4" height="16" fill="#0F172A" />

              {/* 2. Main Mahindra BE.6 Aerodynamic Body Shell */}
              <path
                d="M 12 40 
                   Q 10 32 20 31 
                   L 58 29 
                   L 88 12 
                   Q 135 8 168 13 
                   L 194 28 
                   L 214 33 
                   Q 224 35 224 43 
                   L 220 50 
                   Q 218 53 210 53 
                   L 188 53 
                   Q 186 42 172 42 
                   Q 158 42 156 53 
                   L 82 53 
                   Q 80 42 66 42 
                   Q 52 42 50 53 
                   L 20 53 
                   Q 13 53 12 45 Z"
                fill="url(#webCarBodyGrad)"
              />

              {/* Signature Electric Orange Taxi Side Cladding / Aero Accent */}
              <path
                d="M 50 51 L 82 51 Q 90 49 105 49 L 140 49 Q 150 49 156 51 L 188 51"
                stroke="#0F172A"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Distinctive Orange Taxi Door Decal / Accent Stripe */}
              <path
                d="M 76 36 L 150 36"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeOpacity="0.9"
                strokeLinecap="round"
              />
              <path
                d="M 95 39 L 132 39"
                stroke="#FEF08A"
                strokeWidth="1.2"
                strokeOpacity="0.8"
              />

              {/* 3. Front Headlight Cluster (Quad LED Beam) */}
              <path d="M 214 34 L 223 37 L 219 41 L 211 39 Z" fill="#FEF08A" />
              <circle cx="218" cy="38" r="2" fill="#FFFFFF" />

              {/* 4. Rear Connected Taillight Bar (Vivid Amber/Red LED) */}
              <path d="M 14 34 L 18 34 L 17 40 L 13 39 Z" fill="#EF4444" />
              <rect x="12" y="36" width="3" height="4" rx="1.5" fill="#F97316" />

              {/* 5. Aerodynamic Rear Spoiler */}
              <path d="M 10 32 L 24 30 L 22 28 L 8 30 Z" fill="#0F172A" />

              {/* 6. Front Wheel Assembly */}
              <g transform="translate(172, 53)">
                <circle cx="0" cy="0" r="14" fill="#0B0D11" stroke="#1E293B" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="10" fill="url(#webRimGrad)" />
                <rect x="-1.5" y="-9" width="3" height="18" fill="#F8FAFC" rx="1" />
                <rect x="-9" y="-1.5" width="18" height="3" fill="#F8FAFC" rx="1" />
                <path d="M -4 -8 A 8 8 0 0 1 4 -8" stroke="#F97316" strokeWidth="3" fill="none" />
                <circle cx="0" cy="0" r="3.5" fill="#F97316" />
              </g>

              {/* 7. Rear Wheel Assembly */}
              <g transform="translate(66, 53)">
                <circle cx="0" cy="0" r="14" fill="#0B0D11" stroke="#1E293B" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="10" fill="url(#webRimGrad)" />
                <rect x="-1.5" y="-9" width="3" height="18" fill="#F8FAFC" rx="1" />
                <rect x="-9" y="-1.5" width="18" height="3" fill="#F8FAFC" rx="1" />
                <path d="M -4 -8 A 8 8 0 0 1 4 -8" stroke="#F97316" strokeWidth="3" fill="none" />
                <circle cx="0" cy="0" r="3.5" fill="#F97316" />
              </g>
            </svg>
          </div>
        </div>

        {/* Bottom Guardrail Neon Line */}
        <div className="absolute bottom-0 h-[2px] w-full bg-orange-500/60 shadow-[0_0_12px_#F97316]" />
      </div>

      {/* Footer Progress & Status */}
      <div className="relative z-10 mb-8 flex flex-col items-center px-4">
        <div className="h-1 w-36 overflow-hidden rounded-full bg-white/10">
          <div className="loading-progress-bar h-full rounded-full bg-[#F97316]" />
        </div>
        <p className="mt-3 text-xs font-semibold tracking-wider text-slate-400">
          Entering Orange Taxi...
        </p>
      </div>

      {/* Embedded CSS Animations for High-Speed Movement */}
      <style>{`
        @keyframes carSpeedDrive {
          0% {
            transform: translateX(-280px);
          }
          15% {
            transform: translateX(-40px);
          }
          40% {
            transform: translateX(25vw);
          }
          100% {
            transform: translateX(calc(100vw + 280px));
          }
        }

        @keyframes roadDashesMove {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-64px);
          }
        }

        @keyframes speedLineZoom {
          0% {
            transform: translateX(100vw);
            opacity: 0;
          }
          40% {
            opacity: 0.9;
          }
          100% {
            transform: translateX(-100px);
            opacity: 0;
          }
        }

        @keyframes progressBarFill {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }

        .speeding-car-container {
          animation: carSpeedDrive 1.8s cubic-bezier(0.38, 0.05, 0.15, 1.0) 0.3s forwards;
        }

        .dashed-road-lane {
          animation: roadDashesMove 0.35s linear infinite;
        }

        .loading-progress-bar {
          animation: progressBarFill 1.9s ease-out forwards;
        }

        .speed-streak {
          position: absolute;
          height: 2px;
          border-radius: 9999px;
          background: linear-gradient(90deg, transparent, #F97316, transparent);
        }

        .speed-streak-1 {
          top: 25%;
          width: 140px;
          animation: speedLineZoom 0.8s linear 0.4s infinite;
        }

        .speed-streak-2 {
          top: 50%;
          width: 220px;
          animation: speedLineZoom 0.6s linear 0.6s infinite;
        }

        .speed-streak-3 {
          top: 75%;
          width: 180px;
          animation: speedLineZoom 0.7s linear 0.5s infinite;
        }
      `}</style>
    </div>
  );
}
