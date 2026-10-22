import { createClient } from "@/lib/supabase/client";

export interface ScoreRow {
  id: string;
  gameId: string;
  name: string;
  score: number;
  createdAt: string;
}

interface ScoreRecord {
  id: string;
  game_id: string;
  name: string;
  score: number;
  created_at: string;
}

function toScoreRow(row: ScoreRecord): ScoreRow {
  return {
    id: row.id,
    gameId: row.game_id,
    name: row.name,
    score: row.score,
    createdAt: row.created_at,
  };
}

export async function saveScore({
  gameId,
  score,
  userId,
  name,
}: {
  gameId: string;
  score: number;
  userId: string;
  name: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, score, user_id: userId, name });

  if (error) throw error;
}

export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, game_id, name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data.map(toScoreRow);
}

export async function getBestScore(
  gameId: string,
  name: string,
): Promise<ScoreRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, game_id, name, score, created_at")
    .eq("game_id", gameId)
    .eq("name", name)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toScoreRow(data) : null;
}
