// @ts-nocheck

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional(), mode: z.enum(["signin", "signup"]).optional() }),
  head: () => ({ meta: [{ title: "Sign In — Orange Taxi" }, { name: "description", content: "Sign in or create your Orange Taxi account." }] }),
  component: LoginPage,
});

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["customer", "driver"]).default("customer"),
});

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

function LoginPage() {
  const { redirect, mode: initialMode } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const signInForm = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });
  const signUpForm = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

  async function handleSignIn(values: SignInValues) {
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    if (!data.user) { setSubmitting(false); return; }

    // Fetch role to redirect properly
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roleList = (roles ?? []).map(r => r.role);
    const destination = redirect ?? (roleList.includes("admin") ? "/admin" : roleList.includes("driver") ? "/driver-console" : "/book");
    toast.success("Welcome back!");
    navigate({ to: destination as any });
  }

  async function handleSignUp(values: SignUpValues) {
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName, phone: values.phone, role: values.role } },
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    if (data.user && !data.session) {
      toast.success("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setSubmitting(false);
      return;
    }
    toast.success("Account created! Welcome to Orange Taxi.");
    const destination = redirect ?? (values.role === "driver" ? "/driver-console" : "/book");
    navigate({ to: destination as any });
  }

  async function claimAdmin() {
    const { data, error } = await supabase.auth.getSession();
    if (!data.session) { toast.error("Sign in first, then click this button."); return; }
    const { data: result } = await supabase.rpc("claim_first_admin" as any);
    if (result) { toast.success("You are now admin! Redirecting..."); setTimeout(() => navigate({ to: "/admin" as any }), 1500); }
    else toast.info("An admin already exists — this button only works once.");
  }

  return (
    <section className="min-h-[100svh] bg-warm">
      <div className="section-shell flex min-h-[100svh] items-center justify-center py-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">O</span>
            <span className="text-sm font-bold tracking-[0.14em]">ORANGE TAXI</span>
          </Link>

          <div className="mt-10 rounded-2xl border border-border bg-background p-8 shadow-soft">
            {/* Tab toggle */}
            <div className="flex rounded-xl border border-border bg-muted p-1">
              {(["signin", "signup"] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {m === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            {mode === "signin" ? (
              <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="mt-8 space-y-5">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" placeholder="you@example.com" className="mt-1.5" {...signInForm.register("email")} />
                  {signInForm.formState.errors.email && <p className="mt-1 text-xs text-destructive">{signInForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="si-pass">Password</Label>
                  <div className="relative mt-1.5">
                    <Input id="si-pass" type={showPass ? "text" : "password"} placeholder="••••••••" className="pr-10" {...signInForm.register("password")} />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signInForm.formState.errors.password && <p className="mt-1 text-xs text-destructive">{signInForm.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Sign In <ArrowRight className="size-4" /></>}
                </Button>
              </form>
            ) : (
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="mt-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex gap-3">
                    <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-colors ${signUpForm.watch("role") === "customer" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      <input type="radio" value="customer" className="sr-only" {...signUpForm.register("role")} />
                      Ride with Orange
                    </label>
                    <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-colors ${signUpForm.watch("role") === "driver" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      <input type="radio" value="driver" className="sr-only" {...signUpForm.register("role")} />
                      Drive for Orange
                    </label>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="su-name">Full Name</Label>
                    <Input id="su-name" placeholder="Priya Sharma" className="mt-1.5" {...signUpForm.register("fullName")} />
                    {signUpForm.formState.errors.fullName && <p className="mt-1 text-xs text-destructive">{signUpForm.formState.errors.fullName.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="su-phone">Phone</Label>
                    <Input id="su-phone" type="tel" placeholder="+91 98765 43210" className="mt-1.5" {...signUpForm.register("phone")} />
                    {signUpForm.formState.errors.phone && <p className="mt-1 text-xs text-destructive">{signUpForm.formState.errors.phone.message}</p>}
                  </div>
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" placeholder="you@example.com" className="mt-1.5" {...signUpForm.register("email")} />
                  {signUpForm.formState.errors.email && <p className="mt-1 text-xs text-destructive">{signUpForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="su-pass">Password</Label>
                  <div className="relative mt-1.5">
                    <Input id="su-pass" type={showPass ? "text" : "password"} placeholder="••••••••" className="pr-10" {...signUpForm.register("password")} />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signUpForm.formState.errors.password && <p className="mt-1 text-xs text-destructive">{signUpForm.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Create Account <ArrowRight className="size-4" /></>}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By signing up you agree to our{" "}
                  <Link to="/terms" className="underline hover:text-foreground">Terms</Link>{" "}and{" "}
                  <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
                </p>
              </form>
            )}

            {/* Admin claim */}
            <div className="mt-8 border-t border-border pt-6">
              <button onClick={claimAdmin} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                <ShieldCheck className="size-4 shrink-0" />
                <span>First time setup? Click to claim admin role (works once)</span>
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-primary hover:underline">
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
