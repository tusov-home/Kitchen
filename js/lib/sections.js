// Rules for finding the ingredients part of a recipe. Shared by the
// recipe view (which scales only that part) and the shopping list
// (which collects only those lines), so both always agree.

export const INGREDIENT_WORDS = /ingredient|zutaten|koostisosa|ingredienser|you(?:'ll)? need|shopping list/i;
export const METHOD_WORDS = /method|instruction|steps?\b|direction|preparation|how to|zubereitung|anleitung|valmista|gör så här|tillagning/i;
export const STARTS_WITH_AMOUNT = /^[\d½⅓⅔¼¾⅛]/;

// A short line like "**Ingredients**" or "Method:" that works as a heading.
// It must be bold, end with ":", or be at most three words, and not
// start with an amount.
export function pseudoHeading(line) {
  const match = line.match(/^\**\s*([^*]{2,40}?)\s*:?\s*\**\s*:?$/);
  if (!match || STARTS_WITH_AMOUNT.test(match[1])) {
    return null;
  }
  const looksLikeHeading =
    line.startsWith("**") || line.endsWith(":") || match[1].split(/\s+/).length <= 3;
  return looksLikeHeading ? match[1] : null;
}

// Heading text of a line ("## Ingredients" or "**Method**"), with its
// level (1–6 for #, 7 for heading-like lines), or null.
export function headingOf(line) {
  const trimmed = line.trim();
  const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    return { text: heading[2], level: heading[1].length };
  }
  const pseudo = pseudoHeading(trimmed);
  if (pseudo !== null && (INGREDIENT_WORDS.test(pseudo) || METHOD_WORDS.test(pseudo))) {
    return { text: pseudo, level: 7 };
  }
  return null;
}

// Keeps track of whether we are inside the ingredients part while
// going through a recipe line by line.
export function createSectionTracker(lines) {
  const hasIngredientSection = lines.some(function (line) {
    const heading = headingOf(line);
    return heading !== null && INGREDIENT_WORDS.test(heading.text);
  });
  let inIngredients = false;
  let ingredientsLevel = 0;

  return {
    hasIngredientSection: hasIngredientSection,
    isInIngredients: () => inIngredients,
    // Call for every heading; returns nothing.
    heading: function (text, level) {
      if (INGREDIENT_WORDS.test(text)) {
        inIngredients = true;
        ingredientsLevel = level;
      } else if (inIngredients && (METHOD_WORDS.test(text) || level <= ingredientsLevel)) {
        inIngredients = false;
      }
    },
  };
}

// The ingredient lines of a recipe, without "- " or "1. " in front.
// With an "Ingredients" heading: every list item or amount line in that
// part. Without one: bullet points that start with an amount.
export function ingredientLines(text) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const tracker = createSectionTracker(lines);
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("|")) {
      continue;
    }
    const heading = headingOf(trimmed);
    if (heading) {
      tracker.heading(heading.text, heading.level);
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    const content = bullet ? bullet[1] : numbered ? numbered[1] : trimmed;

    if (tracker.hasIngredientSection) {
      if (tracker.isInIngredients() && (bullet || numbered || STARTS_WITH_AMOUNT.test(trimmed))) {
        result.push(content);
      }
    } else if (bullet && STARTS_WITH_AMOUNT.test(content)) {
      result.push(content);
    }
  }
  return result;
}
