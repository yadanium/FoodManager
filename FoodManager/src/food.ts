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
  imageDataUrl?: string;
}

export interface CreateFoodInput {
  name: string;
  expiryDate: string;
  quantity: number;
  remainingRatio?: number;
  storage: StorageType;
  category: FoodCategory;
  imageDataUrl?: string;
}

export function createFood(input: CreateFoodInput): Food {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    expiryDate: input.expiryDate,
    quantity: input.quantity,
    remainingRatio: input.remainingRatio ?? 100,
    storage: input.storage,
    category: input.category,
    imageDataUrl: input.imageDataUrl,
  };
}
