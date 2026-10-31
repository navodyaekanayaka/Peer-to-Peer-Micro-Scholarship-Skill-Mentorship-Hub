import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type StripeEvent = {
  type?: unknown;
  data?: {
    object?: unknown;
  };
};

function hasValidStripeSignature(rawBody: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.trim().split("=", 2));
  const timestampText = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts
    .filter(([key]) => key === "v1")
    .map(([, signature]) => signature)
    .filter((signature): signature is string => Boolean(signature));
  const timestamp = Number(timestampText);

  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Date.now() / 1000 - timestamp) > 300 ||
    signatures.length === 0
  ) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return signatures.some((signature) => {
    const received = Buffer.from(signature, "hex");
    return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!hasValidStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "checkout.session.expired"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  if (!isRecord(session) || !isRecord(session.metadata)) {
    return NextResponse.json({ error: "Invalid checkout session." }, { status: 400 });
  }

  const donationId = session.metadata.donation_id;
  if (
    typeof donationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(donationId) ||
    typeof session.id !== "string"
  ) {
    return NextResponse.json({ error: "Missing donation reference." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: donation, error: donationError } = await admin
    .from("donations")
    .select("id, amount_minor, currency, status, provider_reference")
    .eq("id", donationId)
    .eq("payment_provider", "stripe")
    .maybeSingle();

  if (donationError) {
    return NextResponse.json({ error: "Unable to load donation." }, { status: 500 });
  }
  if (!donation) {
    return NextResponse.json({ error: "Donation not found." }, { status: 404 });
  }

  if (event.type === "checkout.session.expired") {
    if (donation.status === "pending") {
      const { error } = await admin
        .from("donations")
        .update({ status: "failed" })
        .eq("id", donation.id)
        .eq("status", "pending");
      if (error) {
        return NextResponse.json({ error: "Unable to update donation." }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (
    session.payment_status !== "paid" ||
    typeof session.currency !== "string" ||
    session.currency.toUpperCase() !== donation.currency ||
    session.amount_total !== Number(donation.amount_minor) ||
    (donation.provider_reference !== null && donation.provider_reference !== session.id)
  ) {
    return NextResponse.json({ error: "Checkout details do not match donation." }, { status: 400 });
  }

  if (donation.status === "pending") {
    const { error: updateError } = await admin
      .from("donations")
      .update({
        status: "confirmed",
        provider_reference: session.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", donation.id)
      .eq("status", "pending");

    if (updateError) {
      return NextResponse.json({ error: "Unable to confirm donation." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
