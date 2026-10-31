"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type RequestOption = {
  id: string;
  title: string;
};

const maximumReceiptSize = 10 * 1024 * 1024;
const allowedReceiptTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

type MilestoneFormProps = {
  requests: RequestOption[];
};

export default function MilestoneForm({ requests }: MilestoneFormProps) {
  const router = useRouter();
  const [requestId, setRequestId] = useState(requests[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (title.trim().length < 1 || title.trim().length > 160) {
      setErrorMessage("The update title must be between 1 and 160 characters.");
      return;
    }
    if (description.trim().length < 1 || description.trim().length > 3000) {
      setErrorMessage("The update must be between 1 and 3,000 characters.");
      return;
    }
    if (
      receipt &&
      (!allowedReceiptTypes.includes(receipt.type) ||
        receipt.size <= 0 ||
        receipt.size > maximumReceiptSize)
    ) {
      setErrorMessage("Attach a PDF, JPEG, PNG, or WebP receipt under 10 MB.");
      return;
    }

    setIsSubmitting(true);
    let uploadedPath: string | null = null;
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }
      if (!user) {
        router.push("/auth/login?next=%2Fdashboard");
        return;
      }

      const { data: account, error: accountError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (accountError) {
        throw accountError;
      }
      if (account?.role !== "student") {
        throw new Error("Only students can post campaign updates.");
      }

      if (receipt) {
        const extension = receipt.name.split(".").pop()?.toLowerCase() ?? "file";
        const receiptPath = `${user.id}/${requestId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("milestone-receipts")
          .upload(receiptPath, receipt, {
            contentType: receipt.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Could not upload the receipt: ${uploadError.message}`);
        }
        uploadedPath = receiptPath;
      }

      const { error: insertError } = await supabase.from("milestones").insert({
        request_id: requestId,
        author_id: user.id,
        title: title.trim(),
        description: description.trim(),
        receipt_path: uploadedPath,
      });

      if (insertError) {
        throw insertError;
      }

      setTitle("");
      setDescription("");
      setReceipt(null);
      const input = document.getElementById("milestone-receipt");
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
      setSuccessMessage("Your campaign update has been posted.");
      router.refresh();
    } catch (error) {
      let message =
        error instanceof Error ? error.message : "Unable to post your campaign update.";

      if (uploadedPath) {
        const { error: cleanupError } = await createClient()
          .storage.from("milestone-receipts")
          .remove([uploadedPath]);
        if (cleanupError) {
          message += ` The uploaded receipt could not be removed: ${cleanupError.message}`;
        }
      }
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
        Create a funding request before posting campaign updates.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="milestone-request">
          Campaign
        </label>
        <select
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
          id="milestone-request"
          onChange={(event) => setRequestId(event.target.value)}
          required
          value={requestId}
        >
          {requests.map((request) => (
            <option key={request.id} value={request.id}>
              {request.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="milestone-title">
          Update title
        </label>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          id="milestone-title"
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="milestone-description">
          Progress update
        </label>
        <textarea
          className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5"
          id="milestone-description"
          maxLength={3000}
          onChange={(event) => setDescription(event.target.value)}
          required
          value={description}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="milestone-receipt">
          Receipt or progress proof (optional)
        </label>
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="block w-full rounded-lg border border-slate-300 text-sm text-slate-700 file:mr-4 file:border-0 file:bg-emerald-50 file:px-4 file:py-3 file:font-semibold file:text-emerald-800"
          id="milestone-receipt"
          onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
          type="file"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Stored privately; supporters receive a time-limited link. Maximum 10 MB.
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {successMessage}
        </p>
      )}

      <button
        className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Posting update..." : "Post campaign update"}
      </button>
    </form>
  );
}
