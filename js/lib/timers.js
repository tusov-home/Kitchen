// Finding cooking times in recipe text ("20 min", "1 hour 30 minutes",
// "10–12 minutes", "half an hour"), naming a timer after its step, and
// showing time left as a clock. No DOM here, so it can be unit tested.

const NUMBER = String.raw`(?:\d+(?:[.,]\d+)?\s*[½¼¾]?|[½¼¾])`;
const UNITS = {
  hour: String.raw`hours?|hrs?|h`,
  minute: String.raw`minutes?|mins?`,
  second: String.raw`seconds?|secs?`,
};
const SECONDS = { hour: 3600, minute: 60, second: 1 };

// One amount with its unit: "20 min", "10–12 minutes", "1½ hours".
const PART = String.raw`(${NUMBER})(?:\s*(?:–|-|to)\s*${NUMBER})?\s*(${UNITS.hour}|${UNITS.minute}|${UNITS.second})\b\.?`;
// An hour part may be followed by minutes: "1 hour 30 minutes", "1 h and 15 min".
const PATTERN = new RegExp(
  String.raw`\bhalf an hour\b|\ban hour\b|` + PART + String.raw`(?:\s*(?:and\s*)?(${NUMBER})\s*(${UNITS.minute})\b\.?)?`,
  "gi",
);

function toNumber(text) {
  const fractions = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
  const trimmed = text.trim();
  const last = trimmed.slice(-1);
  if (fractions[last] !== undefined) {
    const whole = trimmed.slice(0, -1).trim();
    return (whole ? Number(whole.replace(",", ".")) : 0) + fractions[last];
  }
  return Number(trimmed.replace(",", "."));
}

function unitOf(text) {
  const lower = text.toLowerCase();
  for (const unit of Object.keys(UNITS)) {
    if (new RegExp("^(?:" + UNITS[unit] + ")$").test(lower)) {
      return unit;
    }
  }
  return "minute";
}

// Every cooking time in a text: [{ start, end, seconds }]. A range starts
// the timer at its shorter end, so you check in time.
export function findDurations(text) {
  const found = [];
  for (const match of text.matchAll(PATTERN)) {
    const words = match[0].toLowerCase();
    let seconds;
    if (words.startsWith("half an hour")) {
      seconds = 1800;
    } else if (words.startsWith("an hour")) {
      seconds = 3600;
    } else {
      const unit = unitOf(match[2]);
      seconds = toNumber(match[1]) * SECONDS[unit];
      if (unit === "hour" && match[3]) {
        seconds += toNumber(match[3]) * 60;
      }
    }
    seconds = Math.round(seconds);
    if (seconds > 0 && seconds <= 24 * 3600) {
      // A trailing full stop ends the sentence; it isn't part of the time.
      const text = match[0].replace(/\.$/, "");
      found.push({ start: match.index, end: match.index + text.length, seconds: seconds });
    }
  }
  return found;
}

// A short name for a timer: the first word of the part of the step the time
// belongs to ("Roast", "Simmer"; "…, then grill 3 min" gives "Grill"), two
// words if the first is tiny ("Let rest").
export function timerLabel(text, index) {
  const before = text.slice(0, index);
  const clauseStart = Math.max(...[". ", "\n", "! ", "? ", ", ", "; "].map((mark) => {
    const at = before.lastIndexOf(mark);
    return at < 0 ? -1 : at + mark.length - 1;
  }));
  const sentence = text
    .slice(clauseStart + 1)
    .replace(/^[\s\d.)*•-]+/, "")
    .replace(/^step\s*\d+[:.]?\s*/i, "")
    .replace(/^(?:then|and|or)\s+/i, "");
  const words = sentence.split(/\s+/).filter(Boolean).map((word) => word.replace(/[,;:]$/, ""));
  if (!words.length) {
    return "Timer";
  }
  const label = words[0].length <= 3 && words[1] ? words[0] + " " + words[1] : words[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Time left as a clock: "4:05", "1:02:30".
export function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours ? hours + ":" + String(minutes).padStart(2, "0") + ":" + secs : minutes + ":" + secs;
}
