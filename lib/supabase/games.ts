import { createClient } from "@/lib/supabase/client";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  best: number;
  plays: string;
}

export async function getGames(): Promise<Game[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, best, plays")
    .order("sort_order");

  if (error) throw error;
  return data;
}
