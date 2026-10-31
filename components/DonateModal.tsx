"use client";

import { useState, type FormEvent } from "react";

type PaymentProvider = "payhere" | "stripe";
type InternationalCurrency = "USD" | "GBP" | "AUD";

type CheckoutResponse =
  | {
      provider: "stripe";
      checkoutUrl: string;
    }
  | {
      provider: "payhere";
      checkoutUrl: string;
      fields: Record<string, string>;
    };

type DonateModalProps = {
  requestId: string;
  requestTitle: string;
  remainingLkr: number;
};

function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const result = value as Record<string, unknown>;
  if (result.provider === "stripe") {
    return typeof result.checkoutUrl === "string";
  }
  return (
    result.provider === "payhere" &&
    typeof result.checkoutUrl === "string" &&
    typeof result.fields === "object" &&
    result.fields !== null
  );
}

function submitPayHereForm(checkoutUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkoutUrl;
  form.style.display = "none";

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
}

export default function DonateModal({
  requestId,
  requestTitle,
  remainingLkr,
}: DonateModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProvider] = useState<PaymentProvider>("payhere");
  const [currency, setCurrency] = useState<InternationalCurrency>("USD");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setErrorMessage("Enter a valid donation amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/donations/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          amount: amountValue,
          provider,
          currency: provider === "payhere" ? "LKR" : currency,
          phone,
          address,
          city,
        }),
      });

      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to begin checkout.";
        throw new Error(message);
      }

      if (!isCheckoutResponse(result)) {
        throw new Error("The checkout service returned an invalid response.");
      }

      if (result.provider === "stripe") {
        window.location.assign(result.checkoutUrl);
        return;
      }

      submitPayHereForm(result.checkoutUrl, result.fields);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to begin checkout.");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="mt-6 block w-full rounded-lg bg-emerald-700 px-4 py-3 text-center font-semibold text-white transition hover:bg-emerald-800"
        onClick={() => {
          setErrorMessage("");
          setIsOpen(true);
        }}
        type="button"
      >
        Donate Now
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) {
              setIsOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="donation-modal-title"
            aria-modal="true"
            className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950" id="donation-modal-title">
                  Support this student
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{requestTitle}</p>
              </div>
              <button
                aria-label="Close donation dialog"
                className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
                disabled={isSubmitting}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                &times;
              </button>
            </div>

            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
              Remaining campaign need:{" "}
              <strong>
                {new Intl.NumberFormat("en-LK", {
                  style: "currency",
                  currency: "LKR",
                  maximumFractionDigits: 0,
                }).format(remainingLkr)}
              </strong>
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="payment-provider">
                  Payment method
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  id="payment-provider"
                  onChange={(event) => {
                    const selectedProvider = event.target.value as PaymentProvider;
                    setProvider(selectedProvider);
                    setErrorMessage("");
                  }}
                  value={provider}
                >
                  <option value="payhere">PayHere — local LKR payments</option>
                  <option value="stripe">Stripe — international donations</option>
                </select>
                {provider === "payhere" && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    eZ Cash and FriMi availability depends on the payment methods enabled for the
                    merchant account.
                  </p>
                )}
              </div>

              {provider === "stripe" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="donation-currency">
                    Donation currency
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                    id="donation-currency"
                    onChange={(event) =>
                      setCurrency(event.target.value as InternationalCurrency)
                    }
                    value={currency}
                  >
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="donation-amount">
                  Amount ({provider === "payhere" ? "LKR" : currency})
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  id="donation-amount"
                  min="0.01"
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={amount}
                />
              </div>

              {provider === "payhere" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="donor-phone">
                      Phone number
                    </label>
                    <input
                      autoComplete="tel"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      id="donor-phone"
                      onChange={(event) => setPhone(event.target.value)}
                      required
                      value={phone}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="donor-city">
                      City
                    </label>
                    <input
                      autoComplete="address-level2"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      id="donor-city"
                      onChange={(event) => setCity(event.target.value)}
                      required
                      value={city}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="donor-address">
                      Billing address
                    </label>
                    <input
                      autoComplete="street-address"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      id="donor-address"
                      onChange={(event) => setAddress(event.target.value)}
                      required
                      value={address}
                    />
                  </div>
                </div>
              )}

              {provider === "stripe" && (
                <p className="text-xs leading-5 text-slate-500">
                  The LKR equivalent is calculated from a current exchange rate when checkout
                  starts. Stripe securely collects your payment details.
                </p>
              )}

              {errorMessage && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {errorMessage}
                </p>
              )}

              <button
                className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Preparing secure checkout..." : "Continue to payment"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
