"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type UserRole = "student" | "donor" | "mentor";

type RegistrationFields = {
  fullName: string;
  district: string;
  institution: string;
  fieldOfStudy: string;
  studentIdentifier: string;
  countryCity: string;
  areaOfExpertise: string;
  organization: string;
};

const initialFields: RegistrationFields = {
  fullName: "",
  district: "",
  institution: "",
  fieldOfStudy: "",
  studentIdentifier: "",
  countryCity: "",
  areaOfExpertise: "",
  organization: "",
};

const roles: { value: UserRole; label: string; description: string }[] = [
  {
    value: "student",
    label: "Student",
    description: "Request education support and share your progress.",
  },
  {
    value: "donor",
    label: "Donor",
    description: "Support students with direct contributions.",
  },
  {
    value: "mentor",
    label: "Mentor",
    description: "Share your skills and experience one-to-one.",
  },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function getRequestedRole(): UserRole {
  const requestedRole = new URLSearchParams(window.location.search).get("role");
  return requestedRole === "student" ||
    requestedRole === "donor" ||
    requestedRole === "mentor"
    ? requestedRole
    : "student";
}

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("student");
  const [fields, setFields] = useState<RegistrationFields>(initialFields);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setRole(getRequestedRole());
  }, []);

  function updateField(field: keyof RegistrationFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (
      role === "mentor" &&
      !fields.areaOfExpertise.trim() &&
      !fields.organization.trim()
    ) {
      setErrorMessage("Mentors must provide an area of expertise or organization.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            role,
            full_name: fields.fullName.trim(),
            district: role === "student" ? fields.district.trim() : null,
            institution: role === "student" ? fields.institution.trim() : null,
            field_of_study: role === "student" ? fields.fieldOfStudy.trim() : null,
            student_identifier:
              role === "student" ? fields.studentIdentifier.trim() : null,
            country_city: role === "student" ? null : fields.countryCity.trim(),
            area_of_expertise:
              role === "mentor" ? fields.areaOfExpertise.trim() : null,
            organization:
              role === "donor" || role === "mentor"
                ? fields.organization.trim()
                : null,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/verify-email?confirmed=1")}`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace(
        data.session
          ? "/auth/verify-email?ready=1"
          : "/auth/verify-email",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create your account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Join the community
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Create your account
          </h1>
          <p className="mt-2 text-slate-600">
            Choose how you would like to take part in supporting education.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-slate-900">
              Register as
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {roles.map((option) => (
                <label
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    role === option.value
                      ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                  key={option.value}
                >
                  <input
                    checked={role === option.value}
                    className="sr-only"
                    name="role"
                    onChange={() => setRole(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span className="block font-semibold text-slate-950">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={role === "student" ? "sm:col-span-2" : ""}>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="full-name">
                Full name
              </label>
              <input
                autoComplete="name"
                className={inputClass}
                id="full-name"
                maxLength={120}
                onChange={(event) => updateField("fullName", event.target.value)}
                required
                value={fields.fullName}
              />
            </div>

            {role === "student" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="district">
                    District
                  </label>
                  <input
                    autoComplete="address-level1"
                    className={inputClass}
                    id="district"
                    maxLength={100}
                    onChange={(event) => updateField("district", event.target.value)}
                    required
                    value={fields.district}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="institution">
                    Institution
                  </label>
                  <input
                    autoComplete="organization"
                    className={inputClass}
                    id="institution"
                    maxLength={180}
                    onChange={(event) => updateField("institution", event.target.value)}
                    placeholder="School, university, or institute"
                    required
                    value={fields.institution}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="field-of-study">
                    Field of study
                  </label>
                  <input
                    className={inputClass}
                    id="field-of-study"
                    maxLength={160}
                    onChange={(event) => updateField("fieldOfStudy", event.target.value)}
                    required
                    value={fields.fieldOfStudy}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="student-identifier">
                    NIC / Student ID
                  </label>
                  <input
                    autoComplete="off"
                    className={inputClass}
                    id="student-identifier"
                    maxLength={80}
                    onChange={(event) =>
                      updateField("studentIdentifier", event.target.value)
                    }
                    required
                    value={fields.studentIdentifier}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    This identifier is stored in a private registration record.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="country-city">
                    Country / City
                  </label>
                  <input
                    autoComplete="address-level2"
                    className={inputClass}
                    id="country-city"
                    maxLength={120}
                    onChange={(event) => updateField("countryCity", event.target.value)}
                    placeholder="e.g. Colombo, Sri Lanka"
                    required
                    value={fields.countryCity}
                  />
                </div>
                {role === "mentor" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="expertise">
                      Area of expertise
                    </label>
                    <input
                      className={inputClass}
                      id="expertise"
                      maxLength={200}
                      onChange={(event) =>
                        updateField("areaOfExpertise", event.target.value)
                      }
                      placeholder="e.g. Software engineering"
                      value={fields.areaOfExpertise}
                    />
                  </div>
                )}
                <div className={role === "donor" ? "sm:col-span-2" : ""}>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="organization">
                    {role === "donor" ? "Organization" : "Organization (optional)"}
                  </label>
                  <input
                    autoComplete="organization"
                    className={inputClass}
                    id="organization"
                    maxLength={180}
                    onChange={(event) => updateField("organization", event.target.value)}
                    required={role === "donor"}
                    value={fields.organization}
                  />
                </div>
                {role === "mentor" && (
                  <p className="sm:col-span-2 -mt-2 text-xs text-slate-500">
                    Provide at least an area of expertise or an organization.
                  </p>
                )}
              </>
            )}

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
                Email address
              </label>
              <input
                autoComplete="email"
                className={inputClass}
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                autoComplete="new-password"
                className={inputClass}
                id="password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link className="font-semibold text-emerald-800 hover:underline" href="/auth/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
