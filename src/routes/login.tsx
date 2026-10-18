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
    mode: z.enum(["signin", "signup", "forgot", "reset", "verify_otp"]).optional(),
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

const signUpSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    phone: z.string().min(7, "Enter a valid phone number"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
    role: z.enum(["customer", "driver"]).default("customer"),
    agreePrivacy: z.boolean().refine((val) => val === true, {
      message: "You must review and agree to the Privacy Policy to create an account",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
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
const OTP_LOCKOUT_KEY = "@orange_web_otp_lockout_time";
const OTP_ATTEMPTS_KEY = "@orange_web_otp_attempts";

function LoginPage() {
  const { redirect, mode: initialMode, email: queryEmail } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset" | "verify_otp">(initialMode ?? "signin");
  const [resetEmail, setResetEmail] = useState<string>(queryEmail || "");
  const [otpEmail, setOtpEmail] = useState<string>(queryEmail || "");
  const [otpDigits, setOtpDigits] = useState<string>("");
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpLockoutRemaining, setOtpLockoutRemaining] = useState<number>(0);
  const [showPass, setShowPass] = useState(false);
  const [showSignUpConfirmPass, setShowSignUpConfirmPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const navigate = useNavigate();

  const signInForm = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });
  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      role: "customer",
    },
  });
  const forgotForm = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });
  const resetForm = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  // Cooldown countdown timer for login attempts
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

  // OTP Lockout timer (max 4-5 attempts in 1 min)
  useEffect(() => {
    const checkOtpLockout = () => {
      try {
        const stored = localStorage.getItem(OTP_LOCKOUT_KEY);
        if (stored) {
          const diff = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
          if (diff > 0) {
            setOtpLockoutRemaining(diff);
          } else {
            setOtpLockoutRemaining(0);
            localStorage.removeItem(OTP_LOCKOUT_KEY);
          }
        } else {
          setOtpLockoutRemaining(0);
        }
      } catch {}
    };
    checkOtpLockout();
    const interval = setInterval(checkOtpLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  // 30-second Resend OTP Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

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

    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session?.user && mode === "reset")) {
        setMode("reset");
        if (session?.user?.email) {
          setResetEmail(session.user.email);
        }
        toast.info("Please enter your new password below to update it in the database.");
      } else if (event === "SIGNED_IN" && session?.user) {
        const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
        const search = typeof window !== "undefined" ? window.location.search || "" : "";
        if (hash.includes("type=signup") || search.includes("type=signup") || mode === "verify_otp") {
          toast.success("Email verified successfully! Welcome to Orange Taxi.");
          let role = session.user.user_metadata?.role;
          if (!role) {
            try {
              role = localStorage.getItem("@orange_signup_role") || "customer";
            } catch {}
          }
          const dest = redirect ?? (role === "driver" ? "/drive#join" : "/book");
          navigate({ to: dest as any });
        }
      }
    });

    fetchRecoveryEmail();

    // Check if user landed from confirmation email link
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (hash.includes("type=signup") || search.includes("type=signup")) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            toast.success("Email verified successfully! Welcome to Orange Taxi.");
            let role = session.user.user_metadata?.role;
            if (!role) {
              try {
                role = localStorage.getItem("@orange_signup_role") || "customer";
              } catch {}
            }
            const dest = redirect ?? (role === "driver" ? "/drive#join" : "/book");
            navigate({ to: dest as any });
          }
        });
      }
    }

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

      if (error.message?.toLowerCase().includes("email not confirmed")) {
        setOtpEmail(values.email.trim());
        setResendCooldown(30);
        setOtpDigits("");
        setMode("verify_otp");
        supabase.auth.resend({
          type: "signup",
          email: values.email.trim(),
        }).catch(() => {});
        toast.info("Please verify your email address. A verification code has been sent to your email.");
        setSubmitting(false);
        return;
      }

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
    try {
      localStorage.setItem("@orange_signup_role", values.role);
    } catch {}
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          phone: cleanPhone,
          role: values.role,
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
          role: values.role,
          updated_at: consentTimestamp,
        });
      } catch (e) {}

      // 2. If registering as driver, insert role in user_roles
      if (values.role === "driver") {
        try {
          await supabase.from("user_roles").upsert(
            { user_id: data.user.id, role: "driver" },
            { onConflict: "user_id,role" }
          );
        } catch (e) {}
      }
    }

    if (data.user && !data.session) {
      setOtpEmail(values.email.trim());
      setResendCooldown(30);
      setOtpDigits("");
      setMode("verify_otp");
      toast.success("We have sent a 6-digit verification code to your email! You can also click the confirmation link in the email.");
      setSubmitting(false);
      return;
    }
    toast.success("Account created! Welcome to Orange Taxi.");
    const destination = redirect ?? (values.role === "driver" ? "/drive#join" : "/book");
    navigate({ to: destination as any });
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (otpLockoutRemaining > 0) {
      toast.error(`Too many failed attempts. Please wait ${otpLockoutRemaining} second${otpLockoutRemaining === 1 ? "" : "s"}.`);
      return;
    }
    const cleanToken = otpDigits.trim();
    if (cleanToken.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }
    setSubmitting(true);
    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail.trim(),
        token: cleanToken,
        type: "signup",
      });

      if (error) {
        // Fallback: try type "email" if "signup" failed
        const retry = await supabase.auth.verifyOtp({
          email: otpEmail.trim(),
          token: cleanToken,
          type: "email",
        });
        if (!retry.error) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        try {
          const storedAttempts = localStorage.getItem(OTP_ATTEMPTS_KEY);
          let attempts = storedAttempts ? parseInt(storedAttempts, 10) : 0;
          attempts++;
          if (attempts >= 5) {
            const lockoutUntil = Date.now() + 60 * 1000;
            localStorage.setItem(OTP_LOCKOUT_KEY, lockoutUntil.toString());
            localStorage.setItem(OTP_ATTEMPTS_KEY, "0");
            setOtpLockoutRemaining(60);
            toast.error("Verification locked for 1 minute due to 5 unsuccessful attempts.");
          } else {
            localStorage.setItem(OTP_ATTEMPTS_KEY, attempts.toString());
            toast.error(`${error.message} (${5 - attempts} attempt${5 - attempts === 1 ? "" : "s"} remaining)`);
          }
        } catch {
          toast.error(error.message);
        }
        setSubmitting(false);
        return;
      }

      try {
        localStorage.removeItem(OTP_ATTEMPTS_KEY);
        localStorage.removeItem(OTP_LOCKOUT_KEY);
      } catch {}

      let signupRole = "customer";
      try {
        signupRole = localStorage.getItem("@orange_signup_role") || "customer";
      } catch {}

      toast.success("Email verified successfully! Welcome to Orange Taxi.");
      const destination = redirect ?? (signupRole === "driver" ? "/drive#join" : "/book");
      navigate({ to: destination as any });
    } catch (err: any) {
      toast.error(err.message || "Failed to verify code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || !otpEmail) return;
    setSubmitting(true);
    try {
      let { error } = await supabase.auth.resend({
        type: "signup",
        email: otpEmail.trim(),
      });
      if (error) {
        const retry = await supabase.auth.resend({
          type: "email_change",
          email: otpEmail.trim(),
        });
        if (!retry.error) error = null;
      }
      if (error) {
        if (error.status === 429 || error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("too many requests")) {
          setOtpLockoutRemaining(60);
          toast.error("Too many resend requests. Please wait 60 seconds before trying again.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      setResendCooldown(30);
      toast.success("Verification code sent to your email!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification code.");
    } finally {
      setSubmitting(false);
    }
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
            {mode !== "verify_otp" && (
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
            )}

            {mode === "verify_otp" ? (
              <div>
                <div className="text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="size-6 text-primary" />
                  </div>
                  <h3 className="mt-3 text-xl font-bold tracking-tight">Verify Your Email</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    We sent a 6-digit verification code to{" "}
                    <span className="font-semibold text-foreground">{otpEmail || "your email"}</span>. Enter the code below or click the confirmation link in your email.
                  </p>
                </div>

                {otpLockoutRemaining > 0 && (
                  <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-semibold text-destructive text-center">
                    Verification locked for 1 minute due to 5 unsuccessful attempts. Please wait {otpLockoutRemaining}s.
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
                  <div className="flex justify-center gap-2 sm:gap-3">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        id={`otp-input-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={otpDigits[index] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          const newOtp = otpDigits.split("");
                          if (val) {
                            newOtp[index] = val[val.length - 1];
                            const combined = newOtp.join("").slice(0, 6);
                            setOtpDigits(combined);
                            if (index < 5) {
                              document.getElementById(`otp-input-${index + 1}`)?.focus();
                            }
                          } else {
                            newOtp[index] = "";
                            setOtpDigits(newOtp.join(""));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
                            document.getElementById(`otp-input-${index - 1}`)?.focus();
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
                          if (pasted) {
                            setOtpDigits(pasted);
                            const nextIndex = Math.min(pasted.length, 5);
                            document.getElementById(`otp-input-${nextIndex}`)?.focus();
                          }
                        }}
                        className="size-11 sm:size-13 text-center text-xl sm:text-2xl font-bold rounded-xl border border-border bg-muted/40 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        disabled={submitting || otpLockoutRemaining > 0}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 text-center text-[11px] text-muted-foreground">
                    Tip: You can also click the <strong>Confirm your mail</strong> link directly in the email to activate your account.
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
                    <span>Didn't receive code?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || submitting}
                      onClick={handleResendOtp}
                      className="font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Code"}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={submitting || otpDigits.length !== 6 || otpLockoutRemaining > 0}
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : otpLockoutRemaining > 0 ? (
                      `Locked (${otpLockoutRemaining}s)`
                    ) : (
                      <>
                        Verify & Continue <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      ← Incorrect email? Back to Sign Up
                    </button>
                  </div>
                </form>
              </div>
            ) : mode === "signin" ? (
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
                <div className="grid grid-cols-2 gap-3 pb-1">
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${
                      signUpForm.watch("role") === "customer"
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      value="customer"
                      className="sr-only"
                      {...signUpForm.register("role")}
                    />
                    <span>Ride with Orange</span>
                  </label>

                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${
                      signUpForm.watch("role") === "driver"
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      value="driver"
                      className="sr-only"
                      {...signUpForm.register("role")}
                    />
                    <span>Drive for Orange</span>
                  </label>
                </div>

                {signUpForm.watch("role") === "driver" && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
                    🚕 <strong>Chauffeur Registration:</strong> Create your account first, then you will be redirected to complete your driver application with your driving licence.
                  </div>
                )}

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

                <div>
                  <Label htmlFor="su-cpass">Confirm Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="su-cpass"
                      type={showSignUpConfirmPass ? "text" : "password"}
                      placeholder="Re-enter your password"
                      className="pr-10"
                      {...signUpForm.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpConfirmPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSignUpConfirmPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signUpForm.formState.errors.confirmPassword && (
                    <p className="mt-1 text-xs text-destructive">
                      {signUpForm.formState.errors.confirmPassword.message}
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

          {mode !== "verify_otp" && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="font-semibold text-primary hover:underline"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}

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
