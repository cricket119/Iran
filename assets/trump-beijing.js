function formatTime(ts) {
  if (!ts) return "时间未知";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "时间未知";
  return d.toLocaleString("zh-CN", { hour12: false });
}

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function signed(value, digits = 2) {
  if (typeof value !== "number") return "N/A";
  const formatted = value.toFixed(digits);
  return value > 0 ? `+${formatted}` : formatted;
}

function renderItems(targetId, items, limit, emptyText) {
  const el = document.getElementById(targetId);
  if (!items?.length) {
    el.innerHTML = `<div class="empty">${esc(emptyText)}</div>`;
    return;
  }
  el.innerHTML = items
    .slice(0, limit)
    .map(
      (item) => `
      <article class="timeline-item">
        <div>
          <span class="source-chip">${esc(item.source)}</span>
          <span class="time">${esc(formatTime(item.publishedAt))}</span>
        </div>
        <h3>${esc(item.titleZh || item.title)}</h3>
        <p class="summary">${esc(item.summaryZh || "")}</p>
        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">查看原文</a>
      </article>
    `
    )
    .join("");
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
        .map(
          (group) => `
          <section class="source-col">
            <h3>${esc(group.source)}</h3>
            ${
              group.items?.length
                ? group.items
                    .slice(0, 5)
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
          </section>
        `
        )
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
  el.innerHTML = `
    <div class="market-grid">
      ${markets
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
    renderItems("timeline", data.timeline || [], 40, "暂时没有抓取到此次会谈相关新闻。");
    renderCompare(data.bySource || []);
    renderItems("social", data.social || [], 24, "暂时没有抓取到 X / 微博 / KOL 线索。");
    renderItems("commentary", data.commentary || [], 24, "暂无评论与后续影响分析。");
    renderMarkets(data.markets || []);
  } catch (err) {
    status.textContent = `数据加载失败：${err.message}`;
  }
}

refreshData();
setInterval(refreshData, 60 * 60 * 1000);
