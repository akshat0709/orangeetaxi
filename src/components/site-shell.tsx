// @ts-nocheck

import { Link, useRouter } from "@tanstack/react-router";
import { Download, LogOut, Menu, Moon, MoveUpRight, Settings, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { triggerPWAInstall } from "@/components/pwa-install-prompt";

const nav = [
  ["Experience", "/experience"], ["Electric", "/electric"], ["For Business", "/business"],
  ["Drive With Us", "/drive"], ["Talk to Orange", "/talk-to-orange"], ["About", "/about"],
] as const;


export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={() => i18n.changeLanguage((i18n.language || "en").startsWith("hi") ? "en" : "hi")} 
      className="hidden md:flex" 
      title="Toggle Hindi/English"
    >
      <span className="font-bold text-xs">{(i18n.language || "en").startsWith("hi") ? "अ" : "EN"}</span>
    </Button>
  );
}

export function Brand() {
  return <Link to="/" className="flex items-center gap-2.5" aria-label="Orange Taxi home">
    <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">O</span>
    <span className="text-sm font-bold tracking-[0.14em] text-foreground">ORANGE TAXI</span>
  </Link>;
}

export function SiteHeader() {
  const { user, role, loading, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    router.navigate({ to: "/" });
  }

  return <header className="site-header sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
    <div className="section-shell flex h-16 sm:h-18 items-center justify-between gap-4 min-w-0 max-w-full">
      <Brand />
      <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
        {nav.map(([label, to]) => <Link key={to} to={to} className="text-[0.8rem] font-semibold text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>{label}</Link>)}
        {!loading && user && (
          <Link to="/profile" className="text-[0.8rem] font-semibold text-primary hover:underline" activeProps={{ className: "text-foreground font-bold" }}>My Rides & Schedule</Link>
        )}
        {!loading && role === "driver" && (
          <Link to="/driver-console" className="text-[0.8rem] font-semibold text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>My Console</Link>
        )}
        {!loading && role === "admin" && (
          <Link to="/admin" className="text-[0.8rem] font-semibold text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>Admin</Link>
        )}
        {/* Install App Trigger */}
        <button
          onClick={triggerPWAInstall}
          type="button"
          aria-label="Install App"
          className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground xl:flex"
        >
          <Download className="size-3.5" /> Install App
        </button>
        <LanguageSwitcher />
        {/* Theme Toggle */}
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
        {!loading && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border bg-warm px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
                <User className="size-3.5" />
                {user.email?.split("@")[0]}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link to="/profile">📅 My Rides & Schedule</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/book">Book a Ride</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/talk-to-orange">Talk to Orange</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={triggerPWAInstall}>
                <Download className="mr-2 size-4" /> Install App
              </DropdownMenuItem>
              {role === "driver" && (
                <DropdownMenuItem asChild>
                  <Link to="/driver-console">Driver Console</Link>
                </DropdownMenuItem>
              )}
              {role === "admin" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin">Admin Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" search={{ tab: "fleet" }}>Fleet & Bays</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" search={{ tab: "cash" }}>Cash Settlements</Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          !loading && (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm"><Link to="/login">Sign In</Link></Button>
              <Button asChild><Link to="/book">Book a Ride <MoveUpRight /></Link></Button>
            </div>
          )
        )}
      </nav>
      {/* Mobile Header Controls */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="site-sheet-content w-[88%] bg-background p-7 sm:max-w-md">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center justify-between">
            <Brand />
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground"
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
          <nav className="mt-16 flex flex-col" aria-label="Mobile navigation">
            <SheetClose asChild><Link to="/" className="border-b border-border py-4 text-xl font-semibold">Home</Link></SheetClose>
            {user && (
              <SheetClose asChild>
                <Link to="/profile" className="border-b border-border py-4 text-xl font-semibold text-primary flex items-center justify-between">
                  <span>📅 My Rides & Schedule</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Upcoming</span>
                </Link>
              </SheetClose>
            )}
            {nav.map(([label, to]) => <SheetClose key={to} asChild><Link to={to} className="border-b border-border py-4 text-xl font-semibold">{label}</Link></SheetClose>)}
            {role === "driver" && <SheetClose asChild><Link to="/driver-console" className="border-b border-border py-4 text-xl font-semibold">My Console</Link></SheetClose>}
            {role === "admin" && <SheetClose asChild><Link to="/admin" className="border-b border-border py-4 text-xl font-semibold">Admin</Link></SheetClose>}
            <button
              onClick={() => {
                triggerPWAInstall();
              }}
              className="flex items-center gap-2 border-b border-border py-4 text-left text-xl font-semibold text-primary transition-colors hover:text-primary/80"
            >
              <Download className="size-5" /> Install App
            </button>
          </nav>
          {user ? (
            <button onClick={handleSignOut} className="mt-8 flex w-full items-center gap-2 rounded-lg border border-destructive/30 px-4 py-3 text-sm font-semibold text-destructive">
              <LogOut className="size-4" /> Sign Out
            </button>
          ) : (
            <div className="mt-8 flex flex-col gap-3">
              <SheetClose asChild><Button asChild variant="ghost" className="w-full"><Link to="/login">Sign In</Link></Button></SheetClose>
              <SheetClose asChild><Button asChild size="lg" className="w-full"><Link to="/book">Book a Ride <MoveUpRight /></Link></Button></SheetClose>
            </div>
          )}
        </SheetContent>
      </Sheet>
      </div>
    </div>
  </header>;
}

export function SiteFooter() {
  return (
    <footer className="bg-night py-16 text-white">
      <div className="section-shell grid gap-12 lg:grid-cols-[1.3fr_2fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">O</span>
            <span className="text-sm font-bold tracking-[0.14em] text-white">ORANGE TAXI</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            <strong>ORANGE TAXI LIMITED</strong> — India's zero-emission premium electric mobility network.
          </p>
          
          {/* Statutory Corporate Identification under Companies Act, 2013 */}
          <div className="mt-5 space-y-1.5 border-t border-white/15 pt-4 text-xs text-white/60">
            <p><span className="font-semibold text-white/80">CIN:</span> U49224DL2026PLC461350</p>
            <p><span className="font-semibold text-white/80">Registered Office:</span> S-210, 2nd Floor, Panchshila Park, South Malviya Nagar, South Delhi, New Delhi 110017, India</p>
            <p className="pt-1">
              <span className="font-semibold text-white/80">24x7 Helpline:</span> +91 11 4000 7000 · <span className="font-semibold text-white/80">Support:</span> support@orange-taxi.com
            </p>
            <p>
              <span className="font-semibold text-white/80">Bookings:</span> bookings@orange-taxi.com · <span className="font-semibold text-white/80">Invoicing:</span> billing@orange-taxi.com
            </p>
            <p>
              <span className="font-semibold text-white/80">Corporate:</span> business@orange-taxi.com · <span className="font-semibold text-white/80">Grievance:</span> grievance@orange-taxi.com
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <FooterGroup
            title="Explore"
            items={[
              ["Home", "/"],
              ["Experience", "/experience"],
              ["Electric Fleet", "/electric"],
              ["For Business", "/business"],
              ["About Us", "/about"],
            ]}
          />
          <FooterGroup
            title="Services"
            items={[
              ["Book a Ride", "/book"],
              ["My Rides & Schedule", "/profile"],
              ["Drive With Us", "/drive"],
              ["Talk to Orange", "/talk-to-orange"],
              ["Support & Grievance", "/support"],
              ["Corporate Contact", "/contact"],
            ]}
          />
          <FooterGroup
            title="Compliance & Legal"
            items={[
              ["Privacy Policy", "/privacy"],
              ["Terms & Conditions", "/terms"],
              ["Customer Care & SLA", "/support"],
              ["Driver Code & Safety", "/drive"],
              ["Sitemap (XML)", "/sitemap.xml"],
            ]}
          />
        </div>
      </div>

      <div className="section-shell mt-12 flex flex-col gap-3 border-t border-white/15 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 ORANGE TAXI LIMITED. All rights reserved. Registered under Companies Act, 2013.</span>
        <span>Delhi NCR · Licensed Motor Vehicle Aggregator</span>
      </div>
    </footer>
  );
}

function FooterGroup({ title, items }: { title: string; items: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map(([label, to]) => (
          <li key={to}>
            {to.endsWith(".xml") ? (
              <a href={to} target="_blank" rel="noopener noreferrer" className="text-sm text-white/75 transition-colors hover:text-white">
                {label}
              </a>
            ) : (
              <Link to={to as any} className="text-sm text-white/75 transition-colors hover:text-white">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}