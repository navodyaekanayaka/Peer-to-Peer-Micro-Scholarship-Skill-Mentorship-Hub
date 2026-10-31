import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

function md5(value: string) {
  return createHash("md5").update(value).digest("hex").toUpperCase();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: NextRequest) {
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!merchantId || !merchantSecret) {
    return new NextResponse("Payment notification is not configured.", { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse("Invalid notification body.", { status: 400 });
  }

  const getField = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const notifiedMerchant = getField("merchant_id");
  const orderId = getField("order_id");
  const amountText = getField("payhere_amount");
  const currency = getField("payhere_currency");
  const statusCode = getField("status_code");
  const receivedSignature = getField("md5sig").toUpperCase();

  if (
    notifiedMerchant !== merchantId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) ||
    !/^\d+(?:\.\d{1,2})?$/.test(amountText) ||
    currency !== "LKR" ||
    !/^-?\d+$/.test(statusCode)
  ) {
    return new NextResponse("Invalid notification fields.", { status: 400 });
  }

  const expectedSignature = md5(
    `${merchantId}${orderId}${amountText}${currency}${statusCode}${md5(merchantSecret)}`,
  );
  if (!safeEqual(receivedSignature, expectedSignature)) {
    return new NextResponse("Invalid payment signature.", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: donation, error: donationError } = await admin
    .from("donations")
    .select("id, amount_minor, currency, status")
    .eq("id", orderId)
    .eq("provider_reference", orderId)
    .eq("payment_provider", "payhere")
    .maybeSingle();

  if (donationError) {
    return new NextResponse("Unable to load payment record.", { status: 500 });
  }
  if (!donation || donation.currency !== "LKR") {
    return new NextResponse("Payment record not found.", { status: 404 });
  }
  if (Math.round(Number(amountText) * 100) !== Number(donation.amount_minor)) {
    return new NextResponse("Payment amount does not match.", { status: 400 });
  }
  if (donation.status !== "pending") {
    return new NextResponse("OK");
  }

  const isSuccessful = statusCode === "2";
  const { error: updateError } = await admin
    .from("donations")
    .update({
      status: isSuccessful ? "confirmed" : "failed",
      confirmed_at: isSuccessful ? new Date().toISOString() : null,
    })
    .eq("id", donation.id)
    .eq("status", "pending");

  if (updateError) {
    return new NextResponse("Unable to update payment record.", { status: 500 });
  }

  return new NextResponse("OK");
}
