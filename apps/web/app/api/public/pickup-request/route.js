import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const requiredFields = [
  "fullName",
  "phone",
  "email",
  "pickupAddress",
  "deliveryAddress",
  "packageDetails",
];

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const missingField = requiredFields.find(
      (field) => !payload?.[field]?.toString().trim(),
    );

    if (missingField) {
      return NextResponse.json(
        { error: `Missing required field: ${missingField}` },
        { status: 400 },
      );
    }

    const smtpUser = process.env.PICKUP_EMAIL_SMTP_USER;
    const smtpPass = process.env.PICKUP_EMAIL_SMTP_PASS;
    const recipientEmail =
      process.env.PICKUP_EMAIL_RECIPIENT || "eco.villaraza@gmail.com";

    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: "Email service is not configured on the server." },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.PICKUP_EMAIL_SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.PICKUP_EMAIL_SMTP_PORT || "465"),
      secure: process.env.PICKUP_EMAIL_SMTP_SECURE !== "false",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from:
        process.env.PICKUP_EMAIL_FROM ||
        `Atlas Pickup Request <${smtpUser}>`,
      to: recipientEmail,
      replyTo: payload.email,
      subject: `New Pickup Request - ${payload.fullName}`,
      text: [
        "A new pickup request was submitted from the landing page.",
        "",
        `Full Name: ${payload.fullName}`,
        `Phone: ${payload.phone}`,
        `Email: ${payload.email}`,
        `Pickup Address: ${payload.pickupAddress}`,
        `Delivery Address: ${payload.deliveryAddress}`,
        `Package Details: ${payload.packageDetails}`,
      ].join("\n"),
      html: `
        <h2>New Pickup Request</h2>
        <p>A new pickup request was submitted from the landing page.</p>
        <ul>
          <li><strong>Full Name:</strong> ${escapeHtml(payload.fullName)}</li>
          <li><strong>Phone:</strong> ${escapeHtml(payload.phone)}</li>
          <li><strong>Email:</strong> ${escapeHtml(payload.email)}</li>
          <li><strong>Pickup Address:</strong> ${escapeHtml(payload.pickupAddress)}</li>
          <li><strong>Delivery Address:</strong> ${escapeHtml(payload.deliveryAddress)}</li>
          <li><strong>Package Details:</strong> ${escapeHtml(payload.packageDetails)}</li>
        </ul>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pickup request email error:", error);
    return NextResponse.json(
      { error: "Failed to send pickup request." },
      { status: 500 },
    );
  }
}
