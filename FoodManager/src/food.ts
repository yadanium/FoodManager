export type StorageType = "fridge" | "frozen" | "room";

export interface Food {
  id: string;
  name: string;
  expiryDate: string;
  quantity: number;
  storage: StorageType;
}

export interface CreateFoodInput {
  name: string;
  expiryDate: string;
  quantity: number;
  storage: StorageType;
}

export function createFood(input: CreateFoodInput): Food {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    expiryDate: input.expiryDate,
    quantity: input.quantity,
    storage: input.storage,
  };
}
