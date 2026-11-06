// Pure date helpers. No DOM. Dates are plain "YYYY-MM-DD" strings in local
// time, so "today" doesn't shift with time zones or summer time.

export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

export function parseDate(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(fromText, toText) {
  return Math.round((parseDate(toText) - parseDate(fromText)) / 86400000);
}

// "Today", "Tomorrow", "Yesterday", "2 days late", "Fri", "12 Nov"
export function dueLabel(due, today) {
  if (!due) {
    return "";
  }
  const days = daysBetween(today, due);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return -days + " days late";
  const date = parseDate(due);
  if (days < 7) {
    return date.toLocaleDateString("en-GB", { weekday: "short" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
