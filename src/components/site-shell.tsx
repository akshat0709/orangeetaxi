import { Link, useRouter } from "@tanstack/react-router";
import {
  Banknote,
  CalendarClock,
  CarFront,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  MoveUpRight,
  Sun,
  User,
  UserPlus,
  Wallet,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { triggerPWAInstall } from "@/components/pwa-install-prompt";

const nav = [
  ["Experience", "/experience"],
  ["Electric", "/electric"],
  ["Business", "/business"],
  ["Drive", "/drive"],
  ["About", "/about"],
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <button
      onClick={() => i18n.changeLanguage((i18n.language || "en").startsWith("hi") ? "en" : "hi")}
      aria-label="Toggle language"
      className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary shrink-0"
      title="Toggle Hindi/English"
    >
      <span className="font-bold text-[10px]">
        {(i18n.language || "en").startsWith("hi") ? "अ" : "EN"}
      </span>
    </button>
  );
}

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Orange Taxi home">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        O
      </span>
      <span className="text-sm font-bold tracking-[0.14em] text-foreground">ORANGE TAXI</span>
    </Link>
  );
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

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="section-shell flex h-16 sm:h-18 items-center justify-between gap-3 min-w-0 max-w-full">
        <Brand />
        <nav
          className="hidden items-center shrink-0 gap-3 xl:gap-4 lg:flex whitespace-nowrap"
          aria-label="Main navigation"
        >
          {nav.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              className="text-sm font-medium whitespace-nowrap shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {label}
            </Link>
          ))}

          <div className="flex items-center gap-1.5 ml-1">
            <LanguageSwitcher />
            {/* Theme Toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
          </div>

          {!loading && user ? (
            <div className="flex items-center gap-2 ml-1">
              <Button asChild size="sm" className="h-9 px-4 text-sm font-semibold">
                <Link to="/book">Book a ride</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-warm px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
                    <User className="size-3.5 text-primary" />
                    <span className="max-w-[100px] truncate">{user.email?.split("@")[0]}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
                    Signed in as <span className="text-foreground font-bold">{user.email}</span>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <CalendarClock className="mr-2 size-4" /> My rides
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wallet">
                      <Wallet className="mr-2 size-4" /> Wallet
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/book">
                      <CarFront className="mr-2 size-4" /> Book a ride
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/talk-to-orange">
                      <MessageCircle className="mr-2 size-4" /> Help
                    </Link>
                  </DropdownMenuItem>
                  {role === "driver" && (
                    <DropdownMenuItem asChild>
                      <Link to="/driver-console">
                        <CarFront className="mr-2 size-4" /> Chauffeur console
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" search={{ tab: "hub" }}>
                          <LayoutDashboard className="mr-2 size-4" /> Admin
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin" search={{ tab: "fleet" }}>
                          <Warehouse className="mr-2 size-4" /> Fleet & bays
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin" search={{ tab: "cash" }}>
                          <Banknote className="mr-2 size-4" /> Cash settlements
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/login" search={{ mode: "signup" }}>
                      <UserPlus className="mr-2 size-4" /> Create another account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={triggerPWAInstall}>
                    <Download className="mr-2 size-4" /> Install App
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 size-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            !loading && (
              <div className="flex items-center gap-2 ml-1">
                <Button asChild variant="ghost" size="sm" className="h-9 px-3 text-sm">
                  <Link to="/login" search={{ mode: "signin" }}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 px-3 text-sm">
                  <Link to="/login" search={{ mode: "signup" }}>
                    Sign up
                  </Link>
                </Button>
                <Button asChild size="sm" className="h-9 px-4 text-sm font-semibold">
                  <Link to="/book">Book a ride</Link>
                </Button>
              </div>
            )
          )}
        </nav>
        {/* Mobile Header Controls */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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
                <SheetClose asChild>
                  <Link to="/" className="border-b border-border py-4 text-xl font-semibold">
                    Home
                  </Link>
                </SheetClose>
                {user && (
                  <SheetClose asChild>
                    <Link
                      to="/profile"
                      className="border-b border-border py-4 text-xl font-semibold text-primary flex items-center justify-between"
                    >
                      <span>My rides</span>
                    </Link>
                  </SheetClose>
                )}
                {nav.map(([label, to]) => (
                  <SheetClose key={to} asChild>
                    <Link to={to} className="border-b border-border py-4 text-xl font-semibold">
                      {label}
                    </Link>
                  </SheetClose>
                ))}
                {role === "driver" && (
                  <SheetClose asChild>
                    <Link
                      to="/driver-console"
                      className="border-b border-border py-4 text-xl font-semibold"
                    >
                      My Console
                    </Link>
                  </SheetClose>
                )}
                {role === "admin" && (
                  <SheetClose asChild>
                    <Link
                      to="/admin"
                      search={{ tab: "hub" }}
                      className="border-b border-border py-4 text-xl font-semibold"
                    >
                      Admin
                    </Link>
                  </SheetClose>
                )}
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
                <button
                  onClick={handleSignOut}
                  className="mt-8 flex w-full items-center gap-2 rounded-lg border border-destructive/30 px-4 py-3 text-sm font-semibold text-destructive"
                >
                  <LogOut className="size-4" /> Sign Out
                </button>
              ) : (
                <div className="mt-8 flex flex-col gap-2.5">
                  <SheetClose asChild>
                    <Button asChild className="w-full">
                      <Link to="/login" search={{ mode: "signup" }}>
                        Sign Up
                      </Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/login" search={{ mode: "signin" }}>
                        Sign In
                      </Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className="w-full border border-border"
                    >
                      <Link to="/book">
                        Book a Ride <MoveUpRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                  </SheetClose>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-night pt-16 pb-24 sm:pb-16 text-white">
      <div className="section-shell grid gap-12 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              O
            </span>
            <span className="text-sm font-bold tracking-[0.14em] text-white">ORANGE TAXI</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/65">
            Electric chauffeur rides across Delhi NCR.
          </p>
          <div className="mt-6 space-y-2 text-sm">
            <a href="tel:+917294073222" className="block text-white/85 hover:text-white">
              +91 72940 73222 <span className="text-white/45">· 24x7</span>
            </a>
            <a
              href="mailto:support@orange-taxi.com"
              className="block text-white/85 hover:text-white"
            >
              support@orange-taxi.com
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <FooterGroup
            title="Explore"
            items={[
              ["Experience", "/experience"],
              ["Electric fleet", "/electric"],
              ["For business", "/business"],
              ["About us", "/about"],
            ]}
          />
          <FooterGroup
            title="Riders & drivers"
            items={[
              ["Book a ride", "/book"],
              ["My rides", "/profile"],
              ["Drive with us", "/drive"],
              ["Help & support", "/support"],
              ["Contact", "/contact"],
            ]}
          />
          <FooterGroup
            title="Legal"
            items={[
              ["Privacy policy", "/privacy"],
              ["Terms & conditions", "/terms"],
              ["Cancellations & refunds", "/refunds"],
            ]}
          />
        </div>
      </div>

      <div className="section-shell mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs leading-5 text-white/45 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <p className="max-w-2xl">
          © 2026 Orange Taxi Limited · CIN U49224DL2026PLC461350 · S-210, 2nd Floor, Panchshila
          Park, South Malviya Nagar, New Delhi 110017 · Grievances: grievance@orange-taxi.com
        </p>
        <a
          href="https://builtbyakshat.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline sm:pr-20"
        >
          Built by Akshat
        </a>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  items,
}: {
  title: string;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map(([label, to]) => (
          <li key={to}>
            {to.endsWith(".xml") ? (
              <a
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/75 transition-colors hover:text-white"
              >
                {label}
              </a>
            ) : (
              <Link
                to={to as any}
                className="text-sm text-white/75 transition-colors hover:text-white"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
