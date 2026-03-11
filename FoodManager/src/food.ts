export type StorageType = "fridge" | "frozen" | "room";
export type FoodCategory =
  | "vegetable"
  | "meat"
  | "fish"
  | "dairy"
  | "cooked"
  | "other";

export interface Food {
  id: string;
  name: string;
  expiryDate: string;
  quantity: number;
  remainingRatio: number;
  storage: StorageType;
  category: FoodCategory;
  quantityUnit: string;
  iconEmoji: string;
  createdAt: string;
  updatedAt: string;
  imageDataUrl?: string;
}

export interface CreateFoodInput {
  name: string;
  expiryDate: string;
  quantity: number;
  remainingRatio?: number;
  storage: StorageType;
  category: FoodCategory;
  quantityUnit: string;
  iconEmoji?: string;
  createdAt?: string;
  updatedAt?: string;
  imageDataUrl?: string;
}

export function createFood(input: CreateFoodInput): Food {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    expiryDate: input.expiryDate,
    quantity: input.quantity,
    remainingRatio: input.remainingRatio ?? 100,
    storage: input.storage,
    category: input.category,
    quantityUnit: input.quantityUnit,
    iconEmoji: input.iconEmoji ?? "🥫",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    imageDataUrl: input.imageDataUrl,
  };
}
