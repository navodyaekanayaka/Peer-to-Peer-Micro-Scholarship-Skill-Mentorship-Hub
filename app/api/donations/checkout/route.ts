import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const supportedCurrencies = ["LKR", "USD", "GBP", "AUD"] as const;
type SupportedCurrency = (typeof supportedCurrencies)[number];
type PaymentProvider = "payhere" | "stripe";

type CheckoutPayload = {
  requestId?: unknown;
  amount?: unknown;
  currency?: unknown;
  provider?: unknown;
  phone?: unknown;
  address?: unknown;
  city?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const minor = Math.round(value * 100);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL environment variable.");
  }

  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }

  return url.origin;
}

async function getLkrEquivalent(amountMinor: number, currency: SupportedCurrency) {
  if (currency === "LKR") {
    return Math.round(amountMinor / 100);
  }

  const response = await fetch("https://open.er-api.com/v6/latest/LKR", {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error("Unable to retrieve a current exchange rate. Try again shortly.");
  }

  const exchangeData: unknown = await response.json();
  if (!isRecord(exchangeData)) {
    throw new Error("The exchange-rate service returned an invalid response.");
  }

  const rates = exchangeData.rates;
  const rate = isRecord(rates) ? rates[currency] : undefined;
  if (
    exchangeData.result !== "success" ||
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error("A valid exchange rate is not available for this currency.");
  }

  const lkrPerCurrencyUnit = 1 / rate;
  return Math.round((amountMinor / 100) * lkrPerCurrencyUnit);
}

function payHereHash(merchantId: string, orderId: string, amount: string, secret: string) {
  const secretHash = createHash("md5").update(secret).digest("hex").toUpperCase();
  return createHash("md5")
    .update(`${merchantId}${orderId}${amount}LKR${secretHash}`)
    .digest("hex")
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  let payload: CheckoutPayload;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    }
    payload = body as CheckoutPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (
    typeof payload.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.requestId)
  ) {
    return NextResponse.json({ error: "A valid campaign ID is required." }, { status: 400 });
  }

  const provider: PaymentProvider | null =
    payload.provider === "payhere" || payload.provider === "stripe"
      ? payload.provider
      : null;
  const currency: SupportedCurrency | null =
    typeof payload.currency === "string" &&
    supportedCurrencies.includes(payload.currency as SupportedCurrency)
      ? (payload.currency as SupportedCurrency)
      : null;
  const amountMinor = parseAmount(payload.amount);

  if (!provider || !currency || amountMinor === null || amountMinor > 99_999_999) {
    return NextResponse.json(
      { error: "Select a supported payment method, currency, and amount under 1,000,000." },
      { status: 400 },
    );
  }
  if ((provider === "payhere" && currency !== "LKR") || (provider === "stripe" && currency === "LKR")) {
    return NextResponse.json({ error: "The selected payment method does not support this currency." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Unable to verify your sign-in." }, { status: 401 });
  }
  if (!user || !user.email) {
    return NextResponse.json({ error: "Sign in with an email address to donate." }, { status: 401 });
  }

  const { data: account, error: accountError } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: "Unable to verify your donor account." }, { status: 500 });
  }
  if (account?.role !== "donor") {
    return NextResponse.json({ error: "Only donor accounts can make donations." }, { status: 403 });
  }

  let payHereBilling:
    | { firstName: string; lastName: string; phone: string; address: string; city: string }
    | null = null;
  if (provider === "payhere") {
    if (!process.env.PAYHERE_MERCHANT_ID || !process.env.PAYHERE_MERCHANT_SECRET) {
      return NextResponse.json({ error: "PayHere is not configured." }, { status: 500 });
    }
    const mode = process.env.PAYHERE_MODE ?? "sandbox";
    if (mode !== "sandbox" && mode !== "live") {
      return NextResponse.json({ error: "PAYHERE_MODE must be sandbox or live." }, { status: 500 });
    }

    const nameParts = account.full_name.trim().split(/\s+/);
    const firstName = nameParts.shift() ?? "Donor";
    const lastName = nameParts.join(" ") || firstName;
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const address = typeof payload.address === "string" ? payload.address.trim() : "";
    const city = typeof payload.city === "string" ? payload.city.trim() : "";
    if (
      firstName.length > 100 ||
      lastName.length > 100 ||
      phone.length < 5 ||
      phone.length > 30 ||
      address.length < 3 ||
      address.length > 200 ||
      city.length < 2 ||
      city.length > 100
    ) {
      return NextResponse.json(
        { error: "PayHere requires a valid phone number, billing address, and city." },
        { status: 400 },
      );
    }
    payHereBilling = { firstName, lastName, phone, address, city };
  } else if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("scholarship_requests")
    .select("id, title, target_amount_lkr, status")
    .eq("id", payload.requestId)
    .maybeSingle();

  if (campaignError) {
    return NextResponse.json({ error: "Unable to load this campaign." }, { status: 500 });
  }
  if (!campaign || campaign.status !== "active") {
    return NextResponse.json({ error: "This campaign is not accepting donations." }, { status: 409 });
  }

  try {
    const amountLkr = await getLkrEquivalent(amountMinor, currency);
    if (amountLkr < 1) {
      return NextResponse.json({ error: "Donation must be worth at least LKR 1." }, { status: 400 });
    }

    const { data: total, error: totalError } = await supabase
      .from("request_fundraising_totals")
      .select("raised_amount_lkr")
      .eq("request_id", campaign.id)
      .maybeSingle();

    if (totalError) {
      return NextResponse.json({ error: "Unable to calculate remaining campaign need." }, { status: 500 });
    }
    const remaining = Math.max(
      0,
      Number(campaign.target_amount_lkr) - Number(total?.raised_amount_lkr ?? 0),
    );
    if (amountLkr > remaining) {
      return NextResponse.json(
        { error: `Donation exceeds the remaining campaign need of LKR ${remaining.toLocaleString("en-LK")}.` },
        { status: 400 },
      );
    }

    const siteUrl = getSiteUrl();
    const admin = createAdminClient();
    const { data: donation, error: donationError } = await admin
      .from("donations")
      .insert({
        request_id: campaign.id,
        donor_id: user.id,
        amount_minor: amountMinor,
        currency,
        amount_lkr: amountLkr,
        payment_provider: provider,
      })
      .select("id")
      .single();

    if (donationError) {
      throw new Error(`Could not create donation record: ${donationError.message}`);
    }

    if (provider === "stripe") {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
      }

      const form = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(amountMinor),
        "line_items[0][price_data][product_data][name]": `Donation: ${campaign.title}`,
        "line_items[0][quantity]": "1",
        customer_email: user.email,
        client_reference_id: donation.id,
        "metadata[donation_id]": donation.id,
        success_url: `${siteUrl}/requests/${campaign.id}?donation=success`,
        cancel_url: `${siteUrl}/requests/${campaign.id}?donation=cancelled`,
      });

      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(10000),
      });
      const stripeResult: unknown = await stripeResponse.json();
      if (
        !stripeResponse.ok ||
        !isRecord(stripeResult) ||
        typeof stripeResult.id !== "string" ||
        typeof stripeResult.url !== "string"
      ) {
        const stripeError =
          isRecord(stripeResult) && isRecord(stripeResult.error) && typeof stripeResult.error.message === "string"
            ? stripeResult.error.message
            : "Stripe could not start checkout.";
        throw new Error(stripeError);
      }

      const { error: referenceError } = await admin
        .from("donations")
        .update({ provider_reference: stripeResult.id })
        .eq("id", donation.id);
      if (referenceError) {
        throw new Error(`Could not save payment reference: ${referenceError.message}`);
      }

      return NextResponse.json({ provider: "stripe", checkoutUrl: stripeResult.url });
    }

    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    if (!merchantId || !merchantSecret) {
      throw new Error("PayHere is not configured.");
    }
    const mode = process.env.PAYHERE_MODE ?? "sandbox";
    const checkoutUrl =
      mode === "live"
        ? "https://www.payhere.lk/pay/checkout"
        : "https://sandbox.payhere.lk/pay/checkout";
    const amountLkrText = (amountMinor / 100).toFixed(2);
    const billing = payHereBilling;
    if (!billing) {
      throw new Error("PayHere billing information is missing.");
    }

    const { error: referenceError } = await admin
      .from("donations")
      .update({ provider_reference: donation.id })
      .eq("id", donation.id);
    if (referenceError) {
      throw new Error(`Could not save payment reference: ${referenceError.message}`);
    }

    return NextResponse.json({
      provider: "payhere",
      checkoutUrl,
      fields: {
        merchant_id: merchantId,
        return_url: `${siteUrl}/requests/${campaign.id}?donation=success`,
        cancel_url: `${siteUrl}/requests/${campaign.id}?donation=cancelled`,
        notify_url: `${siteUrl}/api/donations/payhere-notify`,
        order_id: donation.id,
        items: `Donation: ${campaign.title}`,
        currency: "LKR",
        amount: amountLkrText,
        first_name: billing.firstName,
        last_name: billing.lastName,
        email: user.email,
        phone: billing.phone,
        address: billing.address,
        city: billing.city,
        country: "Sri Lanka",
        hash: payHereHash(merchantId, donation.id, amountLkrText, merchantSecret),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start donation checkout." },
      { status: 502 },
    );
  }
}
