import fs from "node:fs/promises";
import path from "node:path";

const OUT_FILE = path.resolve("data/trump-beijing.json");
const MIN_PUBLISHED_AT = new Date("2026-05-14T00:00:00+08:00").getTime();

const TARGET_NEWS_SOURCES = [
  { id: "reuters", name: "Reuters", site: "reuters.com" },
  { id: "bbc", name: "BBC", site: "bbc.com" },
  { id: "aljazeera", name: "Al Jazeera", site: "aljazeera.com" },
  { id: "zaobao", name: "联合早报", site: "zaobao.com.sg" },
  { id: "general", name: "其他可信来源", site: "" }
];

const TARGET_COMMENTARY_SOURCES = [
  { id: "foreignaffairs", name: "Foreign Affairs", site: "foreignaffairs.com" },
  { id: "foreignpolicy", name: "Foreign Policy", site: "foreignpolicy.com" },
  { id: "economist", name: "The Economist", site: "economist.com" },
  { id: "nytimes", name: "The New York Times", site: "nytimes.com" },
  { id: "ft", name: "Financial Times", site: "ft.com" }
];

const NEWS_FEEDS = [
  "https://news.google.com/rss/search?q=Trump+Beijing+talks&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+China+Beijing+meeting&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+Xi+Beijing+talks&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+state+visit+China+Beijing+CEOs&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+Xi+summit+business+leaders+Beijing&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=特朗普+北京+会谈&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
  "https://news.google.com/rss/search?q=中美+北京+会谈+特朗普&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
  "https://news.google.com/rss/search?q=特朗普+访华+美国企业家&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
];

const COMMENTARY_FEEDS = [
  "https://news.google.com/rss/search?q=Trump+Beijing+China+talks+analysis&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+China+talks+site:foreignaffairs.com&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+China+talks+site:foreignpolicy.com&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+China+talks+site:economist.com&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Trump+China+talks+site:ft.com&hl=en-US&gl=US&ceid=US:en"
];

const SOCIAL_FEEDS = [
  "https://news.google.com/rss/search?q=Trump+Beijing+talks+X+OR+Twitter&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=特朗普+北京+会谈+微博+大V&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
  "https://news.google.com/rss/search?q=特朗普+访华+企业家+微博&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
];

const GDELT_QUERIES = [
  "Trump Beijing talks",
  "Trump Xi Beijing summit",
  "Trump China state visit CEOs",
  "特朗普 北京 会谈",
  "特朗普 访华 美国企业家"
];

const KEYWORDS = [
  "trump",
  "beijing",
  "china",
  "xi",
  "talks",
  "meeting",
  "tariff",
  "特朗普",
  "北京",
  "中国",
  "习近平",
  "会谈",
  "访华",
  "中美",
  "关税"
];

const MARKET_WATCHLIST = [
  { symbol: "TSLA", company: "Tesla", representative: "Elon Musk / Tesla" },
  { symbol: "AAPL", company: "Apple", representative: "Tim Cook / Apple" },
  { symbol: "NVDA", company: "Nvidia", representative: "Jensen Huang / Nvidia" },
  { symbol: "MSFT", company: "Microsoft", representative: "Microsoft" },
  { symbol: "GOOGL", company: "Alphabet", representative: "Google / Alphabet" },
  { symbol: "AMZN", company: "Amazon", representative: "Amazon" },
  { symbol: "JPM", company: "JPMorgan Chase", representative: "Jamie Dimon / JPMorgan" },
  { symbol: "BA", company: "Boeing", representative: "Boeing" },
  { symbol: "GM", company: "General Motors", representative: "GM" },
  { symbol: "F", company: "Ford", representative: "Ford" },
  { symbol: "CAT", company: "Caterpillar", representative: "Caterpillar" }
];

function decodeXml(text = "") {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function escapeRegExp(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(s = "") {
  return decodeXml(String(s).replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const gdelt = raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/);
  if (gdelt) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = gdelt;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
  return raw;
}

function timeValue(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return 0;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isAfterCutoff(item) {
  return timeValue(item.pubDate || item.publishedAt) >= MIN_PUBLISHED_AT;
}

function extractTag(block, tag) {
  const safeTag = escapeRegExp(tag);
  const cdataRegex = new RegExp(`<${safeTag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${safeTag}>`, "i");
  const plainRegex = new RegExp(`<${safeTag}[^>]*>([\\s\\S]*?)<\\/${safeTag}>`, "i");
  const selfCloseRegex = new RegExp(`<${safeTag}[^>]*href="([^"]+)"[^>]*/?>`, "i");
  const cdata = block.match(cdataRegex);
  if (cdata?.[1]) return cleanText(cdata[1]);
  const plain = block.match(plainRegex);
  if (plain?.[1]) return cleanText(plain[1]);
  const selfClose = block.match(selfCloseRegex);
  if (selfClose?.[1]) return cleanText(selfClose[1]);
  return "";
}

function normalizeItems(xml) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const blocks = itemBlocks.length
    ? itemBlocks
    : [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0]);

  return blocks.map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link") || extractTag(block, "guid"),
    source: extractTag(block, "source"),
    description: extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content"),
    pubDate: normalizeDate(extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published")) || null
  }));
}

function includesTopic(text) {
  const lowered = text.toLowerCase();
  const hasTrump = lowered.includes("trump") || lowered.includes("特朗普");
  const hasChina =
    lowered.includes("china") ||
    lowered.includes("beijing") ||
    lowered.includes("xi") ||
    lowered.includes("中国") ||
    lowered.includes("北京") ||
    lowered.includes("中美") ||
    lowered.includes("习近平") ||
    lowered.includes("访华");
  return hasTrump && hasChina;
}

function guessSourceName(item) {
  if (item.source) return item.source;
  const parts = cleanText(item.title).split(" - ");
  return parts.length > 1 ? parts.at(-1).trim() : "";
}

function sourceMatches(item, source) {
  const haystack = `${guessSourceName(item)} ${item.link || ""}`.toLowerCase();
  if (source.id === "reuters") return haystack.includes("reuters");
  if (source.id === "bbc") return haystack.includes("bbc");
  if (source.id === "aljazeera") return haystack.includes("al jazeera") || haystack.includes("aljazeera");
  if (source.id === "zaobao") return haystack.includes("zaobao") || haystack.includes("联合早报");
  if (source.id === "foreignaffairs") return haystack.includes("foreign affairs");
  if (source.id === "foreignpolicy") return haystack.includes("foreign policy") || haystack.includes("foreignpolicy");
  if (source.id === "economist") return haystack.includes("economist");
  if (source.id === "nytimes") return haystack.includes("new york times") || haystack.includes("nytimes");
  if (source.id === "ft") return haystack.includes("financial times") || haystack.includes("ft.com");
  return false;
}

function asGeneralSource(item) {
  const sourceName = guessSourceName(item) || "综合来源";
  return {
    id: "general",
    name: sourceName,
    site: ""
  };
}

function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.link || item.title || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "trump-beijing-tracker/1.0" }
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  return normalizeItems(await res.text());
}

async function fetchGdelt(query) {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    format: "json",
    maxrecords: "50",
    sort: "HybridRel"
  });
  const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
    headers: { "User-Agent": "trump-beijing-tracker/1.0" }
  });
  if (!res.ok) throw new Error(`GDELT fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.articles || []).map((article) => ({
    title: article.title || "",
    link: article.url || "",
    source: article.sourceCommonName || article.domain || "",
    description: article.seendate ? `${article.sourceCommonName || ""} ${article.seendate}` : article.sourceCommonName || "",
    pubDate: normalizeDate(article.seendate) || null
  }));
}

function sortByTimeDesc(items) {
  return [...items].sort((a, b) => {
    return timeValue(b.publishedAt) - timeValue(a.publishedAt);
  });
}

function toEntry(source, type, item, idx) {
  return {
    id: `${source.id}-${type}-${idx}-${(item.link || item.title).slice(0, 24)}`,
    sourceId: source.id,
    source: source.name,
    sourceSite: source.site,
    type,
    title: cleanText(item.title),
    description: cleanText(item.description),
    url: item.link,
    publishedAt: item.pubDate
  };
}

async function translateBatch(items, mode) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!key || items.length === 0) return fallbackTranslate(items, "missing_api_key");

  const payload = {
    model,
    temperature: 0.2,
    input: [
      {
        role: "system",
        content:
          mode === "market"
            ? "你是中文财经编辑。把输入内容翻译成简体中文，并生成一句市场影响摘要。只基于原文，不补充事实。返回JSON对象。"
            : "你是严谨的中文国际新闻编辑。把输入标题和摘要翻译成简体中文，并生成一句简洁摘要。只基于原文，不补充事实。返回JSON对象。"
      },
      {
        role: "user",
        content: JSON.stringify(
          items.map((item) => ({
            id: item.id,
            source: item.source,
            title: item.title,
            description: item.description.slice(0, 700)
          }))
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "translated_items",
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  titleZh: { type: "string" },
                  summaryZh: { type: "string" }
                },
                required: ["id", "titleZh", "summaryZh"],
                additionalProperties: false
              }
            }
          },
          required: ["items"],
          additionalProperties: false
        }
      }
    }
  };

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`OpenAI API failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const textOut = data?.output?.[0]?.content?.[0]?.text || data?.output_text;
    if (!textOut) throw new Error("OpenAI API returned empty output");
    const parsed = JSON.parse(textOut);
    const translated = parsed.items || [];
    const map = new Map(translated.map((item) => [item.id, item]));
    return {
      status: "ok",
      items: items.map((item) => ({
        ...item,
        titleZh: map.get(item.id)?.titleZh || item.title,
        summaryZh: map.get(item.id)?.summaryZh || item.description.slice(0, 220)
      }))
    };
  } catch (err) {
    console.error(`[translate:${mode}] fallback to original content:`, err.message);
    return fallbackTranslate(items, err.message);
  }
}

function fallbackTranslate(items, reason) {
  return {
    status: "fallback",
    reason,
    items: items.map((item) => ({
      ...item,
      titleZh: item.title,
      summaryZh: item.description.slice(0, 220)
    }))
  };
}

async function collectFeeds(feeds, label) {
  const all = [];
  const diagnostics = [];
  for (const feed of feeds) {
    try {
      const items = await fetchRss(feed);
      diagnostics.push({ feed, count: items.length, status: "ok" });
      all.push(...items);
    } catch (err) {
      diagnostics.push({ feed, count: 0, status: "failed", error: err.message });
      console.error(`[${label}] feed failed:`, err.message);
    }
  }
  return { items: dedupeByUrl(all), diagnostics };
}

async function collectGdelt(label) {
  const all = [];
  const diagnostics = [];
  for (const query of GDELT_QUERIES) {
    try {
      const items = await fetchGdelt(query);
      diagnostics.push({ feed: `gdelt:${query}`, count: items.length, status: "ok" });
      all.push(...items);
    } catch (err) {
      diagnostics.push({ feed: `gdelt:${query}`, count: 0, status: "failed", error: err.message });
      console.error(`[${label}] gdelt failed:`, err.message);
    }
  }
  return { items: dedupeByUrl(all), diagnostics };
}

async function buildTimeline() {
  const rss = await collectFeeds(NEWS_FEEDS, "news");
  const gdelt = await collectGdelt("news");
  const items = dedupeByUrl([...rss.items, ...gdelt.items]);
  const diagnostics = [...rss.diagnostics, ...gdelt.diagnostics];
  const pool = items.filter((item) => includesTopic(`${item.title} ${item.description}`));
  const recentPool = pool.filter(isAfterCutoff);
  const selected = [];
  const selectedKeys = new Set();
  for (const source of TARGET_NEWS_SOURCES) {
    if (source.id === "general") continue;
    const matched = recentPool.filter((item) => sourceMatches(item, source)).slice(0, 12);
    for (const [idx, item] of matched.entries()) {
      selectedKeys.add(item.link || item.title);
      selected.push(toEntry(source, "news", item, idx));
    }
  }
  const general = recentPool
    .filter((item) => !selectedKeys.has(item.link || item.title))
    .slice(0, 20)
    .map((item, idx) => toEntry(asGeneralSource(item), "news", item, idx));
  selected.push(...general);
  const translated = await translateBatch(selected, "news");
  const timeline = sortByTimeDesc(translated.items);
  return {
    timeline,
    bySource: TARGET_NEWS_SOURCES.map((source) => ({
      sourceId: source.id,
      source: source.name,
      items: timeline.filter((item) => item.sourceId === source.id)
    })),
    diagnostics,
    translation: { news: translated.status, newsReason: translated.reason || null }
  };
}

async function buildCommentary() {
  const { items, diagnostics } = await collectFeeds(COMMENTARY_FEEDS, "commentary");
  const pool = items.filter((item) => includesTopic(`${item.title} ${item.description}`)).filter(isAfterCutoff);
  const selected = [];
  for (const source of TARGET_COMMENTARY_SOURCES) {
    const matched = pool.filter((item) => sourceMatches(item, source)).slice(0, 8);
    selected.push(...matched.map((item, idx) => toEntry(source, "commentary", item, idx)));
  }
  const translated = await translateBatch(selected, "commentary");
  return {
    commentary: sortByTimeDesc(translated.items),
    diagnostics,
    translation: { commentary: translated.status, commentaryReason: translated.reason || null }
  };
}

async function buildSocialSignals() {
  const { items, diagnostics } = await collectFeeds(SOCIAL_FEEDS, "social");
  const selected = items
    .filter((item) => includesTopic(`${item.title} ${item.description}`))
    .filter(isAfterCutoff)
    .slice(0, 24)
    .map((item, idx) =>
      toEntry(
        { id: "social", name: guessSourceName(item) || "X / 微博 / KOL", site: "" },
        "social",
        item,
        idx
      )
    );
  const translated = await translateBatch(selected, "social");
  return {
    social: sortByTimeDesc(translated.items),
    diagnostics,
    translation: { social: translated.status, socialReason: translated.reason || null }
  };
}

async function fetchMarketQuote(stock) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(stock.symbol)}?range=5d&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "trump-beijing-tracker/1.0" } });
  if (!res.ok) throw new Error(`quote failed: ${res.status}`);
  const result = (await res.json())?.chart?.result?.[0];
  const meta = result?.meta || {};
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((value) => typeof value === "number");
  const price = meta.regularMarketPrice ?? closes.at(-1) ?? null;
  const previous = meta.chartPreviousClose ?? closes.at(-2) ?? null;
  const change = price != null && previous != null ? price - previous : null;
  const changePct = change != null && previous ? (change / previous) * 100 : null;
  return {
    ...stock,
    price,
    previous,
    change,
    changePct,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || meta.fullExchangeName || "",
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    status: "ok"
  };
}

async function buildMarkets() {
  const quotes = await Promise.all(
    MARKET_WATCHLIST.map(async (stock) => {
      try {
        return await fetchMarketQuote(stock);
      } catch (err) {
        return { ...stock, status: "failed", error: err.message };
      }
    })
  );
  return quotes;
}

async function main() {
  const [{ timeline, bySource, diagnostics: newsDiagnostics, translation: newsTranslation }, commentaryData, socialData, markets] =
    await Promise.all([buildTimeline(), buildCommentary(), buildSocialSignals(), buildMarkets()]);

  const output = {
    generatedAt: new Date().toISOString(),
    topic: "特朗普北京会谈",
    totalNews: timeline.length,
    totalCommentary: commentaryData.commentary.length,
    totalSocial: socialData.social.length,
    totalMarkets: markets.filter((quote) => quote.status === "ok").length,
    minPublishedAt: new Date(MIN_PUBLISHED_AT).toISOString(),
    translation: {
      ...newsTranslation,
      ...commentaryData.translation,
      ...socialData.translation
    },
    timeline,
    bySource,
    commentary: commentaryData.commentary,
    social: socialData.social,
    markets,
    diagnostics: {
      news: newsDiagnostics,
      commentary: commentaryData.diagnostics,
      social: socialData.diagnostics
    }
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(
    `Updated ${OUT_FILE} with ${output.totalNews} news, ${output.totalCommentary} commentary, ${output.totalSocial} social items, and ${output.totalMarkets} market quotes.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
