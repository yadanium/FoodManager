import { createFood, type Food, type StorageType } from "./food";
import { calculateDiffDays, calculateFoodScore } from "./score";
import { loadFoods, saveFoods } from "./storage";

const STORAGE_LABELS: Record<StorageType, string> = {
  fridge: "冷蔵",
  frozen: "冷凍",
  room: "常温",
};

interface AppState {
  foods: Food[];
}

export function createApp(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  const state: AppState = {
    foods: sortFoodsByScore(loadFoods()),
  };

  render(root, state);
}

function render(root: HTMLDivElement, state: AppState): void {
  const priorityFoods = state.foods.slice(0, 3);

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
            食材名
            <input name="name" type="text" required maxlength="50" />
          </label>
          <label>
            賞味期限
            <input name="expiryDate" type="date" required />
          </label>
          <label>
            個数
            <input name="quantity" type="number" min="1" value="1" required />
          </label>
          <label>
            保存場所
            <select name="storage" required>
              <option value="fridge">冷蔵</option>
              <option value="frozen">冷凍</option>
              <option value="room">常温</option>
            </select>
          </label>
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

      if (!name || !expiryDate || quantity < 1 || !isStorageType(storage)) {
        return;
      }

      const newFood = createFood({
        name,
        expiryDate,
        quantity,
        storage,
      });

      state.foods = sortFoodsByScore([...state.foods, newFood]);
      saveFoods(state.foods);
      render(root, state);
    });
  }

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

  return `
    <li class="food-item">
      <div>
        <p class="food-name">${escapeHtml(food.name)}</p>
        <p class="food-meta">
          ${STORAGE_LABELS[food.storage]} / ${food.quantity}個 / ${statusText} / score: ${score}
        </p>
      </div>
      <div class="food-actions">
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
