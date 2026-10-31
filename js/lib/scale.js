// Pure helpers for scaling recipe amounts to more or fewer servings.
// No DOM; easy to test.

const FRACTIONS = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };
const FRACTION_CHARS = Object.keys(FRACTIONS).join("");

// Friendly fractions used when showing small amounts.
const NICE = [
  [0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"],
  [2 / 3, "⅔"], [0.75, "¾"], [1, ""],
];

// Finds "Serves 4", "4 servings", "for 4 people", "4 portions" in text.
export function detectServings(text) {
  const patterns = [
    /\bserves\s+(\d{1,2})\b/i,
    /\bservings?:?\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s+(?:servings|portions|people|persons)\b/i,
    /\bfor\s+(\d{1,2})\s+(?:people|persons)\b/i,
    /\bportions?:?\s*(\d{1,2})\b/i,
  ];
  for (const pattern of patterns) {
    const match = (text || "").match(pattern);
    if (match) {
      const n = Number(match[1]);
      if (n >= 1 && n <= 50) {
        return n;
      }
    }
  }
  return null;
}

// One amount: "2", "1.5", "1,5", "½", "1½", "1 1/2", "1/2".
export const AMOUNT =
  "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+[" + FRACTION_CHARS + "]|[" + FRACTION_CHARS + "]|\\d+(?:[.,]\\d+)?)";
// Units that may be written straight after the number: "600g", "250ml".
const UNIT = "(?:g|kg|mg|ml|cl|dl|l|oz|lb)\\b";
// An amount or a range like "2-3" / "2–3", not part of a word,
// and not a temperature or percentage.
const QUANTITY = new RegExp(
  "(^|[^\\w.,/])(" + AMOUNT + ")(\\s*[-–]\\s*(" + AMOUNT + "))?" +
    "(?!\\s*(?:°|%|-\\w))(?!(?!" + UNIT + ")[\\w/])",
  "g"
);

export function parseAmount(text) {
  const t = text.trim().replace(",", ".");
  let match = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (match) {
    return Number(match[1]) + Number(match[2]) / Number(match[3]);
  }
  match = t.match(/^(\d+)\/(\d+)$/);
  if (match) {
    return Number(match[1]) / Number(match[2]);
  }
  match = t.match(new RegExp("^(\\d*)([" + FRACTION_CHARS + "])$"));
  if (match) {
    return Number(match[1] || 0) + FRACTIONS[match[2]];
  }
  return Number(t);
}

// Shows a number in a kitchen-friendly way: 600, 45, 2½, 1.3 …
export function formatAmount(value) {
  if (value >= 100) {
    return String(Math.round(value / 5) * 5);
  }
  if (value >= 10) {
    return String(Math.round(value));
  }
  const whole = Math.floor(value);
  const rest = value - whole;
  for (const [fraction, symbol] of NICE) {
    if (Math.abs(rest - fraction) < 0.04) {
      if (fraction === 1) {
        return String(whole + 1);
      }
      if (!symbol) {
        return String(whole);
      }
      return (whole ? String(whole) : "") + symbol;
    }
  }
  return String(Math.round(value * 10) / 10);
}

// Multiplies the amounts in one ingredient line. Amounts in brackets
// (like a tin size "(400 g)") are left alone. mark(text) can wrap each
// changed amount, e.g. to highlight it.
export function scaleLine(line, factor, mark) {
  if (factor === 1) {
    return line;
  }
  const wrap = mark || ((text) => text);
  // Split into outside-brackets and inside-brackets parts.
  return line
    .split(/(\([^)]*\))/)
    .map(function (part) {
      if (part.startsWith("(")) {
        return part;
      }
      return part.replace(QUANTITY, function (all, before, first, range, second) {
        const a = formatAmount(parseAmount(first) * factor);
        if (range) {
          const dash = range.includes("–") ? "–" : "-";
          const b = formatAmount(parseAmount(second) * factor);
          return before + wrap(a + dash + b);
        }
        return before + wrap(a);
      });
    })
    .join("");
}

// Next / previous servings or multiplier on the stepper.
export function stepServings(current, direction, hasBase) {
  if (hasBase) {
    return Math.max(1, Math.min(50, current + direction));
  }
  // Without a known base: multiplier in halves (×½, ×1, ×1½ …).
  return Math.max(0.5, Math.min(10, current + direction * 0.5));
}
