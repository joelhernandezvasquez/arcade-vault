import { createClient } from "@/lib/supabase/client";

export const ALIAS_REGEX = /^[A-Z0-9_]{3,10}$/;
export const PASSWORD_MIN = 8;

const MSG_ALIAS_FORMAT = "EL ALIAS DEBE TENER 3 A 10 CARACTERES: A-Z, 0-9 O _";
const MSG_ALIAS_TAKEN = "ESE ALIAS YA ESTÁ EN USO";
const MSG_PASSWORD_TOO_SHORT = `LA CONTRASEÑA DEBE TENER AL MENOS ${PASSWORD_MIN} CARACTERES`;

// Errores de validación propios: ya vienen en español.
class ValidationError extends Error {}

export async function isAliasAvailable(alias: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("alias_disponible", {
    p_alias: alias,
  });

  if (error) throw error;
  return data === true;
}

export async function signUp({
  alias,
  email,
  password,
}: {
  alias: string;
  email: string;
  password: string;
}): Promise<void> {
  const normalizedAlias = alias.trim().toUpperCase();
  if (!ALIAS_REGEX.test(normalizedAlias)) {
    throw new ValidationError(MSG_ALIAS_FORMAT);
  }
  if (password.length < PASSWORD_MIN) {
    throw new ValidationError(MSG_PASSWORD_TOO_SHORT);
  }
  if (!(await isAliasAvailable(normalizedAlias))) {
    throw new ValidationError(MSG_ALIAS_TAKEN);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { alias: normalizedAlias } },
  });

  if (error) throw error;
}

// Perfil de un jugador que entró por OAuth y todavía no tiene alias.
export async function crearPerfil(
  userId: string,
  alias: string,
): Promise<void> {
  const normalizedAlias = alias.trim().toUpperCase();
  if (!ALIAS_REGEX.test(normalizedAlias)) {
    throw new ValidationError(MSG_ALIAS_FORMAT);
  }
  if (!(await isAliasAvailable(normalizedAlias))) {
    throw new ValidationError(MSG_ALIAS_TAKEN);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, alias: normalizedAlias });

  if (error) throw error;
}

export async function signIn({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
}

// Redirige el navegador al proveedor; la sesión se crea en /auth/confirmar.
export async function iniciarConProveedor(
  provider: "google" | "github",
  next: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${location.origin}/auth/confirmar?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

  if (error) throw error;
}

export async function changePassword(password: string): Promise<void> {
  if (password.length < PASSWORD_MIN) {
    throw new ValidationError(MSG_PASSWORD_TOO_SHORT);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) throw error;
}

// Traduce errores de Supabase (y los de validación propios) a texto en español.
export function getErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message;

  const e = error as { code?: string; message?: string; status?: number };
  const code = e?.code ?? "";
  const message = (e?.message ?? "").toLowerCase();

  switch (code) {
    case "invalid_credentials":
      return "CORREO O CONTRASEÑA INCORRECTOS";
    case "email_not_confirmed":
      return "CONFIRMA TU CORREO ANTES DE ENTRAR";
    case "weak_password":
      return MSG_PASSWORD_TOO_SHORT;
    case "same_password":
      return "LA NUEVA CONTRASEÑA DEBE SER DISTINTA A LA ANTERIOR";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "DEMASIADOS INTENTOS, ESPERA UN MOMENTO";
    case "email_address_invalid":
    case "validation_failed":
      return "EL CORREO NO ES VÁLIDO";
    case "session_not_found":
    case "not_authenticated":
      return "ABRE EL ENLACE DE TU CORREO";
  }

  // El trigger handle_new_user falla por el unique de profiles.alias.
  if (
    message.includes("database error saving new user") ||
    message.includes("profiles_alias_key") ||
    message.includes("duplicate key")
  ) {
    return MSG_ALIAS_TAKEN;
  }
  if (message.includes("invalid login credentials")) {
    return "CORREO O CONTRASEÑA INCORRECTOS";
  }
  if (message.includes("email not confirmed")) {
    return "CONFIRMA TU CORREO ANTES DE ENTRAR";
  }

  return "ALGO SALIÓ MAL, INTÉNTALO DE NUEVO";
}
