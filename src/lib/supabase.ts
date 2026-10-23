import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ""
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""

let supabaseClient: SupabaseClient | undefined

export function getSupabaseConfigurationError(): string | null {
  if (!supabaseUrl || !supabasePublishableKey) {
    return "Die Supabase-Konfiguration fehlt. Bitte hinterlege Projekt-URL und Publishable Key in der .env-Datei und starte den Entwicklungsserver neu."
  }

  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "Die Supabase-Projekt-URL muss mit https:// beginnen."
    }
  } catch {
    return "Die Supabase-Projekt-URL ist ungültig."
  }

  return null
}

export function getSupabaseClient(): SupabaseClient {
  const configurationError = getSupabaseConfigurationError()
  if (configurationError) {
    throw new Error(configurationError)
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabasePublishableKey)
  }

  return supabaseClient
}
