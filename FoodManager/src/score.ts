import type { Food } from "./food";

const DAY_MS = 1000 * 60 * 60 * 24;

const STORAGE_FACTOR: Record<Food["storage"], number> = {
  fridge: 1.0,
  frozen: 0.3,
  room: 0.8,
};

export function calculateDiffDays(expiryDate: string): number {
  const today = new Date();
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const expiry = new Date(expiryDate);
  const normalizedExpiry = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate(),
  );

  return Math.floor((normalizedExpiry.getTime() - normalizedToday.getTime()) / DAY_MS);
}

export function calculateDangerBonus(diffDays: number): number {
  if (diffDays <= 0) {
    return 100;
  }
  if (diffDays <= 1) {
    return 50;
  }
  return 0;
}

export function calculateFoodScore(food: Food): number {
  const diffDays = calculateDiffDays(food.expiryDate);
  const storageFactor = STORAGE_FACTOR[food.storage];
  const dangerBonus = calculateDangerBonus(diffDays);

  return -diffDays * storageFactor + dangerBonus + food.quantity * 0.5;
}
