import fs from "node:fs/promises";
import path from "node:path";

const OUT_FILE = path.resolve("data/latest.json");

const NEWS_SOURCES = [
  {
    id: "reuters",
    name: "Reuters",
    feed: "https://news.google.com/rss/search?q=iran+site:reuters.com&hl=en-US&gl=US&ceid=US:en",
    site: "reuters.com"
  },
  {
    id: "bbc",
    name: "BBC",
    feed: "https://news.google.com/rss/search?q=iran+site:bbc.com&hl=en-US&gl=US&ceid=US:en",
    site: "bbc.com"
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    feed: "https://news.google.com/rss/search?q=iran+site:aljazeera.com&hl=en-US&gl=US&ceid=US:en",
    site: "aljazeera.com"
  },
  {
    id: "zaobao",
    name: "联合早报",
    feed: "https://news.google.com/rss/search?q=伊朗+site:zaobao.com.sg&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    site: "zaobao.com.sg"
  }
];

const COMMENTARY_SOURCES = [
  {
    id: "nytimes",
    name: "The New York Times",
    feed: "https://news.google.com/rss/search?q=iran+site:nytimes.com+opinion&hl=en-US&gl=US&ceid=US:en",
    site: "nytimes.com"
  },
  {
    id: "foreignaffairs",
    name: "Foreign Affairs",
    feed: "https://news.google.com/rss/search?q=iran+site:foreignaffairs.com&hl=en-US&gl=US&ceid=US:en",
    site: "foreignaffairs.com"
  }
];

const IRAN_KEYWORDS = ["iran", "iranian", "伊朗", "tehran", "德黑兰", "中东"];

function decodeXml(text = "") {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function escapeRegExp(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTag(block, tag) {
  const safeTag = escapeRegExp(tag);
  const cdataRegex = new RegExp(`<${safeTag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${safeTag}>`, "i");
  const plainRegex = new RegExp(`<${safeTag}[^>]*>([\\s\\S]*?)<\\/${safeTag}>`, "i");
  const selfCloseRegex = new RegExp(`<${safeTag}[^>]*href="([^"]+)"[^>]*/?>`, "i");
  const cdata = block.match(cdataRegex);
  if (cdata?.[1]) return decodeXml(cdata[1].trim());
  const plain = block.match(plainRegex);
  if (plain?.[1]) return decodeXml(plain[1].trim());
  const selfClose = block.match(selfCloseRegex);
  if (selfClose?.[1]) return decodeXml(selfClose[1].trim());
  return "";
}

function normalizeItems(xml) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  if (itemBlocks.length === 0) {
    // Some feeds are Atom format and use <entry>
    const entryBlocks = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
    return entryBlocks.map((entry) => ({
      title: extractTag(entry, "title"),
      link: extractTag(entry, "link"),
      description: extractTag(entry, "summary") || extractTag(entry, "content"),
      pubDate: extractTag(entry, "updated") || extractTag(entry, "published") || null
    }));
  }
  return itemBlocks.map((item) => ({
    title: extractTag(item, "title"),
    link: extractTag(item, "link") || extractTag(item, "guid"),
    description: extractTag(item, "description") || extractTag(item, "content:encoded"),
    pubDate: extractTag(item, "pubDate") || extractTag(item, "published") || extractTag(item, "updated") || null
  }));
}

function includesIran(text) {
  const lowered = text.toLowerCase();
  return IRAN_KEYWORDS.some((k) => lowered.includes(k.toLowerCase()));
}

function toEntry(source, type, item, idx) {
  return {
    id: `${source.id}-${type}-${idx}-${(item.link || item.title).slice(0, 24)}`,
    sourceId: source.id,
    source: source.name,
    sourceSite: source.site,
    type,
    title: item.title,
    description: item.description,
    url: item.link,
    publishedAt: item.pubDate
  };
}

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "iran-live-tracker/1.0" }
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${url} ${res.status}`);
  }
  const xml = await res.text();
  return normalizeItems(xml);
}

function sortByTimeDesc(items) {
  return [...items].sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
}

async function translateBatch(items, mode = "news") {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!key || items.length === 0) {
    return items.map((item) => ({
      ...item,
      titleZh: item.title,
      summaryZh: item.description.replace(/<[^>]+>/g, "").slice(0, 220)
    }));
  }

  const payload = {
    model,
    temperature: 0.2,
    input: [
      {
        role: "system",
        content:
          mode === "commentary"
            ? "你是严谨的国际关系编辑。请把输入文章标题与摘要翻译为中文，并输出1-2句评论要点，不添加事实。返回JSON数组。"
            : "你是新闻翻译编辑。请将输入新闻标题与摘要翻译为简体中文，并生成1句不超过45字的中文摘要。返回JSON数组。"
      },
      {
        role: "user",
        content: JSON.stringify(
          items.map((i) => ({
            id: i.id,
            source: i.source,
            title: i.title,
            description: i.description.replace(/<[^>]+>/g, "").slice(0, 500)
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

  let map = new Map();
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API failed: ${res.status} ${err}`);
    }

    const data = await res.json();
    const textOut = data?.output?.[0]?.content?.[0]?.text || data?.output_text;
    if (!textOut) {
      throw new Error("OpenAI API returned empty output");
    }
    const parsed = JSON.parse(textOut);
    const translated = Array.isArray(parsed) ? parsed : parsed.items || [];
    map = new Map(translated.map((x) => [x.id, x]));
  } catch (err) {
    console.error(`[translate:${mode}] fallback to original content:`, err.message);
  }

  return items.map((item) => {
    const t = map.get(item.id);
    return {
      ...item,
      titleZh: t?.titleZh || item.title,
      summaryZh: t?.summaryZh || item.description.replace(/<[^>]+>/g, "").slice(0, 220)
    };
  });
}

async function buildNewsTimeline() {
  const all = [];

  for (const source of NEWS_SOURCES) {
    try {
      const items = await fetchRss(source.feed);
      const iranFirst = items.filter((i) => includesIran(`${i.title} ${i.description}`));
      const selected = (iranFirst.length > 0 ? iranFirst : items).slice(0, 10);
      const filtered = selected.map((item, idx) => toEntry(source, "news", item, idx));
      all.push(...filtered);
    } catch (err) {
      console.error(`[news] ${source.name} failed:`, err.message);
    }
  }

  const translated = await translateBatch(all, "news");
  const timeline = sortByTimeDesc(translated);

  const bySource = NEWS_SOURCES.map((s) => ({
    sourceId: s.id,
    source: s.name,
    items: timeline.filter((x) => x.sourceId === s.id).slice(0, 6)
  }));

  return { timeline, bySource };
}

async function buildCommentary() {
  const commentary = [];

  for (const source of COMMENTARY_SOURCES) {
    try {
      const items = await fetchRss(source.feed);
      const iranFirst = items.filter((i) => includesIran(`${i.title} ${i.description}`));
      const selected = (iranFirst.length > 0 ? iranFirst : items).slice(0, 8);
      const filtered = selected.map((item, idx) => toEntry(source, "commentary", item, idx));
      commentary.push(...filtered);
    } catch (err) {
      console.error(`[commentary] ${source.name} failed:`, err.message);
    }
  }

  const translated = await translateBatch(commentary, "commentary");
  return sortByTimeDesc(translated);
}

async function main() {
  const [{ timeline, bySource }, commentary] = await Promise.all([
    buildNewsTimeline(),
    buildCommentary()
  ]);

  const output = {
    generatedAt: new Date().toISOString(),
    totalNews: timeline.length,
    totalCommentary: commentary.length,
    timeline,
    bySource,
    commentary
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Updated ${OUT_FILE} with ${timeline.length} news and ${commentary.length} commentary items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
