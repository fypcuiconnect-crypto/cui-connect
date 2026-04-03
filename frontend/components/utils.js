export const cls = (...c) => c.filter(Boolean).join(" ");

export function timeAgo(date) {
  // 1. Validate date input
  const d = typeof date === "string" ? new Date(date) : date;
  
  // Check if the date is valid. If not, return a placeholder.
  if (!d || isNaN(d.getTime())) return "just now";

  const now = new Date();
  const sec = Math.max(1, Math.floor((now - d) / 1000));
  
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  // 2. Define ranges with their divisors for cleaner logic
  const ranges = [
    { limit: 60, unit: "second", div: 1 },
    { limit: 3600, unit: "minute", div: 60 },
    { limit: 86400, unit: "hour", div: 3600 },
    { limit: 604800, unit: "day", div: 86400 },
    { limit: 2419200, unit: "week", div: 604800 },
    { limit: 29030400, unit: "month", div: 2419200 },
    { limit: Infinity, unit: "year", div: 29030400 },
  ];

  for (const range of ranges) {
    if (sec < range.limit || range.limit === Infinity) {
      // 3. Ensure the value is a finite number
      const value = -Math.floor(sec / range.div);
      
      // Safety check: if somehow we got NaN, fallback to "just now"
      if (!isFinite(value)) return "just now";
      
      return rtf.format(value, range.unit);
    }
  }
  
  return "just now";
}

export const makeId = (p) => `${p}${Math.random().toString(36).slice(2, 10)}`;