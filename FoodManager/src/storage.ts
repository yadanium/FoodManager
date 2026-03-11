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
  const validRemainingRatio =
    candidate.remainingRatio === undefined ||
    (typeof candidate.remainingRatio === "number" &&
      candidate.remainingRatio >= 0 &&
      candidate.remainingRatio <= 100);

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.expiryDate === "string" &&
    typeof candidate.quantity === "number" &&
    validRemainingRatio &&
    (candidate.category === undefined ||
      candidate.category === "vegetable" ||
      candidate.category === "meat" ||
      candidate.category === "fish" ||
      candidate.category === "dairy" ||
      candidate.category === "cooked" ||
      candidate.category === "other") &&
    (candidate.imageDataUrl === undefined ||
      typeof candidate.imageDataUrl === "string") &&
    (candidate.storage === "fridge" ||
      candidate.storage === "frozen" ||
      candidate.storage === "room")
  );
}
