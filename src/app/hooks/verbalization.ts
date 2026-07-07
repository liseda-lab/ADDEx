// The verbalization panel doesn't display the numeric path scores (they live in
// the Paths tab), yet the LLM often refers to them ("the scores indicate a
// moderate level of confidence…"). Drop any sentence that references a score,
// confidence value, ranking, probability, or a bare 0.xx score number, so the
// summary never alludes to numbers the reader can't see here. This cleans
// already-cached verbalizations at serve/seed time; the generator prompt is
// also updated so new ones avoid producing these sentences in the first place.
//
// Pure string logic (no server-only imports) so both the API route and the
// client-side summary panel can share it.
export function stripScoreMentions(explanation: string): string {
  const scoreRe =
    /\b(scores?|confidence|ranked|ranking|probabilit\w*|likelihood)\b|\b0\.\d{2,}\b/i;
  const cleaned = explanation
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => sentence.trim() && !scoreRe.test(sentence))
        .join(" ")
        .trim()
    )
    .filter((para) => para.length > 0)
    .join("\n\n")
    .trim();
  // Safety net: if stripping removed almost everything, keep the original so we
  // never render an empty summary.
  return cleaned.length >= 40 ? cleaned : explanation.trim();
}
