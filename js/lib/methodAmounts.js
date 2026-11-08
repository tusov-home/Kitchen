// Amounts in the method: when a step mentions an ingredient, its total
// amount from the ingredients list follows in brackets, so there's no
// scrolling up and down: "Add the noodles (400 g) and toss."
// No DOM here, so it can be unit tested.
import { parseIngredient, nameKey } from "./shopping.js";
import { scaleLine } from "./scale.js";
import { ingredientLines } from "./sections.js";

// Words that describe rather than name an ingredient. They never match on
// their own ("red" could be any red thing), only inside the full name.
const DESCRIBING = new Set(
  ("extra virgin plus whole finely roughly chopped sliced diced minced crushed grated dried ground toasted " +
    "cooked raw red white green black yellow light dark low sodium unsalted salted baby free range organic thin " +
    "thick piece pieces optional packed heaped level sweet hot mild smoked plain new").split(" "),
);

function singular(word) {
  if (/(tomato|potato)es$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.length > 3 && /[^su]s$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A word as written in a step: singular or plural.
function wordPattern(word) {
  return escapeRegExp(word) + "(?:e?s)?";
}

// The ingredients with an amount, ready to be found in the method:
// [{ amount: "400 g", words: Set, terms: ["soba noodle", "soba", "noodle"] }].
// factor: the planned servings' factor, so the brackets show what you cook.
export function ingredientRefs(text, factor = 1) {
  const refs = [];
  for (const line of ingredientLines(text)) {
    const cleaned = line.replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
    const parsed = parseIngredient(cleaned);
    const at = cleaned.lastIndexOf(parsed.name);
    const lead = (at > 0 ? cleaned.slice(0, at) : "").replace(/\bof\s*$/i, "").trim();
    if (!/\d|[½⅓⅔¼¾⅛]/.test(lead)) {
      continue; // "salt to taste": nothing to show
    }
    const key = nameKey(parsed.name);
    const words = key.split(" ").filter((word) => word.length >= 3);
    if (!words.length) {
      continue;
    }
    const terms = new Set();
    if (words.length > 1) {
      terms.add(words.join(" "));
    }
    for (const word of words) {
      if (!DESCRIBING.has(word)) {
        terms.add(word);
      }
    }
    refs.push({ amount: scaleLine(lead, factor), words: new Set(words), terms: [...terms] });
  }
  // A single word two ingredients share ("oil" in olive oil and sesame oil)
  // would be a guess, so neither gets it.
  const count = new Map();
  for (const ref of refs) {
    for (const term of ref.terms) {
      count.set(term, (count.get(term) || 0) + 1);
    }
  }
  for (const ref of refs) {
    ref.terms = ref.terms.filter((term) => count.get(term) === 1).sort((a, b) => b.length - a.length);
  }
  return refs.filter((ref) => ref.terms.length);
}

// One method step with the amounts added after the first mention of each
// ingredient. mark(text) can wrap the "(400 g)" part, e.g. to style it.
export function addAmounts(step, refs, mark = (text) => text) {
  const found = [];
  for (const ref of refs) {
    const pattern = new RegExp(
      "\\b(?:" + ref.terms.map((term) => term.split(" ").map(wordPattern).join("\\s+")).join("|") + ")\\b",
      "i",
    );
    const match = pattern.exec(step);
    if (!match) {
      continue;
    }
    let end = match.index + match[0].length;
    // "garlic cloves": take the rest of the name along, the amount goes after it
    for (;;) {
      const next = /^\s+([A-Za-zÀ-ÿ'-]+)/.exec(step.slice(end));
      if (!next || !ref.words.has(singular(next[1].toLowerCase()))) {
        break;
      }
      end += next[0].length;
    }
    // The step gives an amount itself ("200 g rice", "3 eggs") or has a
    // bracket right after it? Leave the step as written.
    const before = step.slice(0, match.index);
    if (/[\d½⅓⅔¼¾⅛]\s*(?:[a-z]{1,6}\.?\s+)?(?:of\s+)?$/i.test(before) || /^\s*\(/.test(step.slice(end))) {
      continue;
    }
    found.push({ start: match.index, end: end, amount: ref.amount });
  }
  // Two ingredients on the same words: the first one found keeps them.
  found.sort((a, b) => a.start - b.start);
  const kept = [];
  for (const item of found) {
    if (!kept.length || item.start >= kept[kept.length - 1].end) {
      kept.push(item);
    }
  }
  let result = step;
  for (const item of kept.reverse()) {
    result = result.slice(0, item.end) + " " + mark("(" + item.amount + ")") + result.slice(item.end);
  }
  return result;
}
