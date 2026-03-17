export function toMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function toDisplayName(fullName) {
  const trimmed = String(fullName ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  const last = parts.pop() ?? "";
  const first = parts.join(" ");
  return first ? `${last}, ${first}` : last;
}

export function compareDisplayNames(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}
