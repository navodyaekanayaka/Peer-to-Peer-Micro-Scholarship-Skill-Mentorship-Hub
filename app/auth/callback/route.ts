import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function getSafeDestination(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get("next");
  if (!nextPath) {
    return new URL("/", request.url);
  }

  const destination = new URL(nextPath, request.url);
  if (destination.origin !== request.nextUrl.origin) {
    return new URL("/", request.url);
  }

  return destination;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?error=auth_callback_failed", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/login?error=auth_callback_failed", request.url),
    );
  }

  return NextResponse.redirect(getSafeDestination(request));
}
