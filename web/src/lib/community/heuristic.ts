import type { FitEvaluation } from "./types";

const STOP = new Set([
  "and",
  "the",
  "with",
  "for",
  "from",
  "that",
  "this",
  "you",
  "your",
  "are",
  "our",
  "will",
  "have",
  "has",
  "job",
  "role",
  "work",
  "team",
]);

function terms(text: string) {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9+#.-]{2,}/g)
      ?.filter((word) => !STOP.has(word)) ?? [],
  );
}

export function heuristicEvaluation(
  job: string,
  resume: string,
): FitEvaluation {
  const wanted = terms(job);
  const known = terms(resume);
  const matched = [...wanted].filter((word) => known.has(word));
  const missing = [...wanted].filter((word) => !known.has(word));
  const ratio = wanted.size ? matched.length / wanted.size : 0;
  const score = Math.max(1, Math.min(4.5, 1.5 + ratio * 4));
  const verdict =
    score >= 4
      ? "strong"
      : score >= 3
        ? "possible"
        : score >= 2.2
          ? "stretch"
          : "skip";
  return {
    score: Number(score.toFixed(1)),
    verdict,
    headline: "Private quick check — no AI tokens used",
    strengths: matched
      .slice(0, 5)
      .map((word) => `Your resume and the role both mention ${word}.`),
    gaps: missing
      .slice(0, 4)
      .map(
        (word) =>
          `The posting mentions ${word}; verify whether you can support it.`,
      ),
    next_step:
      score >= 3
        ? "Review the highlighted evidence, then tailor only claims already supported by your experience."
        : "Save your time unless the role has a compelling non-obvious fit.",
    caveat:
      "This fallback is keyword-based, not a hiring judgment. It does not add or infer experience.",
  };
}
