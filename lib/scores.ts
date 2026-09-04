export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

export function saveScore(entry: ScoreEntry) {
  try {
    const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem("av_scores", JSON.stringify(all));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}
