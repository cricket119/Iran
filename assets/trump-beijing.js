function formatTime(ts) {
  if (!ts) return "时间未知";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "时间未知";
  return d.toLocaleString("zh-CN", { hour12: false });
}

const MIN_PUBLISHED_AT = new Date("2026-05-14T00:00:00+08:00").getTime();
const expandedSections = new Set();

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function timeValue(ts) {
  if (!ts) return 0;
  const time = new Date(ts).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortRecent(items = []) {
  return [...items]
    .filter((item) => timeValue(item.publishedAt) >= MIN_PUBLISHED_AT)
    .sort((a, b) => timeValue(b.publishedAt) - timeValue(a.publishedAt));
}

function signed(value, digits = 2) {
  if (typeof value !== "number") return "N/A";
  const formatted = value.toFixed(digits);
  return value > 0 ? `+${formatted}` : formatted;
}

function expandButton(sectionId, hiddenCount) {
  if (hiddenCount <= 0) return "";
  const expanded = expandedSections.has(sectionId);
  return `
    <div class="module-actions">
      <button class="expand-btn" type="button" data-expand="${esc(sectionId)}">
        ${expanded ? "收起" : `展开其余 ${hiddenCount} 条`}
      </button>
    </div>
  `;
}

function itemCard(item) {
  return `
    <article class="timeline-item">
      <div class="item-meta">
        <span class="source-chip">${esc(item.source)}</span>
        <span class="time">${esc(formatTime(item.publishedAt))}</span>
      </div>
      <h3>${esc(item.titleZh || item.title)}</h3>
      <p class="summary">${esc(item.summaryZh || "")}</p>
      <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">查看原文</a>
    </article>
  `;
}

function renderItems(targetId, items, emptyText) {
  const el = document.getElementById(targetId);
  const sorted = sortRecent(items);
  if (!sorted.length) {
    el.innerHTML = `<div class="empty">${esc(emptyText)}</div>`;
    return;
  }
  const visible = expandedSections.has(targetId) ? sorted : sorted.slice(0, 10);
  el.innerHTML = visible.map(itemCard).join("") + expandButton(targetId, sorted.length - 10);
}

function renderCompare(bySource) {
  const el = document.getElementById("compare");
  if (!bySource?.length) {
    el.innerHTML = '<div class="empty">暂无媒体对比数据。</div>';
    return;
  }
  el.innerHTML = `
    <div class="compare-columns">
      ${bySource
        .map((group) => {
          const sectionId = `compare-${group.sourceId}`;
          const sorted = sortRecent(group.items || []);
          const visible = expandedSections.has(sectionId) ? sorted : sorted.slice(0, 10);
          return `
          <section class="source-col">
            <h3>${esc(group.source)}</h3>
            ${
              visible.length
                ? visible
                    .map(
                      (item) => `
                      <div class="source-item">
                        <div class="time">${esc(formatTime(item.publishedAt))}</div>
                        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.titleZh || item.title)}</a>
                        <div class="summary">${esc(item.summaryZh || "")}</div>
                      </div>
                    `
                    )
                    .join("")
                : '<div class="empty">该媒体当前无相关内容</div>'
            }
            ${expandButton(sectionId, sorted.length - 10)}
          </section>
        `;
        })
        .join("")}
    </div>
  `;
}

function renderMarkets(markets) {
  const el = document.getElementById("markets");
  if (!markets?.length) {
    el.innerHTML = '<div class="empty">暂无市场数据。</div>';
    return;
  }
  const visible = expandedSections.has("markets") ? markets : markets.slice(0, 10);
  el.innerHTML = `
    <div class="market-grid">
      ${visible
        .map((item) => {
          const up = typeof item.change === "number" && item.change >= 0;
          return `
          <article class="market-card">
            <div class="market-top">
              <strong>${esc(item.symbol)}</strong>
              <span class="${up ? "market-up" : "market-down"}">${signed(item.changePct)}%</span>
            </div>
            <div class="market-company">${esc(item.company)}</div>
            <div class="market-price">${typeof item.price === "number" ? `${esc(item.currency)} ${item.price.toFixed(2)}` : "N/A"}</div>
            <div class="summary">${esc(item.representative)}</div>
          </article>
        `;
        })
        .join("")}
    </div>
    ${expandButton("markets", markets.length - 10)}
  `;
}

function renderTranslationStatus(translation = {}) {
  const el = document.getElementById("translation-status");
  const values = Object.values(translation).filter((value) => value === "fallback");
  if (!values.length) {
    el.textContent = "AI 中文摘要：正常";
    return;
  }
  el.textContent = "AI 中文摘要：部分降级为原文（通常是 API 额度或限流导致）";
}

async function refreshData() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(`./data/trump-beijing.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`加载失败: ${res.status}`);
    const data = await res.json();
    status.textContent = data.generatedAt
      ? `最近更新：${formatTime(data.generatedAt)} | 新闻 ${data.totalNews} 条 | 评论 ${data.totalCommentary} 条 | 社交 ${data.totalSocial} 条 | 股票 ${data.totalMarkets} 只`
      : "尚未生成数据，请等待 GitHub Action 首次运行";

    renderTranslationStatus(data.translation);
    renderItems("timeline", data.timeline || [], "暂时没有抓取到 5 月 14 日之后的此次会谈相关新闻。");
    renderCompare(data.bySource || []);
    renderItems("social", data.social || [], "暂时没有抓取到 5 月 14 日之后的 X / 微博 / KOL 线索。");
    renderItems("commentary", data.commentary || [], "暂无 5 月 14 日之后的评论与后续影响分析。");
    renderMarkets(data.markets || []);
  } catch (err) {
    status.textContent = `数据加载失败：${err.message}`;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-expand]");
  if (!button) return;
  const key = button.dataset.expand;
  if (expandedSections.has(key)) {
    expandedSections.delete(key);
  } else {
    expandedSections.add(key);
  }
  refreshData();
});

refreshData();
setInterval(refreshData, 60 * 60 * 1000);
