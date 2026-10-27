// Edit this to match what your channel actually talks about.
// A video belongs to a topic if its caption/title/hashtags contain any keyword (whole-word, case-insensitive).
// A video can belong to several topics.
export const TOPICS: Record<string, string[]> = {
  "Repos & open source": ["repo", "repos", "github", "opensource", "open-source", "alternatives", "tools"],
  "Job & dev life": ["work", "job", "j*b", "jobs", "career", "commute", "unemployed", "imissbeingunemployed", "laptop", "thinkpad", "office", "small talk", "remotework", "remote", "cv", "experience", "interview", "salary"],
  "AI": ["ai", "agent", "agents", "tokens", "llm", "machinelearning", "chatgpt", "claude", "cursor", "copilot"],
  "Frontend / CSS": ["css", "animation", "frontend", "ui", "tailwind", "html", "webdevelopment"],
  "Coding humor": ["codinghumor", "programmerhumor", "pov", "meme", "relatable"],
  "Algerian audience": ["dz", "algeria", "algerie", "algerian"],
  "Off-topic / lifestyle": ["anime", "animefyp", "books", "booksoftiktok", "bookshelf", "literature", "adventuretime", "cartoonnetwork", "thesummeriturnedpretty", "adult"],
};

const patterns = Object.entries(TOPICS).map(([topic, words]) => ({
  topic,
  re: new RegExp(
    `(^|[^\\p{L}\\p{N}])#?(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ),
}));

export function topicsFor(text: string): string[] {
  return patterns.filter((p) => p.re.test(text)).map((p) => p.topic);
}

export function hashtagsFor(text: string): string[] {
  return [...new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase()))];
}
