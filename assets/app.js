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

function renderTimeline(items) {
  const el = document.getElementById("timeline");
  if (!items?.length) {
    el.innerHTML = '<div class="empty">暂时没有抓取到与伊朗相关的新闻。</div>';
    return;
  }
  el.innerHTML = items
    .slice(0, 40)
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
    el.innerHTML = '<div class="empty">暂时没有媒体对比数据。</div>';
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

function renderCommentary(items) {
  const el = document.getElementById("commentary");
  if (!items?.length) {
    el.innerHTML = '<div class="empty">暂无评论类内容。</div>';
    return;
  }
  el.innerHTML = items
    .slice(0, 20)
    .map(
      (item) => `
      <article class="comment-item">
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

async function refreshData() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(`./data/latest.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`加载失败: ${res.status}`);
    const data = await res.json();

    status.textContent = data.generatedAt
      ? `最近更新：${formatTime(data.generatedAt)} | 新闻 ${data.totalNews} 条 | 评论 ${data.totalCommentary} 条`
      : "尚未生成数据，请等待 GitHub Action 首次运行";

    renderTimeline(data.timeline || []);
    renderCompare(data.bySource || []);
    renderCommentary(data.commentary || []);
  } catch (err) {
    status.textContent = `数据加载失败：${err.message}`;
  }
}

refreshData();
setInterval(refreshData, 60 * 1000);
