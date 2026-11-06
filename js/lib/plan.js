// The household's cooking plan: the meals you mean to cook, first to shop
// for, then to review once eaten. Pure helpers, no DOM.
//
// One shared plan (id "current") with a map of meals by recipe id:
// { factor, shopped, cooked, removed, added, at }. `added` keeps the
// order: ticking or rating a meal must not move it. Meals are timestamped
// entries, so both phones can change different meals at the same time.
// Finishing a plan marks every meal removed; the plan itself stays.

export const PLAN_ID = "current";

function normaliseMeal(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const factor = Number(raw.factor);
  return {
    factor: factor > 0 ? factor : 1,
    shopped: raw.shopped === true,
    cooked: raw.cooked === true,
    removed: raw.removed === true,
    added: Number(raw.added) || Number(raw.at) || 0,
    at: Number(raw.at) || 0,
  };
}

export function normalisePlan(raw) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    return null;
  }
  const meals = {};
  for (const [id, entry] of Object.entries(raw.meals || {})) {
    const meal = normaliseMeal(entry);
    if (meal) {
      meals[id] = meal;
    }
  }
  return { id: raw.id, meals: meals, updatedAt: Number(raw.updatedAt) || 0, deleted: raw.deleted === true };
}

// Two versions of the plan: each meal keeps its newest version.
export function mergePlan(a, b) {
  const meals = Object.assign({}, a.meals);
  for (const [id, meal] of Object.entries(b.meals)) {
    if (!meals[id] || meal.at > meals[id].at) {
      meals[id] = meal;
    }
  }
  const newer = b.updatedAt > a.updatedAt ? b : a;
  return Object.assign({}, newer, { meals: meals, updatedAt: Math.max(a.updatedAt, b.updatedAt) });
}

// The meals in the plan, in the order they were added.
export function planMeals(plan) {
  if (!plan) {
    return [];
  }
  return Object.entries(plan.meals)
    .filter(([, meal]) => !meal.removed)
    .map(([id, meal]) => Object.assign({ id: id }, meal))
    .sort((a, b) => (a.added || a.at) - (b.added || b.at));
}

// One step more (+1) or fewer (-1) servings. With a known number of
// servings it moves one serving at a time; otherwise by halves.
export function stepFactor(factor, base, direction) {
  if (base) {
    const servings = Math.max(1, Math.round(factor * base) + direction);
    return servings / base;
  }
  return Math.max(0.5, factor + direction * 0.5);
}
