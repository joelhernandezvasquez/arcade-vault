import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["email", "recovery", "signup"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  // Solo rutas internas ("/x"); "//host" sería un redirect abierto.
  const destination =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/biblioteca";

  // OAuth: el proveedor devuelve `?error=` si el jugador cancela o falla.
  if (searchParams.get("error")) {
    return NextResponse.redirect(new URL("/auth?error=proveedor", origin));
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, origin));
    return NextResponse.redirect(new URL("/auth?error=proveedor", origin));
  }

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(destination, origin));
  }

  return NextResponse.redirect(new URL("/auth?error=link", origin));
}
