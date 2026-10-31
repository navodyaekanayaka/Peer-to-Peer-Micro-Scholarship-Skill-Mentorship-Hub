"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/client";

const categories = [
  { value: "books", label: "Books and learning materials" },
  { value: "exam_fee", label: "A/L examination fees" },
  { value: "internet_data", label: "Internet data package" },
  { value: "hardware", label: "Hardware or laptop" },
  { value: "other", label: "Other education need" },
] as const;

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const maxFileSize = 10 * 1024 * 1024;
const today = new Date();
const minimumDate = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

const requestSchema = z.object({
  category: z.enum(["books", "exam_fee", "internet_data", "hardware", "other"]),
  title: z.string().trim().min(5, "Use at least 5 characters.").max(160),
  description: z.string().trim().min(20, "Describe your request in at least 20 characters.").max(5000),
  target_amount_lkr: z
    .number({ invalid_type_error: "Enter a target amount." })
    .int("Enter a whole amount in LKR.")
    .min(5000, "The minimum request amount is LKR 5,000.")
    .max(30000, "The maximum request amount is LKR 30,000."),
  cost_breakdown: z.string().trim().min(10, "Add a short breakdown of how the funds will be used.").max(3000),
  deadline: z.string().refine((value) => value >= minimumDate, {
    message: "Choose today or a future date.",
  }),
  proof_document: z.custom<FileList>(
    (value) => typeof FileList !== "undefined" && value instanceof FileList && value.length === 1,
    "Upload one proof document.",
  ).superRefine((files, context) => {
    if (!files || typeof files.item !== "function") {
      return;
    }
    const file = files.item(0);
    if (!file) {
      return;
    }
    if (!allowedMimeTypes.includes(file.type)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use a PDF, JPEG, PNG, or WebP file.",
      });
    }
    if (file.size <= 0 || file.size > maxFileSize) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The file must be smaller than 10 MB.",
      });
    }
  }),
});

type RequestFormValues = z.infer<typeof requestSchema>;
type StepField =
  | "category"
  | "title"
  | "description"
  | "target_amount_lkr"
  | "cost_breakdown"
  | "deadline"
  | "proof_document";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export default function NewRequestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      category: "books",
      title: "",
      description: "",
      target_amount_lkr: 5000,
      cost_breakdown: "",
      deadline: "",
    },
  });

  const proofRegistration = register("proof_document");
  const proofFiles = watch("proof_document");
  const proofFile = proofFiles?.item(0) ?? null;

  async function continueStep(fields: StepField[], nextStep: 2 | 3) {
    const valid = await trigger(fields);
    if (valid) {
      setSubmitError("");
      setStep(nextStep);
    }
  }

  function acceptFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    setValue("proof_document", transfer.files, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files.item(0) ?? undefined);
  }

  async function submitRequest(values: RequestFormValues) {
    setSubmitError("");
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
        router.push("/auth/login?next=%2Frequests%2Fnew");
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
        throw new Error("Only student accounts can create funding requests.");
      }

      const proof = values.proof_document.item(0);
      if (!proof) {
        throw new Error("Select a verification document before submitting.");
      }
      const extensionByMimeType: Record<string, string> = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      const proofPath = `${user.id}/${crypto.randomUUID()}.${extensionByMimeType[proof.type]}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-docs")
        .upload(proofPath, proof, {
          contentType: proof.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Could not upload the verification document: ${uploadError.message}`);
      }
      uploadedPath = proofPath;

      const { data: request, error: insertError } = await supabase
        .from("scholarship_requests")
        .insert({
          student_id: user.id,
          title: values.title,
          description: values.description,
          category: values.category,
          target_amount_lkr: values.target_amount_lkr,
          cost_breakdown: values.cost_breakdown,
          deadline: values.deadline,
          proof_document_path: proofPath,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      router.replace(`/requests/${request.id}`);
      router.refresh();
    } catch (error) {
      let message =
        error instanceof Error ? error.message : "Unable to submit your request.";
      if (uploadedPath) {
        const { error: cleanupError } = await createClient()
          .storage.from("verification-docs")
          .remove([uploadedPath]);
        if (cleanupError) {
          message += ` The uploaded document could not be removed: ${cleanupError.message}`;
        }
      }
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <Link className="text-sm font-medium text-emerald-800 hover:underline" href="/dashboard">
        &larr; Student dashboard
      </Link>
      <header className="mb-8 mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Student support
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Create a funding request
        </h1>
        <p className="mt-2 text-slate-600">
          Share the education need, how much it costs, and supporting proof. Documents are private
          to you and authorized reviewers.
        </p>
      </header>

      <ol aria-label="Request form progress" className="mb-6 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
        {["Request details", "Financials & urgency", "Verification documents"].map((label, index) => (
          <li
            aria-current={step === index + 1 ? "step" : undefined}
            className={`rounded-full px-2 py-2 font-semibold ${
              step === index + 1
                ? "bg-emerald-700 text-white"
                : step > index + 1
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-slate-200 text-slate-600"
            }`}
            key={label}
          >
            <span className="sm:hidden">{index + 1}</span>
            <span className="hidden sm:inline">{index + 1}. {label}</span>
          </li>
        ))}
      </ol>

      <form
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        noValidate
        onSubmit={handleSubmit(submitRequest)}
      >
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="category">
                Request category
              </label>
              <select className={inputClass} id="category" {...register("category")}>
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-sm text-red-700">{errors.category.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="title">
                Request title
              </label>
              <input
                className={inputClass}
                id="title"
                maxLength={160}
                placeholder="e.g. A/L examination registration fees"
                {...register("title")}
              />
              {errors.title && <p className="mt-1 text-sm text-red-700">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="description">
                Your story and how this support will help
              </label>
              <textarea
                className={`${inputClass} min-h-36`}
                id="description"
                maxLength={5000}
                placeholder="Explain your education goal and why this support matters."
                {...register("description")}
              />
              <p className="mt-1 text-right text-xs text-slate-500">
                {watch("description")?.length ?? 0}/5,000
              </p>
              {errors.description && <p className="mt-1 text-sm text-red-700">{errors.description.message}</p>}
            </div>
            <button
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
              onClick={() => void continueStep(["category", "title", "description"], 2)}
              type="button"
            >
              Continue to financials
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="target-amount">
                Target amount (LKR)
              </label>
              <input
                className={inputClass}
                id="target-amount"
                max={30000}
                min={5000}
                step={500}
                type="number"
                {...register("target_amount_lkr", { valueAsNumber: true })}
              />
              <p className="mt-1 text-xs text-slate-500">Requests must be between LKR 5,000 and LKR 30,000.</p>
              {errors.target_amount_lkr && (
                <p className="mt-1 text-sm text-red-700">{errors.target_amount_lkr.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="cost-breakdown">
                Cost breakdown
              </label>
              <textarea
                className={`${inputClass} min-h-28`}
                id="cost-breakdown"
                maxLength={3000}
                placeholder={"Exam registration: LKR 3,500\nPast papers: LKR 1,500"}
                {...register("cost_breakdown")}
              />
              {errors.cost_breakdown && (
                <p className="mt-1 text-sm text-red-700">{errors.cost_breakdown.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="deadline">
                Target completion date
              </label>
              <input
                className={inputClass}
                id="deadline"
                min={minimumDate}
                type="date"
                {...register("deadline")}
              />
              {errors.deadline && <p className="mt-1 text-sm text-red-700">{errors.deadline.message}</p>}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setStep(1)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
                onClick={() =>
                  void continueStep(
                    ["target_amount_lkr", "cost_breakdown", "deadline"],
                    3,
                  )
                }
                type="button"
              >
                Continue to documents
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
                isDragging
                  ? "border-emerald-700 bg-emerald-50"
                  : "border-slate-300 bg-slate-50"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                id="proof-document"
                type="file"
                {...proofRegistration}
                ref={(element) => {
                  proofRegistration.ref(element);
                  fileInputRef.current = element;
                }}
                onChange={(event) => {
                  void proofRegistration.onChange(event);
                  setValue("proof_document", event.target.files ?? new DataTransfer().files, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
              />
              <p aria-hidden="true" className="text-3xl">⇧</p>
              <p className="mt-3 font-semibold text-slate-900">
                Drag a document here, or{" "}
                <button
                  className="text-emerald-800 underline"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  browse files
                </button>
              </p>
              <p className="mt-2 text-sm text-slate-600">
                A/L admission card, student ID, or bookstore quotation
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF, JPEG, PNG, or WebP · maximum 10 MB
              </p>
              {proofFile && (
                <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
                  Selected: {proofFile.name} ({(proofFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
            {errors.proof_document && (
              <p className="text-sm text-red-700">{errors.proof_document.message}</p>
            )}
            {submitError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {submitError}
              </p>
            )}
            <p className="text-xs leading-5 text-slate-500">
              Documents are uploaded to private storage. Your identity document is not shown on
              the public campaign page.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                disabled={isSubmitting}
                onClick={() => setStep(2)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Submitting request..." : "Submit for review"}
              </button>
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
