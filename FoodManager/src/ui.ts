import {
  createFood,
  type Food,
  type FoodCategory,
  type StorageType,
} from "./food";
import { calculateDiffDays, calculateFoodScore } from "./score";
import { loadFoods, saveFoods } from "./storage";

const STORAGE_LABELS: Record<StorageType, string> = {
  fridge: "冷蔵",
  frozen: "冷凍",
  room: "常温",
};

const CATEGORY_LABELS: Record<FoodCategory, string> = {
  vegetable: "野菜",
  meat: "肉",
  fish: "魚",
  dairy: "乳製品",
  cooked: "調理済み",
  other: "その他",
};

const CATEGORY_BASE_DAYS: Record<FoodCategory, number> = {
  vegetable: 4,
  meat: 2,
  fish: 2,
  dairy: 5,
  cooked: 3,
  other: 5,
};

const STORAGE_DAY_BONUS: Record<StorageType, number> = {
  fridge: 0,
  frozen: 20,
  room: -1,
};

interface AppState {
  foods: Food[];
  pendingImageDataUrl?: string;
}

export function createApp(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  const state: AppState = {
    foods: sortFoodsByScore(normalizeFoods(loadFoods())),
    pendingImageDataUrl: undefined,
  };

  render(root, state);
}

function render(root: HTMLDivElement, state: AppState): void {
  const priorityFoods = state.foods.slice(0, 3);
  const suggestedDate = getSuggestedExpiryDate("vegetable", "fridge");
  const suggestedText = `${suggestedDate}（目安${CATEGORY_BASE_DAYS.vegetable}日）`;

  root.innerHTML = `
    <main class="container">
      <header class="header">
        <h1>Food Manager</h1>
        <p>冷蔵庫の食材を賞味期限付きで管理</p>
      </header>

      <section class="card">
        <h2>今日の優先食材（上位3件）</h2>
        <ul class="priority-list">
          ${
            priorityFoods.length === 0
              ? `<li class="empty">食材がありません</li>`
              : priorityFoods.map(renderPriorityItem).join("")
          }
        </ul>
      </section>

      <section class="card">
        <h2>食材一覧</h2>
        <ul class="food-list">
          ${
            state.foods.length === 0
              ? `<li class="empty">まだ登録されていません</li>`
              : state.foods.map(renderFoodListItem).join("")
          }
        </ul>
      </section>

      <section class="card">
        <h2>食材追加</h2>
        <form id="food-form" class="food-form">
          <label>
            カテゴリ
            <select name="category" required>
              <option value="vegetable">野菜</option>
              <option value="meat">肉</option>
              <option value="fish">魚</option>
              <option value="dairy">乳製品</option>
              <option value="cooked">調理済み</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label>
            食材名
            <input name="name" type="text" required maxlength="50" />
          </label>
          <label>
            賞味期限
            <input name="expiryDate" type="date" required />
            <span class="hint" id="expiry-suggestion">提案: ${suggestedText}</span>
            <button type="button" class="secondary" id="apply-expiry-suggestion">提案日を適用</button>
          </label>
          <label>
            量（手入力）
            <input
              name="quantity"
              type="number"
              min="0.1"
              step="0.1"
              value="1"
              required
            />
          </label>
          <label>
            保存場所
            <select name="storage" required>
              <option value="fridge">冷蔵</option>
              <option value="frozen">冷凍</option>
              <option value="room">常温</option>
            </select>
          </label>
          <label>
            食材写真（スマホはカメラ起動）
            <input
              id="camera-input"
              name="photo"
              type="file"
              accept="image/*"
              capture="environment"
            />
          </label>
          ${
            state.pendingImageDataUrl
              ? `<img class="preview-image" src="${state.pendingImageDataUrl}" alt="撮影プレビュー" />`
              : ""
          }
          <button type="submit">追加する</button>
        </form>
      </section>
    </main>
  `;

  bindEvents(root, state);
}

function bindEvents(root: HTMLDivElement, state: AppState): void {
  const form = root.querySelector<HTMLFormElement>("#food-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const name = String(formData.get("name") ?? "").trim();
      const expiryDate = String(formData.get("expiryDate") ?? "");
      const quantity = Number(formData.get("quantity"));
      const storage = String(formData.get("storage") ?? "") as StorageType;
      const category = String(formData.get("category") ?? "") as FoodCategory;

      if (
        !name ||
        !expiryDate ||
        quantity <= 0 ||
        !isStorageType(storage) ||
        !isFoodCategory(category)
      ) {
        return;
      }

      const newFood = createFood({
        name,
        expiryDate,
        quantity,
        remainingRatio: 100,
        storage,
        category,
        imageDataUrl: state.pendingImageDataUrl,
      });

      state.foods = sortFoodsByScore([...state.foods, newFood]);
      state.pendingImageDataUrl = undefined;
      saveFoods(state.foods);
      render(root, state);
    });
  }

  const cameraInput = root.querySelector<HTMLInputElement>("#camera-input");
  if (cameraInput) {
    cameraInput.addEventListener("change", async () => {
      const file = cameraInput.files?.[0];
      if (!file) {
        state.pendingImageDataUrl = undefined;
        render(root, state);
        return;
      }

      state.pendingImageDataUrl = await readFileAsDataUrl(file);
      render(root, state);
    });
  }

  const suggestionLabel = root.querySelector<HTMLSpanElement>("#expiry-suggestion");
  const applySuggestionButton = root.querySelector<HTMLButtonElement>(
    "#apply-expiry-suggestion",
  );
  const expiryInput = root.querySelector<HTMLInputElement>('input[name="expiryDate"]');
  const storageInput = root.querySelector<HTMLSelectElement>('select[name="storage"]');
  const categoryInput = root.querySelector<HTMLSelectElement>('select[name="category"]');
  const refreshSuggestion = (): void => {
    if (!suggestionLabel || !storageInput || !categoryInput) {
      return;
    }
    const storage = storageInput.value as StorageType;
    const category = categoryInput.value as FoodCategory;
    if (!isStorageType(storage) || !isFoodCategory(category)) {
      return;
    }
    const dayCount = getSuggestedShelfLifeDays(category, storage);
    const suggested = getSuggestedExpiryDate(category, storage);
    suggestionLabel.textContent = `提案: ${suggested}（目安${dayCount}日）`;
    applySuggestionButton?.setAttribute("data-suggested-date", suggested);
  };

  storageInput?.addEventListener("change", refreshSuggestion);
  categoryInput?.addEventListener("change", refreshSuggestion);
  applySuggestionButton?.addEventListener("click", () => {
    const suggested = applySuggestionButton.getAttribute("data-suggested-date");
    if (expiryInput && suggested) {
      expiryInput.value = suggested;
    }
  });
  refreshSuggestion();

  const deleteButtons = root.querySelectorAll<HTMLButtonElement>("[data-delete-id]");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteId;
      if (!id) {
        return;
      }

      state.foods = state.foods.filter((food) => food.id !== id);
      saveFoods(state.foods);
      render(root, state);
    });
  });

  const ratioSliders = root.querySelectorAll<HTMLInputElement>("[data-ratio-id]");
  ratioSliders.forEach((slider) => {
    slider.addEventListener("input", () => {
      const id = slider.dataset.ratioId;
      if (!id) {
        return;
      }
      const valueLabel = root.querySelector<HTMLElement>(`[data-ratio-value-id="${id}"]`);
      if (valueLabel) {
        valueLabel.textContent = `${slider.value}%`;
      }
    });
    slider.addEventListener("change", () => {
      const id = slider.dataset.ratioId;
      if (!id) {
        return;
      }
      const newRatio = Number(slider.value);
      state.foods = sortFoodsByScore(
        state.foods.map((food) =>
          food.id === id ? { ...food, remainingRatio: newRatio } : food,
        ),
      );
      saveFoods(state.foods);
      render(root, state);
    });
  });
}

function sortFoodsByScore(foods: Food[]): Food[] {
  return [...foods].sort((a, b) => calculateFoodScore(b) - calculateFoodScore(a));
}

function renderPriorityItem(food: Food): string {
  const diffDays = calculateDiffDays(food.expiryDate);
  const statusClass = getUrgencyClass(diffDays);
  const statusText = getDiffDaysText(diffDays);

  return `
    <li class="priority-item ${statusClass}">
      <strong>${escapeHtml(food.name)}</strong>
      <span>${statusText}</span>
    </li>
  `;
}

function renderFoodListItem(food: Food): string {
  const diffDays = calculateDiffDays(food.expiryDate);
  const score = calculateFoodScore(food).toFixed(1);
  const statusClass = getUrgencyClass(diffDays);
  const statusText = getDiffDaysText(diffDays);
  const remainingQuantity = (food.quantity * (food.remainingRatio / 100)).toFixed(1);

  return `
    <li class="food-item">
      <div>
        <p class="food-name">${escapeHtml(food.name)}</p>
        <p class="food-meta">
          ${CATEGORY_LABELS[food.category]} / ${STORAGE_LABELS[food.storage]} / 入力量${food.quantity} / 残り${remainingQuantity} / ${statusText} / score: ${score}
        </p>
        <label class="ratio-control">
          残量: <span data-ratio-value-id="${food.id}">${food.remainingRatio}%</span>
          <input type="range" min="0" max="100" step="5" value="${food.remainingRatio}" data-ratio-id="${food.id}" />
        </label>
      </div>
      <div class="food-actions">
        ${
          food.imageDataUrl
            ? `<img class="food-thumb" src="${food.imageDataUrl}" alt="${escapeHtml(food.name)}の写真" />`
            : ""
        }
        <span class="tag ${statusClass}">${statusText}</span>
        <button type="button" data-delete-id="${food.id}">削除</button>
      </div>
    </li>
  `;
}

function getUrgencyClass(diffDays: number): string {
  if (diffDays <= 0) return "status-expired";
  if (diffDays <= 1) return "status-1day";
  if (diffDays <= 3) return "status-2to3day";
  return "status-safe";
}

function getDiffDaysText(diffDays: number): string {
  if (diffDays < 0) return `${Math.abs(diffDays)}日超過`;
  if (diffDays === 0) return "期限切れ";
  return `残り${diffDays}日`;
}

function isStorageType(value: string): value is StorageType {
  return value === "fridge" || value === "frozen" || value === "room";
}

function isFoodCategory(value: string): value is FoodCategory {
  return (
    value === "vegetable" ||
    value === "meat" ||
    value === "fish" ||
    value === "dairy" ||
    value === "cooked" ||
    value === "other"
  );
}

function getSuggestedShelfLifeDays(
  category: FoodCategory,
  storage: StorageType,
): number {
  return Math.max(CATEGORY_BASE_DAYS[category] + STORAGE_DAY_BONUS[storage], 1);
}

function getSuggestedExpiryDate(
  category: FoodCategory,
  storage: StorageType,
): string {
  const date = new Date();
  date.setDate(date.getDate() + getSuggestedShelfLifeDays(category, storage));
  return date.toISOString().slice(0, 10);
}

function normalizeFoods(foods: Food[]): Food[] {
  return foods.map((food) => {
    const ratio =
      typeof food.remainingRatio === "number"
        ? Math.min(Math.max(food.remainingRatio, 0), 100)
        : 100;
    const category = isFoodCategory(food.category) ? food.category : "other";
    return {
      ...food,
      remainingRatio: ratio,
      category,
    };
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
