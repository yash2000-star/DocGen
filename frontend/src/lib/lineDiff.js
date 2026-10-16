// Line-by-line diff (longest common subsequence), for comparing page versions.
// Pages are a few hundred lines at most, so the quadratic table is fine; very long inputs
// fall back to "everything changed" rather than freezing the tab.
const MAX_CELLS = 4_000_000;

/**
 * @param {string} before
 * @param {string} after
 * @returns {{ type: "same" | "add" | "del", text: string }[]}
 */
export function lineDiff(before, after) {
  const a = String(before ?? "").split("\n");
  const b = String(after ?? "").split("\n");
  if (a.length * b.length > MAX_CELLS) {
    return [...a.map((text) => ({ type: "del", text })), ...b.map((text) => ({ type: "add", text }))];
  }
  // lengths[i][j] = LCS length of a[i:] and b[j:]
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      out.push({ type: "del", text: a[i++] });
    } else {
      out.push({ type: "add", text: b[j++] });
    }
  }
  while (i < a.length) out.push({ type: "del", text: a[i++] });
  while (j < b.length) out.push({ type: "add", text: b[j++] });
  return out;
}

/** How many lines were added and removed. */
export function diffStats(diff) {
  return diff.reduce((stats, line) => {
    if (line.type === "add") stats.added++;
    if (line.type === "del") stats.removed++;
    return stats;
  }, { added: 0, removed: 0 });
}
