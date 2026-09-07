import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, Menu, MoveUpRight, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const nav = [
  ["Experience", "/experience"], ["Electric", "/electric"], ["For Business", "/business"],
  ["Drive With Us", "/drive"], ["About", "/about"],
] as const;

export function Brand() {
  return <Link to="/" className="flex items-center gap-2.5" aria-label="Orange Taxi home">
    <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">O</span>
    <span className="text-sm font-bold tracking-[0.14em] text-foreground">ORANGE TAXI</span>
  </Link>;
}

export function SiteHeader() {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    router.navigate({ to: "/" });
  }

  return <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
    <div className="section-shell grid h-18 grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <Brand />
      <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
        {nav.map(([label, to]) => <Link key={to} to={to} className="text-[0.8rem] font-semibold text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>{label}</Link>)}
        {!loading && role === "driver" && (
          <Link to="/driver-console" className="text-[0.8rem] font-semibold text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>My Console</Link>
        )}
        {!loading && role === "admin" && (
          <Link to="/admin" className="text-[0.8rem] font-semibold text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>Admin</Link>
        )}
        {!loading && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border bg-warm px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
                <User className="size-3.5" />
                {user.email?.split("@")[0]}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/book">Book a Ride</Link>
              </DropdownMenuItem>
              {role === "driver" && (
                <DropdownMenuItem asChild>
                  <Link to="/driver-console">Driver Console</Link>
                </DropdownMenuItem>
              )}
              {role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">Admin Dashboard</Link>
                </DropdownMenuItem>
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
      {/* Mobile */}
      <Sheet>
        <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button></SheetTrigger>
        <SheetContent className="w-[88%] bg-background p-7 sm:max-w-md">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <nav className="mt-16 flex flex-col" aria-label="Mobile navigation">
            <SheetClose asChild><Link to="/" className="border-b border-border py-4 text-xl font-semibold">Home</Link></SheetClose>
            {nav.map(([label, to]) => <SheetClose key={to} asChild><Link to={to} className="border-b border-border py-4 text-xl font-semibold">{label}</Link></SheetClose>)}
            {role === "driver" && <SheetClose asChild><Link to="/driver-console" className="border-b border-border py-4 text-xl font-semibold">My Console</Link></SheetClose>}
            {role === "admin" && <SheetClose asChild><Link to="/admin" className="border-b border-border py-4 text-xl font-semibold">Admin</Link></SheetClose>}
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
  </header>;
}

export function SiteFooter() {
  return <footer className="bg-night py-16 text-background">
    <div className="section-shell grid gap-12 lg:grid-cols-[1.3fr_2fr]">
      <div><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">O</span><span className="text-sm font-bold tracking-[0.14em]">ORANGE TAXI</span></div><p className="mt-5 max-w-xs text-sm leading-7 text-background/60">Premium comfort. Thoughtful service. Electric by nature.</p></div>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
        <FooterGroup title="Explore" items={[["Home", "/"], ["Experience", "/experience"], ["Electric", "/electric"], ["Business", "/business"], ["About", "/about"]]} />
        <FooterGroup title="Join us" items={[["Book a ride", "/book"], ["Drive with us", "/drive"], ["Talk to Orange", "/talk-to-orange"], ["Support", "/support"]]} />
        <FooterGroup title="Legal" items={[["Privacy Policy", "/privacy"], ["Terms & Conditions", "/terms"]]} />
      </div>
    </div>
    <div className="section-shell mt-14 flex flex-col gap-3 border-t border-background/15 pt-6 text-xs text-background/45 sm:flex-row sm:justify-between"><span>© 2026 Orange Taxi</span><span>Instagram · LinkedIn · X</span></div>
  </footer>;
}

function FooterGroup({ title, items }: { title: string; items: readonly (readonly [string, string])[] }) {
  return <div><h2 className="text-xs font-bold uppercase tracking-[0.14em] text-background/45">{title}</h2><ul className="mt-4 space-y-3">{items.map(([label, to]) => <li key={to}><Link to={to as any} className="text-sm text-background/75 transition-colors hover:text-background">{label}</Link></li>)}</ul></div>;
}