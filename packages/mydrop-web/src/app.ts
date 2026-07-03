let apiBase = "http://localhost:4317";

interface Item {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly content: string | null;
  readonly createdAt: number;
  readonly createdBy: string;
}

const statusEl = document.getElementById("status")!;
const nodeUrlEl = document.getElementById("nodeUrl") as HTMLInputElement;
const connectBtn = document.getElementById("connectBtn")!;
const refreshBtn = document.getElementById("refreshBtn")!;
const shareBtn = document.getElementById("shareBtn")!;
const textInput = document.getElementById("textInput") as HTMLTextAreaElement;
const itemsEl = document.getElementById("items")!;

async function setStatus(text: string): Promise<void> {
  statusEl.textContent = text;
}

async function fetchItems(): Promise<void> {
  try {
    const res = await fetch(`${apiBase}/v1/items`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = (await res.json()) as Item[];
    renderItems(items);
    await setStatus(`Connected · ${items.length} items`);
  } catch {
    await setStatus("Failed to fetch items");
  }
}

function renderItems(items: Item[]): void {
  if (items.length === 0) {
    itemsEl.innerHTML = '<p class="empty">No items yet.</p>';
    return;
  }

  itemsEl.innerHTML = items.map(item => {
    const isFile = item.type === "file" || item.type === "image";
    const displayContent = isFile ? item.title : (item.content ?? "");
    const downloadLink = isFile && item.content?.startsWith("data:")
      ? `<a href="${item.content}" download="${item.title}" style="color:#275efe;font-weight:700;text-decoration:none">Download</a>`
      : "";

    return `<div class="item">
      <div>
        <p class="kind">${item.type}</p>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(displayContent ?? "")}</p>
        <small>${item.createdBy} · ${new Date(item.createdAt).toLocaleString()}</small>
      </div>
      ${downloadLink}
    </div>`;
  }).join("");
}

async function shareText(): Promise<void> {
  const text = textInput.value.trim();
  if (!text) return;

  const title = text.length > 48 ? text.slice(0, 45) + "..." : text;

  try {
    await fetch(`${apiBase}/v1/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "text", title, content: text }),
    });
    textInput.value = "";
    await fetchItems();
  } catch {
    await setStatus("Failed to share");
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

connectBtn.addEventListener("click", () => {
  const url = nodeUrlEl.value.trim();
  if (url) {
    apiBase = url;
    localStorage.setItem("mydrop-web-node", apiBase);
    void fetchItems();
  }
});

refreshBtn.addEventListener("click", () => void fetchItems());
shareBtn.addEventListener("click", () => void shareText());

textInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    void shareText();
  }
});

const saved = localStorage.getItem("mydrop-web-node");
if (saved) {
  apiBase = saved;
  nodeUrlEl.value = apiBase;
}

void fetchItems();
