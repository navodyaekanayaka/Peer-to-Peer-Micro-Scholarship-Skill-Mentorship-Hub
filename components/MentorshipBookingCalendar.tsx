"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export type AvailableMentorshipSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
};

type MentorshipBookingCalendarProps = {
  mentorId: string;
  mentorName: string;
  slots: AvailableMentorshipSlot[];
  initialDate: string;
};

function localDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MentorshipBookingCalendar({
  mentorId,
  mentorName,
  slots,
  initialDate,
}: MentorshipBookingCalendarProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const daySlots = slots.filter((slot) => localDate(slot.startsAt) === selectedDate);

  async function bookSlot(slotId: string) {
    setBookingSlot(slotId);
    setMessage("");
    setErrorMessage("");

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
        router.push(`/auth/login?next=${encodeURIComponent("/mentorship")}`);
        return;
      }

      const { error } = await supabase.rpc("book_mentorship_slot", {
        slot_id: slotId,
      });

      if (error) {
        throw new Error(error.message);
      }

      setMessage(`Your session with ${mentorName} has been booked.`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to book this mentorship slot.",
      );
    } finally {
      setBookingSlot(null);
    }
  }

  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">Available sessions</h3>
          <p className="mt-1 text-xs text-slate-500">All times are Sri Lanka time (UTC+5:30).</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor={`date-${mentorId}`}>
            Choose a date
          </label>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            id={`date-${mentorId}`}
            min={initialDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {message}
        </p>
      )}
      {errorMessage && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      )}

      {daySlots.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          No available sessions on this date. Choose another date to see more times.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {daySlots.map((slot) => (
            <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3" key={slot.id}>
              <span className="text-sm font-medium text-slate-800">
                {localTime(slot.startsAt)}–{localTime(slot.endsAt)}
              </span>
              <button
                className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={bookingSlot !== null}
                onClick={() => bookSlot(slot.id)}
                type="button"
              >
                {bookingSlot === slot.id ? "Booking..." : "Book"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
