// @ts-nocheck

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  validateSearch: z.object({
    redirect: z.string().optional(),
    mode: z.enum(["signin", "signup", "forgot", "reset"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Sign In — Orange Taxi" },
      { name: "description", content: "Sign in or create your Orange Taxi account." },
    ],
  }),
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

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;
type ForgotValues = z.infer<typeof forgotSchema>;
type ResetValues = z.infer<typeof resetSchema>;

const LOCKOUT_KEY = "@orange_web_lockout_time";
const ATTEMPTS_KEY = "@orange_web_login_attempts";

function LoginPage() {
  const { redirect, mode: initialMode } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(initialMode ?? "signin");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const navigate = useNavigate();

  const signInForm = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });
  const signUpForm = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });
  const forgotForm = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });
  const resetForm = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  // Cooldown countdown timer
  useEffect(() => {
    const checkLockout = () => {
      try {
        const stored = localStorage.getItem(LOCKOUT_KEY);
        if (stored) {
          const diff = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
          if (diff > 0) {
            setLockoutRemaining(diff);
          } else {
            setLockoutRemaining(0);
            localStorage.removeItem(LOCKOUT_KEY);
          }
        } else {
          setLockoutRemaining(0);
        }
      } catch {}
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect recovery link tokens from email
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("type=recovery") ||
        search.includes("type=recovery") ||
        search.includes("mode=reset") ||
        (hash.includes("access_token=") && hash.includes("recovery"))
      ) {
        setMode("reset");
      }
    }

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        toast.info("Please enter your new password below to update it in the database.");
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSignIn(values: SignInValues) {
    try {
      const storedLockout = localStorage.getItem(LOCKOUT_KEY);
      if (storedLockout && parseInt(storedLockout, 10) > Date.now()) {
        const remainingSeconds = Math.ceil((parseInt(storedLockout, 10) - Date.now()) / 1000);
        toast.error(`Account locked due to 5 failed attempts. Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before trying again.`);
        return;
      }
    } catch {}

    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      try {
        const storedAttempts = localStorage.getItem(ATTEMPTS_KEY);
        let attempts = storedAttempts ? parseInt(storedAttempts, 10) : 0;
        attempts++;
        if (attempts >= 5) {
          const lockoutUntil = Date.now() + 60 * 1000;
          localStorage.setItem(LOCKOUT_KEY, lockoutUntil.toString());
          localStorage.setItem(ATTEMPTS_KEY, "0");
          setLockoutRemaining(60);
          toast.error("Account locked for 1 minute due to 5 unsuccessful login attempts.");
        } else {
          localStorage.setItem(ATTEMPTS_KEY, attempts.toString());
          toast.error(`${error.message} (${5 - attempts} attempt${5 - attempts === 1 ? '' : 's'} remaining before 1-minute cooldown)`);
        }
      } catch {
        toast.error(error.message);
      }
      setSubmitting(false);
      return;
    }

    try {
      localStorage.setItem(ATTEMPTS_KEY, "0");
      localStorage.removeItem(LOCKOUT_KEY);
    } catch {}
    if (!data.user) {
      setSubmitting(false);
      return;
    }

    // Fetch role to redirect properly
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roleList = (roles ?? []).map((r) => r.role);

    // Sync phone into drivers table if logging in as driver
    try {
      let userPhone = (data.user.user_metadata?.phone || data.user.phone || "").trim();
      if (!userPhone) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", data.user.id)
          .maybeSingle();
        if (prof?.phone) userPhone = prof.phone.trim();
      }

      if (userPhone && (roleList.includes("driver") || roleList.includes("admin"))) {
        const { data: existingDriver } = await supabase
          .from("drivers")
          .select("id, phone, vehicle_number, vehicle_model, vehicle_code")
          .eq("user_id", data.user.id)
          .maybeSingle();

        // Check if there is an application for this driver
        let appData: any = null;
        try {
          const { data: app } = await supabase
            .from("driver_applications")
            .select("*")
            .or(`email.eq.${data.user.email}${userPhone ? `,phone.eq.${userPhone}` : ""}`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          appData = app;
        } catch (e) {}

        let parsedNotes: any = {};
        try {
          if (
            appData?.admin_notes &&
            typeof appData.admin_notes === "string" &&
            appData.admin_notes.trim().startsWith("{")
          ) {
            parsedNotes = JSON.parse(appData.admin_notes);
          }
        } catch (e) {}

        const isPartner = Boolean(
          appData?.owns_vehicle ||
          appData?.driver_type === "partner" ||
          parsedNotes.driver_type === "partner",
        );
        const plate =
          appData?.vehicle_number ||
          parsedNotes.vehicle_number ||
          (isPartner ? "KA 01 EV 4421" : "DL 01 EV 1001");
        const model =
          appData?.vehicle_model ||
          parsedNotes.vehicle_model ||
          (isPartner ? "Tata Nexon EV" : "Mahindra BE.6");
        const photo = appData?.photo_url || parsedNotes.photo_url || "";
        const metaObj = { photo, plate, model, type: isPartner ? "partner" : "company" };

        if (existingDriver) {
          const updates: any = {};
          if (!existingDriver.phone || existingDriver.phone.trim() !== userPhone) {
            updates.phone = userPhone;
          }
          if (
            (!existingDriver.vehicle_number || existingDriver.vehicle_number === "Unassigned") &&
            plate
          ) {
            updates.vehicle_number = plate;
          }
          if (!existingDriver.vehicle_model && model) {
            updates.vehicle_model = model;
          }
          if (
            !existingDriver.vehicle_code ||
            !existingDriver.vehicle_code.startsWith("ORANGE_META:")
          ) {
            updates.vehicle_code = "ORANGE_META:" + JSON.stringify(metaObj);
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from("drivers").update(updates).eq("id", existingDriver.id);
          }
        } else if (roleList.includes("driver")) {
          await supabase.from("drivers").insert({
            user_id: data.user.id,
            full_name:
              data.user.user_metadata?.full_name ||
              appData?.full_name ||
              data.user.email?.split("@")[0] ||
              "Driver",
            phone: userPhone,
            city: appData?.city || "Bengaluru",
            status: "active",
            vehicle_model: model,
            vehicle_number: plate,
            vehicle_code: "ORANGE_META:" + JSON.stringify(metaObj),
          });
        }
      }
    } catch (err) {
      console.warn("Could not sync driver phone on sign in:", err);
    }

    const destination =
      redirect ??
      (roleList.includes("admin")
        ? "/admin"
        : roleList.includes("driver")
          ? "/driver-console"
          : "/book");
    toast.success("Welcome back!");
    navigate({ to: destination as any });
  }

  async function handleSignUp(values: SignUpValues) {
    setSubmitting(true);
    const cleanPhone = (values.phone || "").trim();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName, phone: cleanPhone, role: values.role } },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    if (data.user) {
      // 1. Immediately save phone in profiles
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: values.fullName,
          phone: cleanPhone,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {}

      // 2. If signing up as driver, immediately create driver profile with the exact phone
      if (values.role === "driver") {
        try {
          const defaultPlate = "DL 01 EV 1001";
          const defaultModel = "Mahindra BE.6";
          const metaObj = { photo: "", plate: defaultPlate, model: defaultModel, type: "company" };

          await supabase.from("drivers").upsert(
            {
              user_id: data.user.id,
              full_name: values.fullName,
              phone: cleanPhone,
              city: "Bengaluru",
              status: "active",
              vehicle_model: defaultModel,
              vehicle_number: defaultPlate,
              vehicle_code: "ORANGE_META:" + JSON.stringify(metaObj),
            },
            { onConflict: "user_id" },
          );
        } catch (e) {}
      }
    }

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

  async function handleForgotPassword(values: ForgotValues) {
    setSubmitting(true);
    try {
      const redirectUrl =
        typeof window !== "undefined" && window.location.origin.includes("orange-taxi.com")
          ? `${window.location.origin}/login?mode=reset`
          : "https://orange-taxi.com/login?mode=reset";

      const { error } = await supabase.auth.resetPasswordForEmail(values.email.trim(), {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      toast.success("Password reset instructions sent! Please check your email inbox.");
      setMode("signin");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(values: ResetValues) {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;
      toast.success("Password updated in database! You can now sign in with your new password.");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/login");
      }
      setMode("signin");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function claimAdmin() {
    const { data, error } = await supabase.auth.getSession();
    if (!data.session) {
      toast.error("Sign in first, then click this button.");
      return;
    }
    const { data: result } = await supabase.rpc("claim_first_admin" as any);
    if (result) {
      toast.success("You are now admin! Redirecting...");
      setTimeout(() => navigate({ to: "/admin" as any }), 1500);
    } else toast.info("An admin already exists — this button only works once.");
  }

  return (
    <section className="min-h-[100svh] bg-warm">
      <div className="section-shell flex min-h-[100svh] items-center justify-center py-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              O
            </span>
            <span className="text-sm font-bold tracking-[0.14em]">ORANGE TAXI</span>
          </Link>

          <div className="mt-10 rounded-2xl border border-border bg-background p-8 shadow-soft">
            {/* Tab toggle */}
            <div className="flex rounded-xl border border-border bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  mode === "signin" || mode === "forgot" || mode === "reset"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "forgot" ? "Reset Password" : mode === "reset" ? "Set New Password" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>

            {mode === "signin" ? (
              <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="mt-8 space-y-5">
                {lockoutRemaining > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                    Account temporarily locked due to 5 unsuccessful attempts. Please wait {lockoutRemaining} second{lockoutRemaining === 1 ? "" : "s"} before trying again.
                  </div>
                )}
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mt-1.5"
                    {...signInForm.register("email")}
                  />
                  {signInForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-destructive">
                      {signInForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="si-pass">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const currentEmail = signInForm.getValues("email");
                        if (currentEmail) forgotForm.setValue("email", currentEmail);
                        setMode("forgot");
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="si-pass"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      {...signInForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signInForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-destructive">
                      {signInForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting || lockoutRemaining > 0}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : lockoutRemaining > 0 ? (
                    `Locked (${lockoutRemaining}s)`
                  ) : (
                    <>
                      Sign In <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : mode === "forgot" ? (
              <form onSubmit={forgotForm.handleSubmit(handleForgotPassword)} className="mt-8 space-y-5">
                <div>
                  <h3 className="text-lg font-bold">Reset Password</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter your registered email address and we'll send you instructions to reset your password.
                  </p>
                </div>
                <div>
                  <Label htmlFor="fo-email">Email Address</Label>
                  <Input
                    id="fo-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mt-1.5"
                    {...forgotForm.register("email")}
                  />
                  {forgotForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-destructive">
                      {forgotForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Send Reset Instructions <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : mode === "reset" ? (
              <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="mt-8 space-y-5">
                <div>
                  <h3 className="text-lg font-bold">Set New Password</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter a new secure password for your Orange Taxi account.
                  </p>
                </div>
                <div>
                  <Label htmlFor="re-pass">New Password</Label>
                  <Input
                    id="re-pass"
                    type="password"
                    placeholder="At least 8 characters"
                    className="mt-1.5"
                    {...resetForm.register("password")}
                  />
                  {resetForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-destructive">
                      {resetForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="re-cpass">Confirm New Password</Label>
                  <Input
                    id="re-cpass"
                    type="password"
                    placeholder="Re-enter your new password"
                    className="mt-1.5"
                    {...resetForm.register("confirmPassword")}
                  />
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="mt-1 text-xs text-destructive">
                      {resetForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Update Password <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="mt-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex gap-3">
                    <label
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-colors ${signUpForm.watch("role") === "customer" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      <input
                        type="radio"
                        value="customer"
                        className="sr-only"
                        {...signUpForm.register("role")}
                      />
                      Ride with Orange
                    </label>
                    <label
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-colors ${signUpForm.watch("role") === "driver" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      <input
                        type="radio"
                        value="driver"
                        className="sr-only"
                        {...signUpForm.register("role")}
                      />
                      Drive for Orange
                    </label>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="su-name">Full Name</Label>
                    <Input
                      id="su-name"
                      placeholder="Priya Sharma"
                      className="mt-1.5"
                      {...signUpForm.register("fullName")}
                    />
                    {signUpForm.formState.errors.fullName && (
                      <p className="mt-1 text-xs text-destructive">
                        {signUpForm.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="su-phone">Phone</Label>
                    <Input
                      id="su-phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      className="mt-1.5"
                      {...signUpForm.register("phone")}
                    />
                    {signUpForm.formState.errors.phone && (
                      <p className="mt-1 text-xs text-destructive">
                        {signUpForm.formState.errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mt-1.5"
                    {...signUpForm.register("email")}
                  />
                  {signUpForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-destructive">
                      {signUpForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="su-pass">Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="su-pass"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      {...signUpForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signUpForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-destructive">
                      {signUpForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Create Account <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By signing up you agree to our{" "}
                  <Link to="/terms" className="underline hover:text-foreground">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
