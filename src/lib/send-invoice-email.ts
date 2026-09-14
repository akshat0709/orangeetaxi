// @ts-nocheck
import { CompanyGSTProfile, DEFAULT_COMPANY_PROFILE } from "./gst-utils";

export interface SendInvoicePayload {
  to: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  pickupArea: string;
  dropArea: string;
  completedAt: string;
  vehicleName: string;
  vehiclePlate?: string;
  paymentMethod?: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalFare: number;
  distanceKm?: number;
  durationMinutes?: number;
  corporateName?: string;
  corporateGstin?: string;
  profile?: CompanyGSTProfile;
}

export function generateInvoiceHtml(p: SendInvoicePayload): string {
  const profile = p.profile || DEFAULT_COMPANY_PROFILE;
  const isCorporate = Boolean(p.corporateName && p.corporateGstin);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GST Tax Invoice - ${p.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f9fa; color: #1a1a1a; margin: 0; padding: 24px 12px; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #eaeaea; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 28px 24px; text-align: left; }
    .badge { background: #f97316; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: inline-block; }
    .title { font-size: 22px; font-weight: 800; margin: 12px 0 4px 0; letter-spacing: -0.5px; }
    .subtitle { color: #94a3b8; font-size: 12px; margin: 0; }
    .content { padding: 24px; }
    .meta-grid { width: 100%; margin-bottom: 24px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 16px; }
    .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
    .val { font-size: 13px; font-weight: 600; color: #0f172a; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .route { font-size: 14px; font-weight: 600; line-height: 1.6; color: #1e293b; }
    .fare-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .fare-table th { text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .fare-table td { padding: 10px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .total-row td { font-size: 16px; font-weight: 800; color: #f97316; border-top: 2px solid #0f172a; border-bottom: none; padding-top: 14px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; font-size: 11px; color: #64748b; line-height: 1.5; }
    .footer strong { color: #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div><span class="badge">ORANGE TAXI</span></div>
      <h1 class="title">GST Tax Invoice</h1>
      <p class="subtitle">Tax Invoice issued under Rule 46 of CGST Rules, 2017</p>
    </div>

    <div class="content">
      <table class="meta-grid">
        <tr>
          <td style="width: 50%; vertical-align: top;">
            <div class="label">Invoice Number</div>
            <div class="val" style="color: #f97316;">${p.invoiceNumber}</div>
            <div class="label" style="margin-top: 8px;">Date & Time</div>
            <div class="val">${p.completedAt}</div>
          </td>
          <td style="width: 50%; vertical-align: top;">
            <div class="label">Billed To</div>
            <div class="val">${isCorporate ? p.corporateName : (p.customerName || "Passenger")}</div>
            ${isCorporate ? `<div class="val" style="font-size: 11px; color: #64748b;">GSTIN: ${p.corporateGstin}</div>` : ""}
            <div class="val" style="font-size: 11px; color: #64748b;">${p.to}</div>
            ${p.customerPhone ? `<div class="val" style="font-size: 11px; color: #64748b;">Phone: ${p.customerPhone}</div>` : ""}
          </td>
        </tr>
      </table>

      <div class="card">
        <div class="label">Trip Route & Vehicle</div>
        <div class="route">
          🟢 <strong>Pickup:</strong> ${p.pickupArea}<br>
          🔴 <strong>Drop:</strong> ${p.dropArea}
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #475569;">
          <strong>Vehicle:</strong> ${p.vehicleName} ${p.vehiclePlate ? `· Plate: <strong>${p.vehiclePlate}</strong>` : ""}<br>
          ${p.distanceKm ? `Distance: <strong>${p.distanceKm} km</strong> · ` : ""}
          ${p.durationMinutes ? `Duration: <strong>${p.durationMinutes} mins</strong> · ` : ""}
          Payment: <strong>${(p.paymentMethod || "CASH").toUpperCase()}</strong>
        </div>
      </div>

      <table class="fare-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>SAC Code</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Passenger Electric Taxi Service</td>
            <td>${profile.sacCode}</td>
            <td style="text-align: right;">₹${p.subtotal.toFixed(2)}</td>
          </tr>
          ${p.cgst > 0 ? `
          <tr>
            <td>Central GST (CGST @ 2.5%)</td>
            <td>${profile.sacCode}</td>
            <td style="text-align: right;">₹${p.cgst.toFixed(2)}</td>
          </tr>
          <tr>
            <td>State GST (SGST @ 2.5%)</td>
            <td>${profile.sacCode}</td>
            <td style="text-align: right;">₹${p.sgst.toFixed(2)}</td>
          </tr>
          ` : `
          <tr>
            <td>Integrated GST (IGST @ 5.0%)</td>
            <td>${profile.sacCode}</td>
            <td style="text-align: right;">₹${p.igst.toFixed(2)}</td>
          </tr>
          `}
          <tr class="total-row">
            <td colspan="2">Total Paid (Inclusive of Taxes)</td>
            <td style="text-align: right;">₹${p.totalFare.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>
        <strong>${profile.legalName}</strong><br>
        GSTIN: <strong>${profile.gstin}</strong> · PAN: <strong>${profile.pan}</strong> · CIN: <strong>${profile.cin}</strong><br>
        Registered Office: ${profile.address}
      </p>
      <p style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        For queries or corporate invoicing support, email <strong>${profile.supportEmail}</strong> or call <strong>${profile.supportPhone}</strong>.
      </p>
    </div>
  </div>
</body>
</html>`;
}
