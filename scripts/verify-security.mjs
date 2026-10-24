import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=== ORANGE TAXI SECURITY & PRIVACY VERIFICATION SUITE ===");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// 1. Verify Privacy Policy page content
test("Phase 1: Privacy Policy contains DPDP Act, retention, and Grievance Officer details", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/routes/privacy.tsx"), "utf-8");
  assert(content.includes("DPDP Act, 2023"), "Missing DPDP Act mention");
  assert(content.includes("72 months"), "Missing GST 72 months statutory retention");
  assert(content.includes("Grievance"), "Missing Grievance Officer details");
  assert(content.includes("privacy@orange-taxi.com"), "Missing official DPO email");
  assert(content.includes("Razorpay"), "Missing payment processor disclosure");
  assert(content.includes("Supabase"), "Missing database processor disclosure");
});

// 2. Verify Signup consent requirement
test("Phase 1: Customer signup enforces explicit privacy agreement", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/routes/login.tsx"), "utf-8");
  assert(content.includes("agreePrivacy"), "Missing agreePrivacy field in login");
  assert(content.includes("consent_privacy_policy_at"), "Missing consent timestamp recording");
  assert(content.includes("consent_version"), "Missing consent version recording");
  assert(content.includes("/privacy"), "Missing Link to /privacy");
  assert(
    !content.includes("role: values.role"),
    "Still allows self-assigning role in signup options",
  );
});

// 3. Verify Driver application consent requirement
test("Phase 1: Driver application enforces explicit DPDP Act consent", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/routes/drive.tsx"), "utf-8");
  assert(content.includes("agree_privacy"), "Missing agree_privacy validation in drive.tsx");
  assert(content.includes("/privacy"), "Missing active Link to /privacy in drive.tsx");
});

// 4. Verify Server Endpoint Security & Header hardening
test("Phase 2: /api/send-invoice requires authentication and lacks hardcoded secrets", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/server.ts"), "utf-8");
  assert(
    !content.includes("re_hCxoXrPr_5cMJpV6fD1WQmKcDE6mDgE6Y"),
    "Hardcoded Resend key still present in server.ts!",
  );
  assert(content.includes("Bearer "), "Missing Bearer auth check in handleSendInvoiceApi");
  assert(content.includes("X-Frame-Options"), "Missing X-Frame-Options header");
  assert(content.includes("X-Content-Type-Options"), "Missing X-Content-Type-Options header");
  assert(content.includes("Strict-Transport-Security"), "Missing HSTS header");
  assert(content.includes("Referrer-Policy"), "Missing Referrer-Policy header");
  assert(content.includes("Permissions-Policy"), "Missing Permissions-Policy header");
});

// 5. Verify Stored XSS Protection in Admin Dashboard
test("Phase 2: Admin Dashboard sanitizes driver document URLs", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/routes/admin.tsx"), "utf-8");
  assert(
    content.includes("sanitizeDocumentUrl"),
    "Missing sanitizeDocumentUrl function in admin.tsx",
  );
  assert(content.includes("safePhoto"), "Missing safePhoto check in admin.tsx");
  assert(content.includes("safeDl"), "Missing safeDl check in admin.tsx");
});

// 6. Verify Account Deletion Workflow & UI
test("Phase 3: Profile dashboard provides verified self-service Delete Account option", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/routes/profile.tsx"), "utf-8");
  assert(content.includes("delete_user_account"), "Missing RPC call to delete_user_account");
  assert(content.includes("DELETE"), "Missing explicit DELETE confirmation requirement");
  assert(content.includes("localStorage.clear()"), "Missing local cache revocation on delete");
  assert(content.includes("signOut"), "Missing session revocation on delete");
});

// 7. Verify Database Security Migration
test("Phases 2 & 3: Database migration includes comprehensive security & deletion primitives", () => {
  const content = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261015_mandatory_privacy_and_security.sql"),
    "utf-8",
  );
  assert(
    content.includes("CREATE TABLE IF NOT EXISTS public.security_audit_logs"),
    "Missing security_audit_logs table",
  );
  assert(
    content.includes("CREATE TABLE IF NOT EXISTS public.user_consents"),
    "Missing user_consents table",
  );
  assert(
    content.includes("check_booking_update_integrity"),
    "Missing check_booking_update_integrity trigger",
  );
  assert(content.includes("get_public_tracking_status"), "Missing get_public_tracking_status RPC");
  assert(content.includes("delete_user_account"), "Missing delete_user_account RPC");
  assert(
    content.includes("UPDATE storage.buckets SET public = false WHERE id = 'driver_kyc'"),
    "Missing driver_kyc bucket lockdown",
  );
  assert(
    content.includes('DROP POLICY IF EXISTS "Anon Insert" ON storage.objects'),
    "Missing Anon Insert drop",
  );
  assert(
    content.includes('DROP POLICY IF EXISTS "Public Access" ON storage.objects'),
    "Missing Public Access drop",
  );
});

// 8. Verify Incident Response Plan
test("Phase 4: Incident Response documentation and CERT-In/DPBI templates exist", () => {
  const content = fs.readFileSync(path.join(rootDir, "INCIDENT_RESPONSE.md"), "utf-8");
  assert(content.includes("CERT-In"), "Missing CERT-In instructions");
  assert(content.includes("6 hours"), "Missing 6-hour reporting window");
  assert(content.includes("Data Protection Board of India"), "Missing DPBI instructions");
  assert(content.includes("Template A"), "Missing Regulatory Notification Template");
  assert(content.includes("Template B"), "Missing User Breach Notification Template");
  assert(content.includes("security_audit_logs"), "Missing log query recipes");
});

// 9. Verify Authoritative Fleet & Pricing Sync in Migration
test("Production Readiness: Vehicle categories & booking insert validation trigger configured", () => {
  const content = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261015_mandatory_privacy_and_security.sql"),
    "utf-8",
  );
  assert(content.includes("signature"), "Missing signature fleet code in migration");
  assert(content.includes("Mahindra BE 6 EV"), "Missing Mahindra BE 6 EV in migration");
  assert(
    content.includes("check_booking_insert_integrity"),
    "Missing check_booking_insert_integrity function",
  );
  assert(
    content.includes("trg_booking_insert_integrity"),
    "Missing trg_booking_insert_integrity trigger",
  );
  assert(
    content.includes("CREATE TABLE IF NOT EXISTS public.support_tickets"),
    "Missing support_tickets table definition",
  );
});

// 10. Verify Support Ticket Persistence
test("Production Readiness: Support & Grievance form persists dockets to database", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/routes/support.tsx"), "utf-8");
  assert(
    content.includes('supabase.from("support_tickets").insert'),
    "Missing support_tickets insert in support.tsx",
  );
  assert(content.includes("docketNumber"), "Missing dynamic docketNumber state");
  assert(content.includes("submitting"), "Missing submitting state / button disabling");
});

// 11. Verify Server-Side Payment Verification Endpoints
test("Production Readiness: Server provides Razorpay order creation & signature verification", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/server.ts"), "utf-8");
  assert(
    content.includes("/api/create-razorpay-order"),
    "Missing /api/create-razorpay-order endpoint",
  );
  assert(
    content.includes("/api/verify-razorpay-payment"),
    "Missing /api/verify-razorpay-payment endpoint",
  );
  assert(content.includes("verifyHmacSha256"), "Missing verifyHmacSha256 cryptographic function");
});

// 12. Verify Client Booking Payment Security
test("Production Readiness: Client checks server order and verifies signature before booking creation", () => {
  const content = fs.readFileSync(path.join(rootDir, "src/routes/book.tsx"), "utf-8");
  assert(content.includes("/api/create-razorpay-order"), "book.tsx does not request server order");
  assert(
    content.includes("/api/verify-razorpay-payment"),
    "book.tsx does not verify payment signature",
  );
  assert(
    content.includes("payment_intent_id: transactionId || null"),
    "book.tsx does not record payment_intent_id",
  );
});

// 13. Verify Finding 2.2: claim_first_admin revoked and removed from UI
test("Finding 2.2: claim_first_admin revoked from authenticated and eliminated from client", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261015_mandatory_privacy_and_security.sql"),
    "utf-8",
  );
  assert(
    migration.includes(
      "REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon, authenticated",
    ),
    "claim_first_admin not revoked in migration",
  );
  const loginCode = fs.readFileSync(path.join(rootDir, "src/routes/login.tsx"), "utf-8");
  assert(
    !loginCode.includes("claim_first_admin"),
    "claim_first_admin still referenced in login.tsx",
  );
});

// 14. Verify Finding 3.2: has_role secured with search_path and execution granted
test("Finding 3.2: has_role permissions and security definer definition secured", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261015_mandatory_privacy_and_security.sql"),
    "utf-8",
  );
  assert(
    migration.includes(
      "GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated",
    ),
    "has_role grant missing",
  );
  assert(migration.includes("SET search_path = public"), "search_path missing on has_role");
});

// 15. Verify Findings 4.1 & 6.3: Server-side OTP verification
test("Findings 4.1 & 6.3: Server-side OTP verification RPC configured and invoked by driver console", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261015_mandatory_privacy_and_security.sql"),
    "utf-8",
  );
  assert(
    migration.includes("CREATE OR REPLACE FUNCTION public.verify_ride_otp"),
    "verify_ride_otp RPC missing in migration",
  );
  const driverConsole = fs.readFileSync(
    path.join(rootDir, "src/routes/driver-console.tsx"),
    "utf-8",
  );
  assert(
    driverConsole.includes('supabase.rpc("verify_ride_otp"'),
    "driver-console.tsx does not invoke verify_ride_otp RPC",
  );
  assert(
    !driverConsole.includes("enteredOtp !== booking.ride_otp"),
    "driver-console.tsx still checks OTP client-side",
  );
});

// 16. Verify Finding 4.2: Realtime ride chat authentication & authorization
test("Finding 4.2: Ride chat enforces authentication and ride ownership verification", () => {
  const chatCode = fs.readFileSync(
    path.join(rootDir, "src/components/ride-chat-sheet.tsx"),
    "utf-8",
  );
  assert(
    chatCode.includes("supabase.auth.getSession()"),
    "ride-chat-sheet does not verify session",
  );
  assert(
    chatCode.includes('.from("bookings")') && chatCode.includes("customer_id, driver_id"),
    "ride-chat-sheet does not verify ride authorization",
  );
});

// 17. Verify Finding 1.2: Client-side role hydration security
test("Finding 1.2: use-auth does not trust unverified localStorage role or hardcoded email", () => {
  const authCode = fs.readFileSync(path.join(rootDir, "src/hooks/use-auth.ts"), "utf-8");
  assert(!authCode.includes("orangeetaxi@gmail.com"), "use-auth still has hardcoded admin email");
  assert(
    !authCode.includes("globalRole = parsed.role"),
    "use-auth still trusts unverified localStorage role",
  );
});

// 18. Verify Finding 10.1: Content-Security-Policy and HTTP security headers
test("Finding 10.1: Content-Security-Policy and HTTP headers applied in server", () => {
  const serverCode = fs.readFileSync(path.join(rootDir, "src/server.ts"), "utf-8");
  assert(
    serverCode.includes("Content-Security-Policy"),
    "Missing Content-Security-Policy in server.ts",
  );
  assert(serverCode.includes("Strict-Transport-Security"), "Missing HSTS in server.ts");
});

// 19. Verify Findings 9.1 & 9.2: KYC Storage & Base64 document optimization
test("Findings 9.1 & 9.2: KYC storage policy restricted and drive form uses storage URLs", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261015_mandatory_privacy_and_security.sql"),
    "utf-8",
  );
  assert(
    migration.includes("storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')"),
    "Missing KYC storage MIME check",
  );
  const driveCode = fs.readFileSync(path.join(rootDir, "src/routes/drive.tsx"), "utf-8");
  assert(
    driveCode.includes('.from("driver_kyc")') && driveCode.includes('.upload('),
    "drive.tsx does not upload to driver_kyc storage",
  );
});

// 20. Verify VULN-RLS-01: Financial & Vehicle Table Lockdown
test("VULN-RLS-01: partner_vehicles, driver_cash_settlements, and driver_commission_settlements RLS secured", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("driver_comm_select_scoped"),
    "Missing scoped select policy for driver_commission_settlements",
  );
  assert(
    migration.includes("driver_cash_select_scoped"),
    "Missing scoped select policy for driver_cash_settlements",
  );
  assert(
    migration.includes("partner_vehicles_select_scoped"),
    "Missing scoped select policy for partner_vehicles",
  );
  assert(
    migration.includes('DROP POLICY IF EXISTS "Allow public manage on partner_vehicles"'),
    "Permissive partner_vehicles policy not dropped",
  );
  assert(
    migration.includes('DROP POLICY IF EXISTS "Allow all on driver_cash_settlements"'),
    "Permissive driver_cash_settlements policy not dropped",
  );
});

// 21. Verify VULN-FIN-01: Wallet ledger and balance tampering prevention
test("VULN-FIN-01: Direct wallet tampering forbidden and atomic RPCs configured", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("check_profile_wallet_tampering"),
    "Missing check_profile_wallet_tampering function",
  );
  assert(
    migration.includes("trg_prevent_direct_wallet_balance_update"),
    "Missing trg_prevent_direct_wallet_balance_update trigger",
  );
  assert(migration.includes("top_up_wallet"), "Missing top_up_wallet RPC");
  assert(
    migration.includes("deduct_ride_wallet_payment"),
    "Missing deduct_ride_wallet_payment RPC",
  );
  assert(migration.includes("wallet_transactions"), "Missing wallet_transactions table");
});

// 22. Verify VULN-RIDE-01: Atomic ride dispatch and concurrency lock
test("VULN-RIDE-01: accept_booking RPC enforces active driver verification & atomic row lock", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("CREATE OR REPLACE FUNCTION public.accept_booking"),
    "Missing accept_booking RPC",
  );
  assert(
    migration.includes("status = 'searching'"),
    "Missing searching status check in accept_booking",
  );
  assert(migration.includes("driver_id IS NULL"), "Missing unassigned check in accept_booking");
});

// 23. Verify VULN-DRV-01: Driver self-promotion and attribute tampering prevention
test("VULN-DRV-01: Driver attributes locked against tampering and application auto-approval prevented", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("check_driver_update_integrity"),
    "Missing check_driver_update_integrity trigger",
  );
  assert(
    migration.includes("check_driver_application_insert_integrity"),
    "Missing check_driver_application_insert_integrity trigger",
  );
  assert(
    migration.includes('DROP POLICY IF EXISTS "admin manages drivers"'),
    "Permissive driver insert policy not dropped",
  );
});

// 24. Verify VULN-PRIV-01: Driver fleet privacy scoping
test("VULN-PRIV-01: Drivers table scoped to authenticated authorized users", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(migration.includes("drivers_select_scoped"), "Missing drivers_select_scoped policy");
  assert(
    migration.includes('DROP POLICY IF EXISTS "drivers readable by signed in"'),
    "Permissive drivers select policy not dropped",
  );
});

// 25. Verify VULN-AUTH-01: Rider app Supabase client handles new API keys
test("VULN-AUTH-01: Rider app custom fetch wrapper strips invalid Bearer tokens for sb_publishable keys", () => {
  const riderSupabase = fs.readFileSync(
    path.join(rootDir, "../orange-taxi-rider/src/lib/supabase.ts"),
    "utf-8",
  );
  assert(
    riderSupabase.includes("isNewSupabaseApiKey"),
    "Missing isNewSupabaseApiKey helper in rider app",
  );
  assert(
    riderSupabase.includes("delete headerObj['Authorization']"),
    "Missing Bearer token cleanup in rider app",
  );
});

// 26. Verify VULN-OTP-01: Driver App enforces cryptographic server-side OTP verification
test("VULN-OTP-01: Driver App ActiveRideSheet requires verify_ride_otp RPC and lacks local bypass", () => {
  const activeRideSheet = fs.readFileSync(
    path.join(rootDir, "../orange-taxi-driver/src/components/ActiveRideSheet.tsx"),
    "utf-8",
  );
  assert(
    activeRideSheet.includes("supabase.rpc('verify_ride_otp'"),
    "ActiveRideSheet does not call verify_ride_otp RPC",
  );
  assert(
    !activeRideSheet.includes("cleanOtp === expected"),
    "ActiveRideSheet contains insecure local OTP comparison",
  );
  assert(
    !activeRideSheet.includes("booking.ride_otp"),
    "ActiveRideSheet references plaintext booking.ride_otp",
  );
});

// 27. Verify VULN-FIN-01 Client: Rider App eliminates direct profile wallet updates
test("VULN-FIN-01 Client: Rider App ProfileModal and WalletModal invoke RPC without direct profile balance update fallback", () => {
  const profileModal = fs.readFileSync(
    path.join(rootDir, "../orange-taxi-rider/src/components/ProfileModal.tsx"),
    "utf-8",
  );
  const walletModal = fs.readFileSync(
    path.join(rootDir, "../orange-taxi-rider/src/components/WalletModal.tsx"),
    "utf-8",
  );
  assert(
    !profileModal.includes(".update({ wallet_balance"),
    "ProfileModal still directly modifies wallet_balance",
  );
  assert(
    !walletModal.includes(".update({ wallet_balance"),
    "WalletModal still directly modifies wallet_balance",
  );
  assert(profileModal.includes("top_up_wallet"), "ProfileModal does not invoke top_up_wallet RPC");
  assert(walletModal.includes("top_up_wallet"), "WalletModal does not invoke top_up_wallet RPC");
});

// 28. Verify VULN-PAY-01: Database trigger blocks unverified ride status transitions
test("VULN-PAY-01 Trigger: check_booking_update_integrity requires app.otp_verified session guard for in_progress", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("current_setting('app.otp_verified', true)"),
    "Trigger does not check app.otp_verified session setting",
  );
  assert(
    migration.includes("trg_bookings_integrity_guard"),
    "Missing trg_bookings_integrity_guard trigger attachment",
  );
});

// 29. Verify VULN-OTP-02 Database: verify_ride_otp RPC manages app.otp_verified session configuration
test("VULN-OTP-02 Database: verify_ride_otp RPC sets app.otp_verified session guard during state transition", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("set_config('app.otp_verified', 'on', true)"),
    "verify_ride_otp does not set app.otp_verified guard",
  );
  assert(
    migration.includes("set_config('app.otp_verified', 'off', true)"),
    "verify_ride_otp does not reset app.otp_verified guard",
  );
});

// 30. Verify VULN-KYC-01: Admin dashboard resolves private storage signed URLs
test("VULN-KYC-01: Admin dashboard creates signed URLs for driver_kyc storage objects", () => {
  const adminCode = fs.readFileSync(path.join(rootDir, "src/routes/admin.tsx"), "utf-8");
  assert(adminCode.includes("resolveKycDocumentUrl"), "Missing resolveKycDocumentUrl in admin.tsx");
  assert(adminCode.includes("createSignedUrl"), "Missing createSignedUrl in admin.tsx");
  assert(adminCode.includes("<KycDocPreview"), "admin.tsx does not use KycDocPreview component");
});

// 31. Verify VULN-PAY-02: Cryptographic Razorpay payment verification
test("VULN-PAY-02 Server & Client: Razorpay verification enforces cryptographic HMAC signature and rejects unverified fallback", () => {
  const serverCode = fs.readFileSync(path.join(rootDir, "src/server.ts"), "utf-8");
  assert(
    serverCode.includes("RAZORPAY_KEY_SECRET is not configured on the server"),
    "server.ts permits unverified payments when secret is missing",
  );
  assert(
    serverCode.includes("verifyHmacSha256(payload, keySecret, razorpay_signature)"),
    "server.ts does not verify HMAC SHA-256 signature",
  );
  assert(
    !serverCode.includes("test_mode: isTestKey"),
    "server.ts still returns test_mode unverified bypass",
  );

  const bookCode = fs.readFileSync(path.join(rootDir, "src/routes/book.tsx"), "utf-8");
  assert(
    bookCode.includes("verifyData.error ||") ||
      bookCode.includes("Payment verification failed. Please contact customer care."),
    "book.tsx does not check verifyData.error",
  );
});

// 32. Verify VULN-PAY-03: Hardened booking insert integrity trigger
test("VULN-PAY-03 Insert Trigger: check_booking_insert_integrity enforces pending payment status and initial booking state", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("NEW.payment_status := 'pending'"),
    "Trigger does not force initial payment_status to pending",
  );
  assert(
    migration.includes("NEW.driver_id := NULL"),
    "Trigger does not clear pre-assigned driver_id upon client insert",
  );
  assert(
    migration.includes("NEW.final_fare := NULL"),
    "Trigger does not clear final_fare upon client insert",
  );
  assert(
    migration.includes("trg_booking_insert_integrity"),
    "Missing trg_booking_insert_integrity trigger attachment",
  );
});

// 33. Verify VULN-FIN-02: Wallet top-up requires server-verified settlement
test("VULN-FIN-02 Database: top_up_wallet enforces server-verified settlement guard", () => {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/20261022_comprehensive_security_remediation.sql"),
    "utf-8",
  );
  assert(
    migration.includes("app.verified_payment"),
    "top_up_wallet does not enforce app.verified_payment guard",
  );
  assert(
    migration.includes("has_role(_uid, 'admin')") ||
      migration.includes("has_role(auth.uid(), 'admin')"),
    "top_up_wallet lacks admin check",
  );
});

// 34. Verify VULN-FIN-03: Rider and Driver Apps correctly initialize and settle wallet fare
test("VULN-FIN-03 Rider & Driver Apps: Ride booking initializes payment_status as pending and settles wallet fare via deduct_ride_wallet_payment RPC", () => {
  const rideContext = fs.readFileSync(
    path.join(rootDir, "../orange-taxi-rider/src/context/RideContext.tsx"),
    "utf-8",
  );
  assert(
    !rideContext.includes("payment_status: paymentMethod === 'wallet' ? 'paid' : 'pending'"),
    "RideContext still marks wallet bookings as paid upon insertion",
  );

  const activeRideSheet = fs.readFileSync(
    path.join(rootDir, "../orange-taxi-driver/src/components/ActiveRideSheet.tsx"),
    "utf-8",
  );
  assert(
    !activeRideSheet.includes("payment_method === 'wallet' ? true : false") &&
      !activeRideSheet.includes("payment_method === 'wallet'\n              ? true"),
    "ActiveRideSheet still marks wallet bookings as pre-paid without settlement",
  );

  const driverApp = fs.readFileSync(path.join(rootDir, "../orange-taxi-driver/App.tsx"), "utf-8");
  assert(
    driverApp.includes("deduct_ride_wallet_payment"),
    "driver App.tsx does not invoke deduct_ride_wallet_payment RPC",
  );
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
