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
    email: z.string().optional(),
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
  agreePrivacy: z.boolean().refine((val) => val === true, {
    message: "You must review and agree to the Privacy Policy to create an account",
  }),
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
  const { redirect, mode: initialMode, email: queryEmail } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(initialMode ?? "signin");
  const [resetEmail, setResetEmail] = useState<string>(queryEmail || "");
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

  // Detect recovery link tokens from email & resolve verified user email
  useEffect(() => {
    // 1. Initial check from query param or localStorage
    if (queryEmail) {
      setResetEmail(queryEmail);
    } else {
      try {
        const stored = localStorage.getItem("@orange_reset_email");
        if (stored) setResetEmail(stored);
      } catch {}
    }

    // 2. Fetch authenticated user email from recovery session
    const fetchRecoveryEmail = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setResetEmail(user.email);
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setResetEmail(session.user.email);
          return;
        }
      } catch {}
    };

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
        fetchRecoveryEmail();
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const e = params.get("email");
        if (e) setResetEmail(decodeURIComponent(e));
      } catch {}
    }

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session?.user && mode === "reset")) {
        setMode("reset");
        if (session?.user?.email) {
          setResetEmail(session.user.email);
        }
        toast.info("Please enter your new password below to update it in the database.");
      }
    });

    fetchRecoveryEmail();

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, [mode, queryEmail]);

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
      // Record failed sign in attempt in security audit trail
      try {
        await supabase.from("security_audit_logs").insert({
          event_type: "auth.login_failed",
          severity: "low",
          metadata: { email: values.email.toLowerCase(), reason: error.message },
        });
      } catch {}

      if (error.status === 429 || error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("too many requests")) {
        setLockoutRemaining(60);
        toast.error("Too many login attempts from this network. Please wait 60 seconds before trying again.");
        setSubmitting(false);
        return;
      }

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
    const consentTimestamp = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          phone: cleanPhone,
          role: "customer",
          consent_privacy_policy_at: consentTimestamp,
          consent_version: "2.4",
        },
      },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    if (data.user) {
      // 1. Immediately save verified profile details with consent metadata
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: values.fullName,
          phone: cleanPhone,
          updated_at: consentTimestamp,
        });
      } catch (e) {}
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
      const emailTrimmed = values.email.trim();
      try {
        localStorage.setItem("@orange_reset_email", emailTrimmed);
      } catch {}
      setResetEmail(emailTrimmed);

      const redirectUrl =
        typeof window !== "undefined" && window.location.origin.includes("orange-taxi.com")
          ? `${window.location.origin}/login?mode=reset&email=${encodeURIComponent(emailTrimmed)}`
          : `https://orange-taxi.com/login?mode=reset&email=${encodeURIComponent(emailTrimmed)}`;

      const { error } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
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
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  By signing in, you agree to Orange Taxi&apos;s{" "}
                  <Link to="/privacy" target="_blank" className="font-semibold text-primary underline hover:text-primary/80">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link to="/terms" target="_blank" className="font-semibold text-primary underline hover:text-primary/80">
                    Terms of Service
                  </Link>.
                </p>
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

                {/* Non-editable Account Email field */}
                <div>
                  <Label htmlFor="re-email">Account Email</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="re-email"
                      type="email"
                      value={resetEmail || "Account Email"}
                      readOnly
                      disabled
                      tabIndex={-1}
                      className="bg-muted/70 cursor-not-allowed select-none text-foreground font-semibold border-border opacity-95 pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                      <ShieldCheck className="size-4 text-emerald-500" />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                    Verified account email (non-editable for security).
                  </p>
                </div>

                <div>
                  <Label htmlFor="re-pass">New Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="re-pass"
                      type={showPass ? "text" : "password"}
                      placeholder="At least 8 characters"
                      className="pr-10"
                      {...resetForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {resetForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-destructive">
                      {resetForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="re-cpass">Confirm New Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="re-cpass"
                      type={showPass ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      className="pr-10"
                      {...resetForm.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
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
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Looking to drive for Orange?</span>
                  <Link to="/drive" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                    Apply on Driver Portal &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                {/* Explicit DPDP Act Consent Checkbox */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                    <input
                      id="su-agree"
                      type="checkbox"
                      className="size-4 mt-0.5 rounded border-border accent-primary shrink-0 cursor-pointer"
                      {...signUpForm.register("agreePrivacy")}
                    />
                    <Label htmlFor="su-agree" className="text-xs font-normal leading-relaxed cursor-pointer text-muted-foreground">
                      I have read and consent to the{" "}
                      <Link to="/privacy" target="_blank" className="font-semibold text-primary underline hover:text-primary/80">
                        Privacy Policy & Data Notice
                      </Link>{" "}
                      and{" "}
                      <Link to="/terms" target="_blank" className="font-semibold text-primary underline hover:text-primary/80">
                        Terms of Service
                      </Link>
                      , including trip telemetry and safety processing under the DPDP Act, 2023.
                    </Label>
                  </div>
                  {signUpForm.formState.errors.agreePrivacy && (
                    <p className="text-xs text-destructive">
                      {signUpForm.formState.errors.agreePrivacy.message}
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

          <div className="mt-8 pt-4 border-t border-border/60 text-center text-xs text-muted-foreground flex items-center justify-center gap-3">
            <Link to="/privacy" target="_blank" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" target="_blank" className="hover:text-foreground underline">
              Terms of Service
            </Link>
            <span>•</span>
            <Link to="/support" target="_blank" className="hover:text-foreground underline">
              Support & Grievances
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
