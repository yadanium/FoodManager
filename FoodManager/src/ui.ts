import { createFood, type Food, type FoodCategory, type StorageType } from "./food";
import { calculateDiffDays } from "./score";
import { loadFoods, saveFoods } from "./storage";

interface IngredientTemplate {
  name: string;
  category: FoodCategory;
  iconEmoji: string;
  quantityUnit: string;
  defaultQuantity: number;
  shelfLifeDays: number;
}

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

const CATEGORY_ICON: Record<FoodCategory, string> = {
  vegetable: "🥬",
  meat: "🥩",
  fish: "🐟",
  dairy: "🥛",
  cooked: "🍱",
  other: "🥫",
};

const STORAGE_DAY_BONUS: Record<StorageType, number> = {
  fridge: 0,
  frozen: 20,
  room: -1,
};

const INGREDIENT_TEMPLATES: IngredientTemplate[] = [
  { name: "にんじん", category: "vegetable", iconEmoji: "🥕", quantityUnit: "本", defaultQuantity: 2, shelfLifeDays: 7 },
  { name: "キャベツ", category: "vegetable", iconEmoji: "🥬", quantityUnit: "玉", defaultQuantity: 0.5, shelfLifeDays: 7 },
  { name: "玉ねぎ", category: "vegetable", iconEmoji: "🧅", quantityUnit: "個", defaultQuantity: 1, shelfLifeDays: 14 },
  { name: "じゃがいも", category: "vegetable", iconEmoji: "🥔", quantityUnit: "個", defaultQuantity: 3, shelfLifeDays: 14 },
  { name: "鶏むね肉", category: "meat", iconEmoji: "🍗", quantityUnit: "g", defaultQuantity: 300, shelfLifeDays: 2 },
  { name: "豚こま肉", category: "meat", iconEmoji: "🥩", quantityUnit: "g", defaultQuantity: 250, shelfLifeDays: 2 },
  { name: "鮭", category: "fish", iconEmoji: "🐟", quantityUnit: "切れ", defaultQuantity: 2, shelfLifeDays: 2 },
  { name: "牛乳", category: "dairy", iconEmoji: "🥛", quantityUnit: "ml", defaultQuantity: 500, shelfLifeDays: 4 },
  { name: "ヨーグルト", category: "dairy", iconEmoji: "🥣", quantityUnit: "g", defaultQuantity: 400, shelfLifeDays: 6 },
];

interface AppState {
  foods: Food[];
  selectedFoodId?: string;
  pendingImageDataUrl?: string;
  pendingEditImageDataUrl?: string;
}

const CUSTOM_NAME_VALUE = "__custom__";

export function createApp(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  const state: AppState = {
    foods: sortFoodsByPriority(normalizeFoods(loadFoods())),
    selectedFoodId: undefined,
    pendingImageDataUrl: undefined,
    pendingEditImageDataUrl: undefined,
  };

  render(root, state);
}

function render(root: HTMLDivElement, state: AppState): void {
  if (state.selectedFoodId) {
    const target = state.foods.find((food) => food.id === state.selectedFoodId);
    if (target) {
      root.innerHTML = renderDetail(target, state.pendingEditImageDataUrl);
      bindDetailEvents(root, state, target);
      return;
    }
    state.selectedFoodId = undefined;
  }

  root.innerHTML = renderHome(state);
  bindHomeEvents(root, state);
}

function renderHome(state: AppState): string {
  const suggestedDate = getSuggestedExpiryDate("vegetable", "fridge", "にんじん");
  const dayCount = getSuggestedShelfLifeDays("vegetable", "fridge", "にんじん");
  return `
    <main class="container">
      <header class="header">
        <h1>Food Manager</h1>
        <p>食材を期限優先で管理</p>
      </header>

      <section class="card">
        <h2>ホーム（期限優先リスト）</h2>
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
            食材カテゴリ
            <select name="category" id="add-category" required>
              <option value="vegetable">野菜</option>
              <option value="meat">肉</option>
              <option value="fish">魚</option>
              <option value="dairy">乳製品</option>
              <option value="cooked">調理済み</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label>
            食材名（カテゴリ内から選択）
            <select name="nameSelect" id="add-name-select" required>
              ${renderIngredientSelectOptions("vegetable")}
              <option value="${CUSTOM_NAME_VALUE}">選択肢にない（自由入力）</option>
            </select>
          </label>
          <label id="custom-name-label" class="hidden">
            食材名（自由入力）
            <input name="nameCustom" id="add-name-custom" type="text" maxlength="50" />
          </label>
          <label>
            保存場所
            <select name="storage" id="add-storage" required>
              <option value="fridge">冷蔵</option>
              <option value="frozen">冷凍</option>
              <option value="room">常温</option>
            </select>
          </label>
          <label>
            賞味期限
            <input name="expiryDate" id="add-expiry" type="date" required />
            <span class="hint" id="expiry-suggestion">提案: ${suggestedDate}（目安${dayCount}日）</span>
            <button type="button" class="secondary" id="apply-expiry-suggestion">提案日を適用</button>
          </label>
          <label>
            量
            <div class="quantity-row">
              <input name="quantity" id="add-quantity" type="number" min="0.1" step="0.1" value="2" required />
              <input name="quantityUnit" id="add-quantity-unit" type="text" value="本" required />
            </div>
            <span class="hint">例: にんじんなら本数、キャベツなら0.5玉、肉ならg入力</span>
          </label>
          <label>
            食材写真（未設定時は絵文字アイコン）
            <input id="camera-input" name="photo" type="file" accept="image/*" capture="environment" />
          </label>
          ${
            state.pendingImageDataUrl
              ? `<img class="preview-image" src="${state.pendingImageDataUrl}" alt="撮影プレビュー" />`
              : ""
          }
          <button type="submit">登録する</button>
        </form>
      </section>
    </main>
  `;
}

function renderDetail(food: Food, pendingImageDataUrl?: string): string {
  const diffDays = calculateDiffDays(food.expiryDate);
  const statusText = getDiffDaysText(diffDays);
  const imageToShow = pendingImageDataUrl ?? food.imageDataUrl;
  return `
    <main class="container">
      <header class="header">
        <h1>食材詳細</h1>
        <p>${escapeHtml(food.name)} を編集</p>
      </header>

      <section class="card">
        <form id="food-edit-form" class="food-form" data-edit-id="${food.id}">
          <label>
            食材名
            <input name="name" type="text" value="${escapeHtml(food.name)}" required maxlength="50" />
          </label>
          <label>
            食材カテゴリ
            <select name="category" required>
              ${renderCategoryOptions(food.category)}
            </select>
          </label>
          <label>
            保存場所
            <select name="storage" required>
              ${renderStorageOptions(food.storage)}
            </select>
          </label>
          <label>
            賞味期限
            <input name="expiryDate" type="date" value="${food.expiryDate}" required />
            <span class="hint">${statusText}</span>
          </label>
          <label>
            使用後の残量を再入力
            <div class="quantity-row">
              <input name="quantity" type="number" min="0.1" step="0.1" value="${food.quantity}" required />
              <input name="quantityUnit" type="text" value="${escapeHtml(food.quantityUnit)}" required />
            </div>
          </label>
          <label>
            残量割合
            <input name="remainingRatio" type="range" min="0" max="100" step="5" value="${food.remainingRatio}" />
            <span class="hint" id="edit-ratio-value">${food.remainingRatio}%</span>
          </label>
          <label>
            写真の更新
            <input id="edit-camera-input" type="file" accept="image/*" capture="environment" />
          </label>
          ${
            imageToShow
              ? `<img class="preview-image" src="${imageToShow}" alt="食材画像" />`
              : `<div class="emoji-preview">${food.iconEmoji}</div>`
          }
          <p class="hint">最終更新: ${formatDateTime(food.updatedAt)}</p>
          <button type="submit">登録して更新</button>
          <button type="button" class="secondary" id="back-home-button">ホームへ戻る</button>
          <button type="button" class="danger" data-delete-id="${food.id}">削除</button>
        </form>
      </section>
    </main>
  `;
}

function bindHomeEvents(root: HTMLDivElement, state: AppState): void {
  const form = root.querySelector<HTMLFormElement>("#food-form");
  const categoryInput = root.querySelector<HTMLSelectElement>("#add-category");
  const nameSelectInput = root.querySelector<HTMLSelectElement>("#add-name-select");
  const customNameLabel = root.querySelector<HTMLLabelElement>("#custom-name-label");
  const customNameInput = root.querySelector<HTMLInputElement>("#add-name-custom");
  const storageInput = root.querySelector<HTMLSelectElement>("#add-storage");
  const expiryInput = root.querySelector<HTMLInputElement>("#add-expiry");
  const quantityInput = root.querySelector<HTMLInputElement>("#add-quantity");
  const quantityUnitInput = root.querySelector<HTMLInputElement>("#add-quantity-unit");
  const suggestionLabel = root.querySelector<HTMLSpanElement>("#expiry-suggestion");
  const applySuggestionButton = root.querySelector<HTMLButtonElement>("#apply-expiry-suggestion");
  const cameraInput = root.querySelector<HTMLInputElement>("#camera-input");

  const getCurrentInputName = (): string => {
    if (!nameSelectInput) return "";
    if (nameSelectInput.value === CUSTOM_NAME_VALUE) {
      return customNameInput?.value.trim() ?? "";
    }
    return nameSelectInput.value.trim();
  };

  const refreshNameOptions = (): void => {
    if (!nameSelectInput || !categoryInput) return;
    const category = categoryInput.value as FoodCategory;
    if (!isFoodCategory(category)) return;
    const options = renderIngredientSelectOptions(category);
    nameSelectInput.innerHTML = `${options}<option value="${CUSTOM_NAME_VALUE}">選択肢にない（自由入力）</option>`;
  };

  const toggleCustomInput = (): void => {
    if (!nameSelectInput || !customNameLabel || !customNameInput) return;
    const showCustom = nameSelectInput.value === CUSTOM_NAME_VALUE;
    customNameLabel.classList.toggle("hidden", !showCustom);
    customNameInput.required = showCustom;
    if (!showCustom) {
      customNameInput.value = "";
    }
  };

  const refreshByName = (): void => {
    if (!categoryInput || !quantityInput || !quantityUnitInput) {
      return;
    }
    const name = getCurrentInputName();
    const template = findTemplateByName(name);
    if (template) {
      categoryInput.value = template.category;
      quantityUnitInput.value = template.quantityUnit;
      if (!quantityInput.dataset.editedQuantity) {
        quantityInput.value = String(template.defaultQuantity);
      }
    }
    refreshSuggestion();
  };

  const refreshSuggestion = (): void => {
    if (!suggestionLabel || !categoryInput || !storageInput) return;
    const storage = storageInput.value as StorageType;
    const category = categoryInput.value as FoodCategory;
    if (!isStorageType(storage) || !isFoodCategory(category)) return;
    const name = getCurrentInputName();
    const dayCount = getSuggestedShelfLifeDays(category, storage, name);
    const suggested = getSuggestedExpiryDate(category, storage, name);
    suggestionLabel.textContent = `提案: ${suggested}（目安${dayCount}日）`;
    applySuggestionButton?.setAttribute("data-suggested-date", suggested);
  };

  quantityInput?.addEventListener("input", () => {
    if (!quantityInput) return;
    quantityInput.dataset.editedQuantity = "1";
  });
  nameSelectInput?.addEventListener("change", () => {
    toggleCustomInput();
    refreshByName();
  });
  customNameInput?.addEventListener("input", refreshByName);
  categoryInput?.addEventListener("change", () => {
    refreshNameOptions();
    toggleCustomInput();
    refreshByName();
  });
  storageInput?.addEventListener("change", refreshSuggestion);
  applySuggestionButton?.addEventListener("click", () => {
    const suggested = applySuggestionButton.getAttribute("data-suggested-date");
    if (expiryInput && suggested) expiryInput.value = suggested;
  });

  if (cameraInput) {
    cameraInput.addEventListener("change", async () => {
      const file = cameraInput.files?.[0];
      state.pendingImageDataUrl = file ? await readFileAsDataUrl(file) : undefined;
      render(root, state);
    });
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const selectedName = String(formData.get("nameSelect") ?? "").trim();
    const customName = String(formData.get("nameCustom") ?? "").trim();
    const name = selectedName === CUSTOM_NAME_VALUE ? customName : selectedName;
    const expiryDate = String(formData.get("expiryDate") ?? "");
    const quantity = Number(formData.get("quantity"));
    const quantityUnit = String(formData.get("quantityUnit") ?? "").trim();
    const storage = String(formData.get("storage") ?? "") as StorageType;
    const category = String(formData.get("category") ?? "") as FoodCategory;
    if (
      !name ||
      !expiryDate ||
      !quantityUnit ||
      quantity <= 0 ||
      !isStorageType(storage) ||
      !isFoodCategory(category)
    ) {
      return;
    }
    const now = new Date().toISOString();
    const template = findTemplateByName(name);
    const newFood = createFood({
      name,
      expiryDate,
      quantity,
      quantityUnit,
      remainingRatio: 100,
      storage,
      category,
      iconEmoji: template?.iconEmoji ?? CATEGORY_ICON[category],
      createdAt: now,
      updatedAt: now,
      imageDataUrl: state.pendingImageDataUrl,
    });
    state.foods = sortFoodsByPriority([...state.foods, newFood]);
    state.pendingImageDataUrl = undefined;
    saveFoods(state.foods);
    render(root, state);
  });

  const openButtons = root.querySelectorAll<HTMLButtonElement>("[data-open-id]");
  openButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.openId;
      if (!id) return;
      state.selectedFoodId = id;
      state.pendingEditImageDataUrl = undefined;
      render(root, state);
    });
  });

  refreshNameOptions();
  toggleCustomInput();
  refreshByName();
}

function bindDetailEvents(root: HTMLDivElement, state: AppState, food: Food): void {
  const editForm = root.querySelector<HTMLFormElement>("#food-edit-form");
  const ratioInput = root.querySelector<HTMLInputElement>('input[name="remainingRatio"]');
  const ratioValue = root.querySelector<HTMLElement>("#edit-ratio-value");
  const backButton = root.querySelector<HTMLButtonElement>("#back-home-button");
  const cameraInput = root.querySelector<HTMLInputElement>("#edit-camera-input");

  ratioInput?.addEventListener("input", () => {
    if (ratioValue && ratioInput) ratioValue.textContent = `${ratioInput.value}%`;
  });

  backButton?.addEventListener("click", () => {
    state.selectedFoodId = undefined;
    state.pendingEditImageDataUrl = undefined;
    render(root, state);
  });

  cameraInput?.addEventListener("change", async () => {
    const file = cameraInput.files?.[0];
    state.pendingEditImageDataUrl = file ? await readFileAsDataUrl(file) : undefined;
    render(root, state);
  });

  editForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(editForm);
    const name = String(formData.get("name") ?? "").trim();
    const expiryDate = String(formData.get("expiryDate") ?? "");
    const quantity = Number(formData.get("quantity"));
    const quantityUnit = String(formData.get("quantityUnit") ?? "").trim();
    const remainingRatio = Number(formData.get("remainingRatio"));
    const storage = String(formData.get("storage") ?? "") as StorageType;
    const category = String(formData.get("category") ?? "") as FoodCategory;
    if (
      !name ||
      !expiryDate ||
      !quantityUnit ||
      quantity <= 0 ||
      !isStorageType(storage) ||
      !isFoodCategory(category)
    ) {
      return;
    }

    const template = findTemplateByName(name);
    state.foods = sortFoodsByPriority(
      state.foods.map((item) => {
        if (item.id !== food.id) return item;
        return {
          ...item,
          name,
          expiryDate,
          quantity,
          quantityUnit,
          remainingRatio: clampRatio(remainingRatio),
          storage,
          category,
          iconEmoji: template?.iconEmoji ?? CATEGORY_ICON[category],
          imageDataUrl: state.pendingEditImageDataUrl ?? item.imageDataUrl,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    state.pendingEditImageDataUrl = undefined;
    saveFoods(state.foods);
    render(root, state);
  });

  const deleteButton = root.querySelector<HTMLButtonElement>("[data-delete-id]");
  deleteButton?.addEventListener("click", () => {
    state.foods = state.foods.filter((item) => item.id !== food.id);
    state.selectedFoodId = undefined;
    state.pendingEditImageDataUrl = undefined;
    saveFoods(state.foods);
    render(root, state);
  });
}

function renderFoodListItem(food: Food): string {
  const icon = food.imageDataUrl
    ? `<img class="food-thumb" src="${food.imageDataUrl}" alt="${escapeHtml(food.name)}の写真" />`
    : `<span class="food-emoji">${food.iconEmoji}</span>`;
  const diffDays = calculateDiffDays(food.expiryDate);
  return `
    <li class="food-item">
      <div class="food-main">
        <div class="food-icon">${icon}</div>
        <div>
          <button class="food-open-button" type="button" data-open-id="${food.id}">
            ${escapeHtml(food.name)}
          </button>
          <p class="food-meta">目安賞味期限: ${food.expiryDate}（${getDiffDaysText(diffDays)}）</p>
          <p class="food-meta">量: ${formatQuantity(food.quantity, food.quantityUnit)}</p>
        </div>
      </div>
      <span class="tag ${getUrgencyClass(diffDays)}">${CATEGORY_LABELS[food.category]}</span>
    </li>
  `;
}

function renderCategoryOptions(selected: FoodCategory): string {
  return (Object.keys(CATEGORY_LABELS) as FoodCategory[])
    .map((key) => `<option value="${key}" ${selected === key ? "selected" : ""}>${CATEGORY_LABELS[key]}</option>`)
    .join("");
}

function renderStorageOptions(selected: StorageType): string {
  return (Object.keys(STORAGE_LABELS) as StorageType[])
    .map((key) => `<option value="${key}" ${selected === key ? "selected" : ""}>${STORAGE_LABELS[key]}</option>`)
    .join("");
}

function sortFoodsByPriority(foods: Food[]): Food[] {
  return [...foods].sort((a, b) => {
    const diff = calculateDiffDays(a.expiryDate) - calculateDiffDays(b.expiryDate);
    if (diff !== 0) return diff;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function findTemplateByName(name: string): IngredientTemplate | undefined {
  const normalized = normalizeText(name);
  return INGREDIENT_TEMPLATES.find((item) => normalizeText(item.name) === normalized);
}

function renderIngredientSelectOptions(category: FoodCategory): string {
  const list = INGREDIENT_TEMPLATES.filter(
    (item) => category === "other" || item.category === category,
  );
  return list
    .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
    .join("");
}

function getSuggestedShelfLifeDays(
  category: FoodCategory,
  storage: StorageType,
  name: string,
): number {
  const template = findTemplateByName(name);
  const base = template?.shelfLifeDays ?? CATEGORY_BASE_DAYS[category];
  return Math.max(base + STORAGE_DAY_BONUS[storage], 1);
}

function getSuggestedExpiryDate(
  category: FoodCategory,
  storage: StorageType,
  name: string,
): string {
  const date = new Date();
  date.setDate(date.getDate() + getSuggestedShelfLifeDays(category, storage, name));
  return date.toISOString().slice(0, 10);
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

function formatQuantity(value: number, unit: string): string {
  if (unit === "玉" && value === 0.5) return "1/2玉";
  if (unit === "玉" && value === 0.25) return "1/4玉";
  return `${removeTrailingZero(value)}${unit}`;
}

function removeTrailingZero(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalizeFoods(foods: Food[]): Food[] {
  return foods.map((food) => {
    const now = new Date().toISOString();
    const category = isFoodCategory(food.category) ? food.category : "other";
    const ratio =
      typeof food.remainingRatio === "number" ? clampRatio(food.remainingRatio) : 100;
    return {
      ...food,
      category,
      remainingRatio: ratio,
      quantityUnit: food.quantityUnit ?? "個",
      iconEmoji: food.iconEmoji ?? CATEGORY_ICON[category],
      createdAt: food.createdAt ?? now,
      updatedAt: food.updatedAt ?? now,
    };
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
        date.getDate(),
      ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
      ).padStart(2, "0")}`;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
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
