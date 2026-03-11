import type { Food } from "./food";

const FOOD_STORAGE_KEY = "food-manager-foods";

export function loadFoods(): Food[] {
  const raw = localStorage.getItem(FOOD_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isFood);
  } catch {
    return [];
  }
}

export function saveFoods(foods: Food[]): void {
  localStorage.setItem(FOOD_STORAGE_KEY, JSON.stringify(foods));
}

function isFood(value: unknown): value is Food {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Food>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.expiryDate === "string" &&
    typeof candidate.quantity === "number" &&
    (candidate.storage === "fridge" ||
      candidate.storage === "frozen" ||
      candidate.storage === "room")
  );
}
