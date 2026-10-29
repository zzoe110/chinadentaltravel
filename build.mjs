/* =========================================================
   China Dental Travel — Static Site Generator
   Zero external dependencies. Run: node build.mjs
   Output: ./dist  (deploy to CloudFlare Pages, build=node build.mjs)
   ========================================================= */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodePNG, encodeICO, drawIcon, iconSVG } from "./lib/png.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const CONTENT = path.join(ROOT, "content");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const IMG = path.join(DIST, "assets", "img");

/* ---------- helpers ---------- */
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const money = (n) => "$" + Number(n).toLocaleString("en-US");
const readJSON = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const readDirJSON = async (dir) => {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  const out = [];
  for (const f of files) out.push(await readJSON(path.join(dir, f)));
  return out;
};
const writeFile = async (p, c) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, c, "utf8");
};

/* ---------- placeholder SVG art (self-contained, watermarked) ---------- */
const placeholders = new Set();
async function ph(key, title, sub = "", { w = 1200, h = 800, c1 = "#0066cc", c2 = "#2e9e5b" } = {}) {
  const file = path.join(IMG, key + ".svg");
  if (!placeholders.has(key)) {
    const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${w * 0.82}" cy="${h * 0.2}" r="${Math.min(w, h) * 0.28}" fill="rgba(255,255,255,0.10)"/>
  <text x="50%" y="47%" text-anchor="middle" fill="rgba(255,255,255,0.96)" font-family="Inter,Arial,sans-serif" font-size="${Math.round(w / 15)}" font-weight="800">${esc(title)}</text>
  ${sub ? `<text x="50%" y="57%" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-family="Inter,Arial,sans-serif" font-size="${Math.round(w / 34)}">${esc(sub)}</text>` : ""}
  <text x="50%" y="93%" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="Arial" font-size="${Math.round(w / 42)}">chinadentaltravel.com</text>
</svg>`;
    await writeFile(file, svg);
    placeholders.add(key);
  }
  return "/assets/img/" + key + ".svg";
}

/* ---------- media block (with visual watermark overlay) ---------- */
function media(src, alt, cls = "", art = {}) {
  if (!src) src = "/assets/img/" + (art.key || "ph") + ".svg";
  return `<div class="media ${cls} protect"><img src="${src}" alt="${esc(alt)}" loading="lazy"></div>`;
}

/* slugify a title for placeholder keys */
const slugify = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

/* =========================================================
   Blog: zero-dependency frontmatter + markdown parser
   Decap CMS stores posts as YAML frontmatter + markdown body
   (the `body` markdown widget becomes the content after the
   second `---` delimiter).

   parseFrontmatter uses a small YAML subset parser that
   supports scalars, inline arrays [a, b], booleans, numbers,
   nested maps and block lists — enough for blog posts
   (including a `faq` block for FAQPage structured data).
   ========================================================= */

function parseYamlScalar(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v !== "" && !isNaN(Number(v))) return Number(v);
  return v;
}

function parseInlineArray(v) {
  const inner = v.trim().slice(1, -1).trim();
  if (!inner) return [];
  const items = [];
  let cur = "", q = null;
  for (const ch of inner) {
    if (q) { cur += ch; if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ",") { items.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) items.push(cur);
  return items.map((s) => parseYamlScalar(s));
}

function parseYaml(text) {
  const lines = text.split("\n");
  let idx = 0;
  function parseBlock(indent) {
    const seq = [];
    const map = {};
    let isSeq = false;
    while (idx < lines.length) {
      const raw = lines[idx];
      if (!raw.trim() || raw.trim().startsWith("#")) { idx++; continue; }
      const curIndent = raw.match(/^(\s*)/)[1].length;
      if (curIndent < indent) break;
      const content = raw.slice(curIndent);
      if (content.startsWith("- ")) {
        isSeq = true;
        const itemContent = content.slice(2);
        const kv = itemContent.match(/^([^:]+):\s?(.*)$/);
        if (kv) {
          idx++;
          const obj = {};
          const key = kv[1].trim();
          let val = kv[2].trim();
          if (val === "") obj[key] = parseBlock(curIndent + 2);
          else if (val.startsWith("[") && val.endsWith("]")) obj[key] = parseInlineArray(val);
          else obj[key] = parseYamlScalar(val);
          while (idx < lines.length) {
            const r2 = lines[idx];
            if (!r2.trim() || r2.trim().startsWith("#")) { idx++; continue; }
            const ci2 = r2.match(/^(\s*)/)[1].length;
            if (ci2 !== curIndent + 2) break;
            const c2 = r2.slice(ci2);
            const kv2 = c2.match(/^([^:]+):\s?(.*)$/);
            if (!kv2) break;
            idx++;
            const k2 = kv2[1].trim();
            let v2 = kv2[2].trim();
            if (v2 === "") obj[k2] = parseBlock(ci2 + 2);
            else if (v2.startsWith("[") && v2.endsWith("]")) obj[k2] = parseInlineArray(v2);
            else obj[k2] = parseYamlScalar(v2);
          }
          seq.push(obj);
        } else {
          seq.push(parseYamlScalar(itemContent));
          idx++;
        }
      } else {
        const kv = content.match(/^([^:]+):\s?(.*)$/);
        if (!kv) { idx++; continue; }
        const key = kv[1].trim();
        let val = kv[2].trim();
        idx++;
        if (val === "") map[key] = parseBlock(curIndent + 2);
        else if (val.startsWith("[") && val.endsWith("]")) map[key] = parseInlineArray(val);
        else map[key] = parseYamlScalar(val);
      }
    }
    return isSeq ? seq : map;
  }
  return parseBlock(0);
}

/* split "---\n<yaml>\n---\n<markdown>" → {data, body} */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  return { data: parseYaml(m[1]), body: m[2] };
}

/* inline markdown: escape first, then bold/italic/code/link */
function inlineMd(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  return s;
}

const slugHeading = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

const splitRow = (line) =>
  line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/* block-level markdown → HTML. Returns {html, toc} */
function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const toc = [];
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) { out.push("<p>" + inlineMd(para.join(" ")) + "</p>"); para = []; }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {                       // fenced code
      flushPara();
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);     // heading
    if (h) {
      flushPara();
      const level = h[1].length;
      const text = h[2].trim();
      const id = slugHeading(text);
      out.push(`<h${level} id="${id}">${inlineMd(text)}</h${level}>`);
      if (level === 2 || level === 3) toc.push({ level, text, id });
      i++; continue;
    }
    if (/^-{3,}$/.test(line.trim())) {             // hr
      flushPara(); out.push("<hr>"); i++; continue;
    }
    if (/^>\s?/.test(line)) {                       // blockquote
      flushPara();
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push("<blockquote>" + inlineMd(q.join(" ")) + "</blockquote>");
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?[\s:|-]+\|/.test(lines[i + 1])) { // table
      flushPara();
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      let t = '<div class="table-wrap"><table class="post-table"><thead><tr>' +
        head.map((c) => `<th>${inlineMd(c)}</th>`).join("") + "</tr></thead><tbody>";
      for (const r of rows) t += "<tr>" + r.map((c) => `<td>${inlineMd(c)}</td>`).join("") + "</tr>";
      t += "</tbody></table></div>";
      out.push(t);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {                    // unordered list
      flushPara();
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      out.push("<ul>" + items.map((it) => `<li>${inlineMd(it)}</li>`).join("") + "</ul>");
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {                   // ordered list
      flushPara();
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      out.push("<ol>" + items.map((it) => `<li>${inlineMd(it)}</li>`).join("") + "</ol>");
      continue;
    }
    if (!line.trim()) { flushPara(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return { html: out.join("\n"), toc };
}

/* deterministic "Aug 27, 2026" from ISO or YYYY-MM-DD */
function formatDate(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}, ${m[1]}`;
}

/* ---------- data ---------- */
const siteData = await readJSON(path.join(CONTENT, "site.json"));
const SITE = siteData;
const NAV = siteData.nav;
const services = await readDirJSON(path.join(CONTENT, "services"));
services.sort((a, b) => (a.priority > b.priority ? 1 : -1));
const cities = await readDirJSON(path.join(CONTENT, "cities"));
const featured = cities.filter((c) => c.featured);
const faqs = (await readJSON(path.join(CONTENT, "faq.json"))).items;
const friendLinks = (await readJSON(path.join(CONTENT, "links.json"))).links || [];
/* 网点网络：平台化定位的实体数据。brands 支持多品牌（京州口腔为发起网络，
   兄弟单位品牌预留 status=planned，不对外展示）；前台只展示 status=operating 的门店。 */
const NET = await readJSON(path.join(CONTENT, "network.json"));
const BRAND_BY_ID = Object.fromEntries((NET.brands || []).map((b) => [b.id, b]));
const NETWORK_REGIONS = NET.regions || [];
/* 在营门店（前台口径）——planned 的不计入任何对外数字 */
const CLINICS = NETWORK_REGIONS.flatMap((r) =>
  (r.clinics || []).filter((c) => c.status === "operating").map((c) => ({ ...c, region: r }))
);
const REGION_BY_ID = Object.fromEntries(NETWORK_REGIONS.map((r) => [r.id, r]));
const YEAR = new Date().getFullYear();
const WA = SITE.contact.whatsapp;
const WA_LINK = "https://wa.me/" + WA.replace(/[^0-9]/g, "");
const STATS = SITE.statsCode || "";

/* ---------- header / footer ---------- */
function header(active) {
  const nav = NAV.map((n) => {
    const on = n.href === active ? ' style="color:var(--blue);font-weight:700"' : "";
    return `<a href="${n.href}"${on}>${esc(n.label)}</a>`;
  }).join("");
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/">
      <span class="logo-mark">✚</span>
      <span>China Dental Travel<small>中国口腔医疗旅游</small></span>
    </a>
    <nav class="nav" id="nav">${nav}</nav>
    <div class="header-cta">
      <a class="btn btn-whatsapp" href="${WA_LINK}">WhatsApp</a>
      <button class="nav-toggle" aria-label="Menu" id="navToggle">&#9776;</button>
    </div>
  </div>
</header>`;
}

function footer() {
  const explore = NAV.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join("");
  const svcLinks = services.map((s) => `<a href="/services/${s.slug}/">${esc(s.name)}</a>`).join("");
  const friendOpts = friendLinks.map((l) => `<option value="${esc(l.url)}">${esc(l.label)}</option>`).join("");
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="brand" style="color:#fff"><span class="logo-mark">✚</span><span>China Dental Travel</span></div>
        <p style="color:#cdd7e2;margin-top:12px;font-size:14px">${esc(SITE.tagline)} — affordable, licensed dental care paired with travel across China.</p>
      </div>
      <div><h4>Explore</h4>${explore}</div>
      <div><h4>Services</h4>${svcLinks}</div>
      <div><h4>Contact</h4>
        <a href="${WA_LINK}">WhatsApp: ${esc(SITE.contact.whatsappDisplay)}</a>
        <a href="mailto:${esc(SITE.contact.email)}">${esc(SITE.contact.email)}</a>
        <a href="${esc(SITE.contact.facebook)}">Facebook Messenger</a>
        <a href="tel:${esc(SITE.contact.phone)}">${esc(SITE.contact.phone)}</a>
      </div>
      <div><h4>Friends</h4>
        <label class="visually-hidden" for="friendLinks">Friend websites</label>
        <select id="friendLinks" class="footer-select" aria-label="Friend websites" onchange="if(this.value){window.open(this.value, '_blank', 'noopener');this.selectedIndex=0;}">
          <option value="" selected>Choose a site…</option>
          ${friendOpts}
        </select>
        <p style="color:#8fa0b3;font-size:12px;margin-top:10px;line-height:1.5">Partner &amp; friend websites worth visiting.</p>
      </div>
      <div><h4>Language</h4>
        <div id="google_translate_element" class="footer-translate"></div>
        <p style="color:#8fa0b3;font-size:12px;margin-top:10px;line-height:1.5">Translate this site into your language.</p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${YEAR} ${esc(SITE.name)}. All rights reserved.</span>
      <span>Fonts: Inter &amp; Noto Sans SC (SIL Open Font License)</span>
    </div>
    <p class="disclaimer">${esc(SITE.disclaimer)}</p>
  </div>
  ${STATS}
  <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>
</footer>`;
}

function page({ title, description, body, jsonld, active, path, ogImage, extraHead = "" }) {
  const fullTitle = title.includes(SITE.name) ? title : title + (SITE.seo.titleSuffix || "");
  /* 社交平台（Facebook / X / WhatsApp / LinkedIn）不识别 SVG 作分享图，
     会把卡片渲染成空白。任何 SVG 封面一律兜底为默认位图，避免分享丢缩略图。 */
  const ogDefault = SITE.seo.ogImage && !SITE.seo.ogImage.endsWith(".svg")
    ? SITE.seo.ogImage
    : "/assets/img/hl-beijing-forbidden.jpg";
  const og = ogImage && !ogImage.endsWith(".svg") ? ogImage : ogDefault;
  /* canonical / hreflang / og:url 必须使用页面自身的真实路径（path）。
     切勿复用导航高亮变量 active —— 否则子页面会把 canonical 声明成上级列表页
     （如 /services/dental-implants/ 声明为 /services/），被 Google 判定为重复内容
     并拒绝索引。active 只管导航高亮，path 只标识页面自身，两者职责必须分开。 */
  if (!path) throw new Error(`page() 缺少 path 参数（canonical 所需的页面真实路径）：${title}`);
  const selfUrl = esc(SITE.domain) + path;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="${esc(SITE.seo.keywords)}">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="canonical" href="${selfUrl}">
  <link rel="alternate" hreflang="en" href="${selfUrl}">
  <link rel="alternate" hreflang="x-default" href="${selfUrl}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(SITE.domain)}${og}">
  <meta property="og:image:alt" content="${esc(fullTitle)}">
  <meta property="og:url" content="${selfUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(SITE.domain)}${og}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/style.css">
  ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
  ${extraHead}
</head>
<body>
  ${header(active)}
  <main>${body}</main>
  ${footer()}
  <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

/* ---------- shared widgets ---------- */
function ctaBand() {
  return `<section class="section-soft">
  <div class="container center">
    <h2>Ready to plan your dental trip to China?</h2>
    <p class="lead-lg">Message us on WhatsApp or email. We reply within 24 hours with a tailored plan and transparent prices.</p>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn btn-whatsapp" href="${WA_LINK}">Chat on WhatsApp</a>
      <a class="btn btn-primary" href="/contact/">Contact Us</a>
    </div>
  </div>
</section>`;
}

/* ================= PAGES ================= */

/* ---------- 网点渲染（平台化核心组件） ---------- */
/* 单张门店卡：品牌名 + 门店名 + 城市 + 专长标签。
   注意：不输出地址与电话——平台红线是线索只进平台，机构不直接接触患者。
   地址电话保留在 content/network.json 数据层，供内部与后续对接使用。 */
function clinicCard(c, opts = {}) {
  const brand = BRAND_BY_ID[c.brand] || {};
  const focus = (c.focus || []).map((f) => `<span class="clinic-focus">${esc(f)}</span>`).join("");
  return `
    <div class="clinic-card${c.flagship ? " flagship" : ""}">
      <div class="clinic-card-head">
        <span class="clinic-brand">${esc(brand.name || c.brand)}</span>
        ${c.flagship ? '<span class="clinic-flag">Flagship</span>' : ""}
      </div>
      <h4>${esc(c.name)}</h4>
      <div class="clinic-city">${esc(c.cityZh || c.city)}${c.since ? ` · Est. ${esc(c.since)}` : ""}</div>
      ${focus ? `<div class="clinic-focus-list">${focus}</div>` : ""}
      ${opts.note ? `<p class="clinic-note">${esc(opts.note)}</p>` : ""}
    </div>`;
}

/* 一个区域分组（含该区在营门店） */
function regionBlock(r, opts = {}) {
  const list = (r.clinics || []).filter((c) => c.status === "operating");
  if (!list.length) return "";
  const cards = list.map((c) => clinicCard(c, opts)).join("");
  return `
    <div class="net-region" id="region-${esc(r.id)}">
      <div class="net-region-head">
        <div>
          <h3>${esc(r.name)}</h3>
          <div class="net-region-zh">${esc(r.nameZh)} · ${list.length} ${list.length === 1 ? "clinic" : "clinics"}</div>
        </div>
      </div>
      ${r.note ? `<p class="net-region-note">${esc(r.note)}</p>` : ""}
      <div class="clinic-grid">${cards}</div>
    </div>`;
}

/* ---- Home ---- */
function buildHome() {
  /* whyChina 文案支持 {CLINIC_COUNT} / {REGION_COUNT} 占位符，
     构建时按真实网点数据注入，避免后台改门店后数字失真。 */
  const fillTokens = (s) => String(s || "")
    .replace(/\{CLINIC_COUNT\}/g, CLINICS.length)
    .replace(/\{REGION_COUNT\}/g, NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).length);
  const why = siteData.whyChina.map((w) => `
    <div class="card">
      <div class="ic">${w.icon}</div>
      <h3>${esc(w.title)}</h3>
      <p>${esc(fillTokens(w.text))}</p>
    </div>`).join("");

  const svcCards = services.map((s) => `
    <a class="card service-card" href="/services/${s.slug}/" style="text-decoration:none;color:inherit">
      <div class="media protect" style="height:170px"><img src="/assets/img/svc-${s.slug}.svg" alt="${esc(s.name)}" loading="lazy"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:14px 0 0">${esc(s.name)}</h3>
        <span class="tag-priority ${s.priority === "P0" ? "tag-p0" : "tag-p1"}">${esc(s.priority)}</span>
      </div>
      <p class="tagline" style="color:var(--green);font-weight:600;font-size:14px">${esc(s.tagline)}</p>
      <span class="price-pill">${money(s.priceFrom)} – ${money(s.priceTo)} ${esc(s.priceUnit)}</span>
      <p style="color:var(--muted);font-size:15px">${esc(s.summary)}</p>
    </a>`).join("");
  // generate service placeholder art (pre-generated in build())
  const cityCards = featured.map((c) => `
    <a class="card city-card" href="/destinations/${c.slug}/" style="text-decoration:none;color:inherit">
      <div class="media protect" style="height:180px"><img src="${c.heroImage || '/assets/img/city-' + c.slug + '-hero.svg'}" alt="${esc(c.name)}" loading="lazy"></div>
      <div class="body">
        <h3>${esc(c.name)}</h3>
        <div class="tagline">${esc(c.tagline)}</div>
        <p style="color:var(--muted);font-size:14px">${esc(c.region)}</p>
      </div>
    </a>`).join("");

  const steps = siteData.process.map((p) => `
    <div class="card process-step">
      <div class="num">${esc(p.step)}</div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.text)}</p>
    </div>`).join("");

  const body = `
  <section class="hero">
    <div class="container hero-inner">
      <h1>${esc(SITE.tagline)}</h1>
      <p class="lead">${esc(SITE.description)}</p>
      <div class="hero-actions">
        <a class="btn btn-whatsapp" href="${WA_LINK}">Chat on WhatsApp</a>
        <a class="btn btn-outline" style="color:#fff;border-color:#fff" href="/destinations/">Explore Destinations</a>
      </div>
      <div class="hero-badges">
        <div><strong>${CLINICS.length}</strong>Clinics</div>
        <div><strong>${NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).length}</strong>Regions</div>
        <div><strong>40–70%</strong>Typical savings</div>
        <div><strong>16 yrs</strong>Clinical heritage</div>
      </div>
    </div>
  </section>

  <section>
    <div class="container">
      <div class="section-head">
        <div class="eyebrow">Why China</div>
        <h2>World-class care at a fraction of the cost</h2>
        <p>Combine trusted dentistry with an unforgettable trip across Beijing and Guizhou.</p>
      </div>
      <div class="grid grid-4">${why}</div>
    </div>
  </section>

  <section class="section-soft">
    <div class="container">
      <div class="section-head">
        <div class="eyebrow">Our Services</div>
        <h2>Dental treatments we coordinate</h2>
      </div>
      <div class="grid grid-3">${svcCards}</div>
    </div>
  </section>

  <section>
    <div class="container">
      <div class="section-head">
        <div class="eyebrow">Clinic Network</div>
        <h2>${CLINICS.length} clinics, ${NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).length} regions, one coordinator</h2>
        <p>Our network spans Guizhou's prefectures and Beijing — so your appointments can be scheduled around your travel route, not against it.</p>
      </div>
      <div class="net-preview">
        ${NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).map((r) => {
          const list = r.clinics.filter((c) => c.status === "operating");
          return `<a class="net-preview-item" href="/network/#region-${esc(r.id)}">
            <span class="net-preview-zh">${esc(r.nameZh)}</span>
            <span class="net-preview-n">${list.length}</span>
            <span class="net-preview-en">${esc(r.name)}</span>
          </a>`;
        }).join("")}
      </div>
      <div class="center" style="margin-top:30px"><a class="btn btn-outline" href="/network/">See the full clinic network</a></div>
    </div>
  </section>

  <section>
    <div class="container">
      <div class="section-head">
        <div class="eyebrow">Destinations</div>
        <h2>Heal where you'd love to travel</h2>
        <p>From imperial Beijing to the karst wonders of Guizhou.</p>
      </div>
      <div class="grid grid-3">${cityCards}</div>
      <div class="center" style="margin-top:30px"><a class="btn btn-outline" href="/destinations/">View all destinations</a></div>
    </div>
  </section>

  <section class="section-soft">
    <div class="container">
      <div class="section-head">
        <div class="eyebrow">How it works</div>
        <h2>Four simple steps</h2>
      </div>
      <div class="grid grid-4">${steps}</div>
    </div>
  </section>

  ${ctaBand()}`;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE.name,
    "url": SITE.domain,
    "logo": SITE.domain + "/assets/img/og-cover.svg",
    "description": SITE.description,
    "email": SITE.contact.email,
    "sameAs": [SITE.contact.facebook, SITE.organization.social.instagram, SITE.organization.social.youtube],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": SITE.contact.phone,
      "contactType": "customer service",
      "areaServed": "Worldwide",
      "availableLanguage": ["English", "Chinese"]
    },
    "makesOffer": services.map((s) => ({
      "@type": "Offer",
      "itemOffered": { "@type": "Service", "name": s.name },
      "priceCurrency": "USD",
      "price": s.priceFrom
    }))
  };
  return page({ title: SITE.name, description: "Dental tourism in China: " + CLINICS.length + " vetted clinics across " + NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).length + " regions, coordinated by one English-speaking team. Implants, whitening and general care with transparent pricing, paired with travel to Beijing and Guizhou.", body, jsonld, active: "/", path: "/" });
}

/* ---- Services index ---- */
function buildServicesIndex() {
  const cards = services.map((s) => `
    <div class="card service-card">
      <span class="tag-priority ${s.priority === "P0" ? "tag-p0" : "tag-p1"}">${esc(s.priority)}</span>
      <h3 style="margin-top:10px">${esc(s.name)}</h3>
      <p class="tagline" style="color:var(--green);font-weight:600;font-size:14px">${esc(s.tagline)}</p>
      <span class="price-pill">${money(s.priceFrom)} – ${money(s.priceTo)} ${esc(s.priceUnit)}</span>
      <p style="color:var(--muted);font-size:15px">${esc(s.summary)}</p>
      <a class="btn btn-outline" href="/services/${s.slug}/">Learn more</a>
    </div>`).join("");
  const body = `
  <section class="detail-hero"><div class="container">
    <h1>Our Dental Services</h1>
    <p class="tagline">Transparent pricing, licensed clinicians, English-speaking coordination.</p>
  </div></section>
  <section><div class="container"><div class="grid grid-3">${cards}</div>
    <p class="notice" style="margin-top:26px">Prices are indicative ranges and vary by city and individual assessment. Your final quote is confirmed by a licensed dentist before any treatment.</p>
  </div></section>
  ${ctaBand()}`;
  return page({ title: "Dental Services in China", description: "Dental implants, teeth whitening and general dental care in China at transparent prices — treatment plans and costs for international patients.", body, active: "/services/", path: "/services/" });
}

/* ---- Service detail ---- */
function buildService(s) {
  const includes = s.includes.map((i) => `<li>${esc(i)}</li>`).join("");
  const faq = (s.faq || []).map((f, i) => `
    <div class="faq-item${i === 0 ? " open" : ""}">
      <button>${esc(f.q)}<span class="plus">${i === 0 ? "−" : "+"}</span></button>
      <div class="answer">${esc(f.a)}</div>
    </div>`).join("");
  const body = `
  <section class="detail-hero"><div class="container">
    <div class="breadcrumb" style="color:#cfe6ff"><a href="/" style="color:#cfe6ff">Home</a> / <a href="/services/" style="color:#cfe6ff">Services</a> / ${esc(s.name)}</div>
    <h1>${esc(s.name)}</h1>
    <p class="tagline">${esc(s.tagline)}</p>
  </div></section>

  <section><div class="container grid grid-2" style="align-items:start">
    <div>
      <p class="lead-lg">${esc(s.summary)}</p>
      <h3>What's included</h3>
      <ul class="check">${includes}</ul>
      <p><strong>Typical duration:</strong> ${esc(s.duration)}</p>
      <a class="btn btn-whatsapp" href="${WA_LINK}">Ask about this treatment</a>
    </div>
    <div class="card" style="text-align:center">
      <h3>Indicative price</h3>
      <div style="font-size:2rem;font-weight:800;color:var(--blue)">${money(s.priceFrom)} – ${money(s.priceTo)}</div>
      <p style="color:var(--muted)">${esc(s.priceUnit)}</p>
      <p class="notice">Final price confirmed by a licensed dentist after assessment.</p>
    </div>
  </div></section>

  ${faq ? `<section class="section-soft"><div class="container" style="max-width:820px">
    <div class="section-head" style="margin-bottom:24px"><h2>Frequently asked</h2></div>${faq}
  </div></section>` : ""}
  ${ctaBand()}`;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "name": s.name,
    "description": s.summary,
    "lastReviewed": new Date().toISOString().slice(0, 10),
    "about": { "@type": "MedicalProcedure", "name": s.name }
  };
  return page({ title: s.name + " in China", description: s.summary, body, jsonld, active: "/services/", path: "/services/" + s.slug + "/" });
}

/* ---- Destinations index ---- */
function buildDestinationsIndex() {
  const cards = cities.map((c) => `
    <a class="card city-card" href="/destinations/${c.slug}/" style="text-decoration:none;color:inherit">
      <div class="media protect" style="height:180px"><img src="${c.heroImage || '/assets/img/city-' + c.slug + '-hero.svg'}" alt="${esc(c.name)}" loading="lazy"></div>
      <div class="body">
        <h3>${esc(c.name)}</h3>
        <div class="tagline">${esc(c.tagline)}</div>
        <p style="color:var(--muted);font-size:14px">${esc(c.region)}</p>
      </div>
    </a>`).join("");
  const body = `
  <section class="detail-hero"><div class="container">
    <h1>Destinations</h1>
    <p class="tagline">Where world-class dentistry meets unforgettable travel.</p>
  </div></section>
  <section><div class="container"><div class="grid grid-3">${cards}</div></div></section>
  ${ctaBand()}`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": cities.map((c, i) => ({
      "@type": "ListItem", "position": i + 1,
      "url": SITE.domain + "/destinations/" + c.slug + "/",
      "name": c.name
    }))
  };
  return page({ title: "Dental Tourism Destinations in China", description: "Explore dental tourism destinations in China — Beijing and Guizhou (Xingyi, Kaili, Zunyi, Bijie, Liupanshui) with clinics, prices and travel guides.", body, jsonld, active: "/destinations/", path: "/destinations/" });
}

/* ---- Clinic Network（平台网点总览） ---- */
function buildNetwork() {
  const regionCount = NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).length;
  const gzRegions = NETWORK_REGIONS.filter((r) => r.id !== "beijing" && r.id !== "yunnan" && (r.clinics || []).some((c) => c.status === "operating")).length;
  const gzClinics = CLINICS.filter((c) => c.region.id !== "beijing" && c.region.id !== "yunnan").length;

  /* 区域跳转条 */
  const jumps = NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).map((r) =>
    `<a href="#region-${esc(r.id)}">${esc(r.nameZh)} <span>${(r.clinics || []).filter((c) => c.status === "operating").length}</span></a>`
  ).join("");

  const blocks = NETWORK_REGIONS.map((r) => regionBlock(r)).join("");

  /* 平台机制说明——为什么是平台而不是单家诊所 */
  const howItWorks = [
    {
      ic: "🗺️",
      h: "One network, many cities",
      p: `You are not locked into a single clinic. Our ${CLINICS.length} clinics span ${regionCount} regions, so a treatment plan can be scheduled around your travel route — start in one city, continue in another, and stay inside one clinical standard throughout.`
    },
    {
      ic: "🔍",
      h: "Every clinic vetted, not listed on request",
      p: "Each clinic in the network holds a valid Chinese Medical Institution License and works to the same clinical protocols. We review licenses and clinical records before a clinic joins — we do not accept listings on request."
    },
    {
      ic: "💬",
      h: "One coordinator, every clinic",
      p: "You deal with a single English-speaking coordination team on WhatsApp, email and video call. They hold your records, book across clinics, and stay reachable after you fly home. You never coordinate between hospitals yourself."
    },
    {
      ic: "🛡️",
      h: "Records that travel with you",
      p: "Digital scans, X-rays and your aftercare plan are organised centrally, so a follow-up in another city or another province is a continuation — not a restart."
    }
  ].map((x) => `
    <div class="card">
      <div class="ic">${x.ic}</div>
      <h3>${esc(x.h)}</h3>
      <p>${esc(x.p)}</p>
    </div>`).join("");

  const body = `
  <section class="detail-hero"><div class="container">
    <div class="breadcrumb" style="color:#cfe6ff"><a href="/" style="color:#cfe6ff">Home</a> / <span>Clinic Network</span></div>
    <h1>Our Clinic Network</h1>
    <p class="tagline">${CLINICS.length} clinics across ${regionCount} regions of China — coordinated as one network, planned around your trip.</p>
    <div class="hero-badges" style="margin-top:22px">
      <div><strong>${CLINICS.length}</strong>Clinics</div>
      <div><strong>${regionCount}</strong>Regions</div>
      <div><strong>${gzRegions}</strong>Guizhou prefectures</div>
      <div><strong>40–70%</strong>Typical savings</div>
    </div>
  </div></section>

  <section>
    <div class="container">
      <div class="section-head">
        <div class="eyebrow">Why a network matters</div>
        <h2>One coordinator, ${CLINICS.length} clinics, ${regionCount} regions</h2>
        <p>International dental travel goes wrong for predictable reasons: appointments clash, one clinic cannot handle a complex case, and nobody is accountable when a plan changes. Network coverage is how we remove those failure points.</p>
      </div>
      <div class="grid grid-4">${howItWorks}</div>
    </div>
  </section>

  <section class="section-soft">
    <div class="container">
      <div class="section-head" style="text-align:left">
        <div class="eyebrow">Guizhou depth</div>
        <h2>${gzClinics} clinics across ${gzRegions} Guizhou prefectures</h2>
        <p>Guizhou is where our founding network grew, and it is where the density is. Travelling inside a single province of karst mountains, Miao villages and cool highland towns means your appointments cluster geographically — shorter transfers, easier follow-ups, and recovery in scenery that genuinely helps.</p>
      </div>
      <div class="net-jump">${jumps}</div>
    </div>
  </section>

  <section>
    <div class="container">
      <div class="section-head" style="text-align:left">
        <div class="eyebrow">Full listing</div>
        <h2>Every clinic in the network</h2>
        <p>Each card lists the clinic, its city and the treatments it focuses on. Tell us what you need and we will match you to the right clinic and the right city.</p>
      </div>
      ${blocks}
    </div>
  </section>

  <section class="section-soft">
    <div class="container" style="max-width:900px">
      <div class="section-head" style="text-align:left">
        <div class="eyebrow">Open network</div>
        <h2>A platform, not a single clinic group</h2>
        <p>China Dental Travel was founded by a dental group, but it is built to be a platform. Our founding network is the largest operator in the network today; qualified clinics in other provinces join on the same licensing, clinical and coordination standards. This means you are never negotiating with a single clinic — you are dealing with a network that has to work for you.</p>
      </div>
      <div class="grid grid-3" style="margin-top:22px">
        <div class="card" style="padding:18px 20px"><h3 style="margin-bottom:6px">Founding network</h3><p style="color:var(--muted);font-size:14px">${CLINICS.length} clinics operating across Guizhou and Beijing, with unified clinical standards and a single English-speaking coordination team.</p></div>
        <div class="card" style="padding:18px 20px"><h3 style="margin-bottom:6px">Partner clinics</h3><p style="color:var(--muted);font-size:14px">Independently operated clinics that meet the same licensing, clinical and aftercare standards. Every one is reviewed before it appears here.</p></div>
        <div class="card" style="padding:18px 20px"><h3 style="margin-bottom:6px">For clinics</h3><p style="color:var(--muted);font-size:14px">If your clinic meets our standards and wants access to international dental travellers, contact us to discuss joining the network.</p></div>
      </div>
    </div>
  </section>

  ${ctaBand()}`;

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "name": "China Dental Travel clinic network",
        "numberOfItems": CLINICS.length,
        "itemListElement": CLINICS.map((c, i) => ({
          "@type": "ListItem", "position": i + 1,
          "name": c.name,
          "url": SITE.domain + "/network/#region-" + c.region.id
        }))
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.domain + "/" },
          { "@type": "ListItem", "position": 2, "name": "Clinic Network", "item": SITE.domain + "/network/" }
        ]
      }
    ]
  };
  return page({ title: "Clinic Network — " + CLINICS.length + " Dental Clinics Across China", description: "Explore the China Dental Travel clinic network — " + CLINICS.length + " vetted dental clinics across " + regionCount + " regions of China, with " + gzRegions + " Guizhou prefectures covered. One coordinator, one standard of care.", body, jsonld, active: "/network/", path: "/network/" });
}

/* ---- City detail ---- */
async function buildCity(c) {
  const hl = c.tourism.highlights.map((h, i) => `
    <div class="highlight-item">
      ${media(h.image, h.name, "", { key: "city-" + c.slug + "-hl-" + i })}
      <div><h4>${esc(h.name)}</h4><p>${esc(h.description)}</p></div>
    </div>`).join("");

  const itin = c.tourism.itinerary.map((d) => `
    <li data-day="${esc(d.day)}"><h4>${esc(d.title)}</h4><p>${esc(d.description)}</p></li>`).join("");

  /* 医疗资源 = 该区域在营门店清单（不再展示医生个人资料） */
  const region = REGION_BY_ID[c.networkRegion];
  const inst = region ? regionBlock(region) : "";
  const regionCount = region ? (region.clinics || []).filter((x) => x.status === "operating").length : 0;
  // price table
  const priceRows = services.map((s) => {
    const p = c.prices[s.slug] || {};
    const range = p.from ? `${money(p.from)} – ${money(p.to)}` : "On request";
    return `<tr><td>${esc(s.name)}</td><td class="price">${range}</td><td>${esc(s.priceUnit)}</td></tr>`;
  }).join("");

  const body = `
  <section class="detail-hero"><div class="container">
    <div class="breadcrumb" style="color:#cfe6ff"><a href="/" style="color:#cfe6ff">Home</a> / <a href="/destinations/" style="color:#cfe6ff">Destinations</a> / ${esc(c.name)}</div>
    <h1>${esc(c.name)} <span style="font-size:1rem;font-weight:500;opacity:.8">${esc(c.nameZh)}</span></h1>
    <p class="tagline">${esc(c.tagline)} · ${esc(c.region)}</p>
  </div></section>

  <section class="block">
    <div class="container">
      <div class="block-title"><span class="badge">1</span><h2>Tourism Destination</h2></div>
      <p class="lead-lg">${esc(c.intro)}</p>
      <h3 style="margin-top:24px">Highlights</h3>
      ${hl}
      <h3 style="margin-top:30px">Suggested itinerary</h3>
      <ul class="itinerary">${itin}</ul>
    </div>
  </section>

  <section class="block alt">
    <div class="container">
      <div class="block-title green"><span class="badge">2</span><h2>Medical Network</h2></div>
      <p class="lead-lg">${esc(c.medical.advantages)}</p>
      <h3 style="margin-top:24px">Clinics in this region${regionCount ? ` <span style="font-weight:400;font-size:.9rem;color:var(--muted)">(${regionCount})</span>` : ""}</h3>
      ${inst}
      <div style="margin-top:26px">
        <a class="btn btn-outline" href="/network/">See the full clinic network</a>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="container" style="max-width:860px">
      <div class="block-title"><span class="badge">$</span><h2>Indicative price ranges</h2></div>
      <div class="price-table-wrap">
        <table class="price-table">
          <thead><tr><th>Treatment</th><th>Price range</th><th>Unit</th></tr></thead>
          <tbody>${priceRows}</tbody>
        </table>
      </div>
      <p class="notice" style="margin-top:14px">Prices are indicative only and vary by individual assessment and clinic. Final quotes are confirmed by a licensed dentist.</p>
      <div style="margin-top:24px">${ctaBand().replace(/<section class="section-soft">/, '<div>').replace(/<\/section>/, '</div>')}</div>
    </div>
  </section>`;

  const localBiz = (region ? (region.clinics || []).filter((x) => x.status === "operating") : []).map((inst) => ({
    "@type": "MedicalOrganization",
    "name": inst.name,
    "parentOrganization": { "@type": "Organization", "name": (BRAND_BY_ID[inst.brand] || {}).name || "China Dental Travel" },
    "medicalSpecialty": inst.focus || []
  }));
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        "name": c.name,
        "description": c.intro,
        "touristType": "Dental tourists",
        "address": { "@type": "PostalAddress", "addressRegion": c.region, "addressCountry": "CN" }
      },
      ...localBiz,
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.domain + "/" },
          { "@type": "ListItem", "position": 2, "name": "Destinations", "item": SITE.domain + "/destinations/" },
          { "@type": "ListItem", "position": 3, "name": c.name, "item": SITE.domain + "/destinations/" + c.slug + "/" }
        ]
      }
    ]
  };
  return page({ title: c.name + " Dental Tourism", description: c.tagline + " — " + regionCount + " clinics in " + c.name + " with transparent treatment prices, coordinated by one English-speaking team. Plan your dental trip with our local coordinators.", body, jsonld, active: "/destinations/", path: "/destinations/" + c.slug + "/" });
}

/* ---- About ---- */
function buildAbout() {
  const team = [
    {
      img: "/assets/img/team/canfeng.jpg",
      name: "Can Feng",
      nameZh: "澯烽",
      role: "Founder, China Dental Travel",
      creds: ["Planning Director, Jingzhou Dental Group", "10 yrs media & marketing · 6 yrs dental industry"]
    },
    {
      img: "/assets/img/team/xiefang.jpg",
      name: "Jie Fang",
      nameZh: "解放",
      role: "Strategy & International Relations",
      creds: ["Renmin Univ. (Finance '06) · HEC Paris (Mgmt & Finance '10)", "Chief Strategy Officer, Beijing Jingzhou Dental Group", "CEO, Beijing Jingde Dental · Founder, Arcnova AI · Dir., Shanghai Qimei Orthodontics"]
    },
    {
      img: "/assets/img/team/mengxiangyun.jpg",
      name: "Meng Xiangyun",
      nameZh: "孟祥云",
      role: "Clinical Operations & Patient Experience",
      creds: ["Founder & CEO, YiYi Medical Management", "Senior Psychological Counselor · Oral Health Manager (China)", "Served 7+ dental groups incl. Meikefu (Fuzhou), Ningbo Dental, Hangzhou Stomatology, White Rabbit (Shaanxi) & more"]
    }
  ];
  const teamCards = team.map((m) => `
    <div class="card team-card">
      <div class="team-photo"><img src="${m.img}" alt="${esc(m.name)} — ${esc(m.role)}" loading="lazy"></div>
      <div class="team-body">
        <h3>${esc(m.name)} <span class="team-zh">${esc(m.nameZh)}</span></h3>
        <div class="team-role">${esc(m.role)}</div>
        <ul class="team-creds">${m.creds.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      </div>
    </div>`).join("");

  const regionCount = NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).length;
  const body = `
  <section class="detail-hero"><div class="container">
    <h1>About China Dental Travel</h1>
    <p class="tagline">A clinic network and coordination platform for international dental patients.</p>
  </div></section>
  <section><div class="container">
    <div class="block-title"><span class="badge">✚</span><h2>A network first, a platform second</h2></div>
    <p class="lead-lg" style="max-width:900px;margin-bottom:16px">China Dental Travel connects overseas patients with vetted, high-quality dental care in China — and turns necessary treatment into an extraordinary trip. We were founded by a dental group, ${esc(SITE.organization.founderClinic)}, which remains the largest operator in the network today with ${CLINICS.length} clinics across ${regionCount} regions and 16 years of clinical heritage. But the platform itself is deliberately larger than any one group: independently operated clinics join on the same licensing, clinical and aftercare standards, and every clinic holds a valid Chinese Medical Institution License, verified before we list it.</p>
    <p class="lead-lg" style="max-width:900px;margin-bottom:16px">The reason to organise it as a network is practical. International dental treatment rarely goes wrong because the medicine is wrong — it goes wrong because appointments clash across cities, because a complex case needs a discipline the first clinic does not have, or because nobody is accountable when a plan changes. ${CLINICS.length} clinics in ${regionCount} regions, coordinated by one English-speaking team, removes those failure points. You get the density of a large group with the accountability of a single point of contact.</p>
    <div class="stat-row" style="justify-content:flex-start;gap:48px">
      <div class="stat"><strong>16+</strong><span>Years heritage</span></div>
      <div class="stat"><strong>${CLINICS.length}</strong><span>Clinics in network</span></div>
      <div class="stat"><strong>${regionCount}</strong><span>Regions</span></div>
      <div class="stat"><strong>${cities.length}</strong><span>Destinations</span></div>
    </div>
  </div></section>

  <section class="section-soft"><div class="container">
    <div class="section-head" style="margin-bottom:26px"><div class="eyebrow">Our team</div><h2 style="margin-bottom:6px">The people behind your trip</h2></div>
    <div class="team-grid">${teamCards}</div>
  </div></section>

  <section class="section-soft" style="padding:40px 0"><div class="container">
    <div class="section-head" style="margin-bottom:26px"><div class="eyebrow">Our promise</div><h2 style="margin-bottom:6px">What you can count on</h2></div>
    <div class="grid grid-3">
      <div class="card" style="padding:18px 20px"><h3 style="margin-bottom:4px">Vetted clinics</h3><p style="color:var(--muted);font-size:14px">Licensed medical institutions only. We review credentials before listing, not after.</p></div>
      <div class="card" style="padding:18px 20px"><h3 style="margin-bottom:4px">Transparent prices</h3><p style="color:var(--muted);font-size:14px">Indicative ranges up front; confirmed quotes before treatment.</p></div>
      <div class="card" style="padding:18px 20px"><h3 style="margin-bottom:4px">English support</h3><p style="color:var(--muted);font-size:14px">Bilingual coordination from first message to aftercare.</p></div>
    </div>
  </div></section>`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE.name,
    "url": SITE.domain,
    "description": SITE.description,
    "founder": { "@type": "Organization", "name": SITE.organization.founderClinic },
    "employee": team.map((m) => ({
      "@type": "Person",
      "name": m.name,
      "jobTitle": m.role
    }))
  };
  return page({ title: "About Us — Dental Tourism in China", description: "China Dental Travel is a clinic network and coordination platform for international dental patients — " + CLINICS.length + " vetted clinics across " + regionCount + " regions, coordinated by one English-speaking team.", body, jsonld, active: "/about/", path: "/about/" });
}

/* ---- Contact ---- */
function buildContact() {
  const qr = "/assets/img/whatsapp-qr.png";
  const body = `
  <section class="detail-hero contact-hero"><div class="container">
    <h1>Contact Us</h1>
    <p class="tagline">We usually reply within 24 hours.</p>
  </div></section>
  <section class="contact-section"><div class="container">
    <div class="contact-grid">
      <div class="contact-card">
        <div class="ic">💬</div>
        <h3>WhatsApp</h3>
        <img class="qr protect" src="${qr}" alt="WhatsApp QR code" loading="lazy">
        <a class="btn btn-whatsapp" href="${WA_LINK}">${esc(SITE.contact.whatsappDisplay)}</a>
      </div>
      <div class="contact-card">
        <div class="ic">✉️</div>
        <h3>Email</h3>
        <div class="c-ico">@</div>
        <a class="big" href="mailto:${esc(SITE.contact.email)}">${esc(SITE.contact.email)}</a>
      </div>
      <div class="contact-card">
        <div class="ic">👍</div>
        <h3>Facebook</h3>
        <div class="c-ico">f</div>
        <a class="big" href="${esc(SITE.contact.facebook)}">Message us</a>
      </div>
      <div class="contact-card">
        <div class="ic">📞</div>
        <h3>Phone</h3>
        <div class="c-ico">☎</div>
        <a class="big" href="tel:${esc(SITE.contact.phone)}">${esc(SITE.contact.phone)}</a>
      </div>
    </div>
    <p class="notice" style="margin-top:22px">When you contact us, please include your country, the treatment you need, and any recent X-rays if available. This helps us match you with the right licensed clinic and prepare an accurate plan.</p>
    <p class="disclaimer" style="margin-top:12px">${esc(SITE.disclaimer)}</p>
  </div></section>`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE.name,
    "url": SITE.domain,
    "email": SITE.contact.email,
    "telephone": SITE.contact.phone,
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": SITE.contact.phone,
      "contactType": "customer service",
      "availableLanguage": ["English", "Chinese"]
    }
  };
  return page({ title: "Contact Us — Dental Treatment in China", description: "Contact China Dental Travel on WhatsApp or email — free treatment plans and price quotes for dental care in China within 24 hours.", body, jsonld, active: "/contact/", path: "/contact/" });
}

/* ---- FAQ ---- */
function buildFaq() {
  const items = faqs.map((f, i) => `
    <div class="faq-item${i === 0 ? " open" : ""}">
      <button>${esc(f.q)}<span class="plus">${i === 0 ? "−" : "+"}</span></button>
      <div class="answer">${esc(f.a)}</div>
    </div>`).join("");
  const body = `
  <section class="detail-hero"><div class="container">
    <h1>Frequently Asked Questions</h1>
    <p class="tagline">Everything international patients ask before they come.</p>
  </div></section>
  <section><div class="container" style="max-width:860px">${items}</div></section>
  ${ctaBand()}`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  };
  return page({ title: "FAQ — Dental Tourism in China", description: "Dental tourism in China FAQ: safety, savings, visas, aftercare, treatment quality and pricing — answered for international patients.", body, jsonld, active: "/faq/", path: "/faq/" });
}

/* ---- Pricing / Cost Comparison (USA) ---- */
function buildPricing() {
  // [项目, 美国自费区间, 中国区间, 主要变量]
  const rows = [
    ["Dental cleaning (ultrasonic)", "$100 – $250", "$25 – $80", "Polish & airflow included"],
    ["Scaling & root planing (per quadrant)", "$200 – $400", "$40 – $150", "Pocket depth"],
    ["Tooth-coloured filling", "$150 – $400", "$25 – $110", "Cavity size & material"],
    ["Root canal (front tooth)", "$700 – $1,200", "$90 – $300", "Microscope-assisted or not"],
    ["Root canal (molar)", "$1,000 – $2,000", "$150 – $500", "Number of canals"],
    ["Simple extraction", "$150 – $400", "$25 – $90", "Tooth position & roots"],
    ["Wisdom tooth removal (impacted)", "$400 – $900", "$70 – $280", "Impaction & CBCT needed"],
    ["Porcelain-fused-metal crown", "$900 – $1,800", "$150 – $500", "Metal base material"],
    ["All-ceramic crown", "$1,200 – $2,500", "$300 – $900", "Ceramic block & lab quality"],
    ["Porcelain veneer", "$1,000 – $2,500", "$350 – $1,000", "Veneer type & design"],
    ["Single implant (incl. abutment & crown)", "$3,000 – $6,000", "$1,100 – $2,800", "Implant brand, bone graft"],
    ["Bone graft (single site)", "$600 – $1,500", "$250 – $800", "Bone material & membrane"],
    ["Sinus lift", "$1,500 – $2,500", "$400 – $1,200", "Internal or external"],
    ["All-on-4 fixed bridge (full arch)", "$20,000 – $30,000", "$8,000 – $17,000", "Implant brand & bridge"],
    ["Implant-supported denture (full arch)", "$8,000 – $18,000", "$3,000 – $8,000", "Number of implants"],
    ["Full denture (traditional, full arch)", "$1,500 – $4,000", "$400 – $1,500", "Base & tooth material"],
    ["Clear aligners (full treatment)", "$4,000 – $8,000", "$1,400 – $6,000", "Brand & treatment length"],
    ["Metal braces (full treatment)", "$3,000 – $6,000", "$1,000 – $2,800", "Visit frequency"],
    ["Teeth whitening (in-office)", "$400 – $1,000", "$150 – $450", "Equipment & sessions"],
    ["CBCT scan", "$150 – $400", "$25 – $90", "Scan range"],
  ];
  const trs = rows.map(([name, us, cn, note]) => `
    <tr><td>${esc(name)}</td><td class="price">${us}</td><td class="price cn">${cn}</td><td style="color:var(--muted);font-size:13px">${esc(note)}</td></tr>`).join("");

  // 三个预算情形
  const scenarios = [
    { title: "Two dental implants", us: "$7,000 – $12,000", cn: "$2,400 – $5,600", flights: "$2,000 – $3,600", stay: "$1,200 – $3,000", note: "Real savings exist — ask us for an itemised quote." },
    { title: "All-on-4 on one arch", us: "$20,000 – $30,000", cn: "$8,000 – $17,000", flights: "$2,000 – $3,600", stay: "$2,100 – $5,300", note: "The biggest gap of all — the trip often pays for itself." },
    { title: "Four all-ceramic crowns", us: "$4,800 – $10,000", cn: "$1,200 – $3,600", flights: "$1,000 – $1,800", stay: "$850 – $2,100", note: "For smaller plans, count travel before deciding." },
  ];
  const scenCards = scenarios.map((s) => `
    <div class="card" style="padding:22px">
      <h3>${esc(s.title)}</h3>
      <p style="margin:10px 0 4px"><strong>In the US:</strong> <span style="color:var(--blue-dark)">${esc(s.us)}</span></p>
      <p style="margin:0 0 10px"><strong>In China:</strong> <span style="color:var(--green)">${esc(s.cn)}</span></p>
      <div style="border-top:1px solid var(--line);padding-top:10px;font-size:14px;color:var(--muted)">
        ✈️ Flights: ${esc(s.flights)}<br>🏨 Stay & meals: ${esc(s.stay)}
      </div>
      <p style="font-size:13px;color:var(--muted);margin:10px 0 0">${esc(s.note)}</p>
    </div>`).join("");

  // 容易漏算的七项
  const hidden = [
    "Is the crown included in the implant price? — the most common misunderstanding.",
    "Abutment fees — sometimes priced separately; custom front-tooth abutments cost more.",
    "Bone graft & sinus lift — hard to predict before a CBCT scan; a possible extra.",
    "Pre-op extraction & periodontal treatment — necessary steps before implants, often billed separately.",
    "Temporary denture — the item most often forgotten in full-arch plans.",
    "Check-ups & adjustments — how many are free, and what is charged afterwards.",
    "Imaging fees — CBCT and panoramic X-rays are usually separate line items.",
  ];
  const hiddenHtml = hidden.map((h) => `<li style="padding:8px 0;border-bottom:1px solid var(--line);color:var(--muted);font-size:15px">${esc(h)}</li>`).join("");

  const body = `
  <section class="detail-hero"><div class="container">
    <h1>Dental Costs: USA vs China</h1>
    <p class="tagline">Transparent price ranges, real budget examples, and the seven costs people forget.</p>
  </div></section>

  <section><div class="container">
    <p class="notice" style="margin-bottom:26px">All figures below are public self-pay market reference ranges, shown in USD, to help you understand the scale of savings. They are <strong>not quotes or promises</strong>. Final pricing depends on your oral condition, materials chosen and clinic position — always confirm with a written quote from a licensed dentist after an in-person exam.</p>
    <div class="block-title"><span class="badge">$</span><h2>Main treatment price comparison</h2></div>
    <div class="price-table-wrap">
      <table class="price-table">
        <thead><tr><th>Treatment</th><th>USA (self-pay)</th><th>China</th><th>Main variables</th></tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
    <p class="notice" style="margin-top:14px">Typical savings on treatment alone: <strong>40–70%</strong> on most procedures. Add flights and stay, and the trip still usually pays for itself on plans above ~$5,000.</p>
  </div></section>

  <section class="section-soft">
    <div class="container">
      <div class="section-head"><div class="eyebrow">Full budget</div><h2>Does the trip still save money?</h2><p>Comparing treatment alone is misleading. Here are three realistic full-budget scenarios.</p></div>
      <div class="grid grid-3">${scenCards}</div>
      <p class="notice" style="margin-top:22px"><strong>How to judge if it's worth it:</strong> if you were already planning to visit China, flights are not an incremental cost — as long as the treatment saving beats your stay and service fees, the trip is worthwhile. If you are flying purely for dentistry, plans above ~$5,000 usually make sense. We calculate this for you and will tell you honestly when a trip is not worth it.</p>
    </div>
  </section>

  <section>
    <div class="container" style="max-width:860px">
      <div class="block-title"><span class="badge">!</span><h2>Seven costs people forget</h2></div>
      <ul style="list-style:none;padding:0">${hiddenHtml}</ul>
      <p class="notice" style="margin-top:16px">None of these are anyone trying to trick you — they are mostly differences in how quotes are written. Asking in advance avoids surprises.</p>
    </div>
  </section>
  ${ctaBand()}`;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": rows.slice(0, 6).map(([name, us, cn]) => ({
      "@type": "Question",
      "name": "How much does " + name.toLowerCase() + " cost in China vs the USA?",
      "acceptedAnswer": { "@type": "Answer", "text": "In the USA it typically ranges " + us + " self-pay; in China the typical range is " + cn + ". Final cost depends on your individual assessment and materials." }
    }))
  };
  return page({ title: "Dental Costs in China vs USA — Price Comparison", description: "Compare dental treatment costs in China vs the USA: implants, crowns, root canals, whitening and more — with real budget examples and savings of 40–70%.", body, jsonld, active: "/pricing/", path: "/pricing/" });
}

/* ================= BLOG ================= */

async function readPosts() {
  const dir = path.join(CONTENT, "posts");
  let files = [];
  try { files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md")); }
  catch { return []; }
  const posts = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(dir, f), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const { html, toc } = mdToHtml(body);
    const slug = data.slug || f.replace(/\.md$/, "");
    const words = body.split(/\s+/).filter(Boolean).length;
    posts.push({
      slug,
      title: data.title || slug,
      titleZh: data.titleZh || "",
      date: data.date || "",
      category: data.category || "Treatments",
      excerpt: data.excerpt || "",
      cover: data.cover || "",
      coverAlt: data.coverAlt || "",
      author: data.author || SITE.name,
      faq: Array.isArray(data.faq) ? data.faq.map((f) => ({ q: f.q || "", a: f.a || "" })) : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      html, toc, words,
      readingTime: Math.max(1, Math.round(words / 200)),
      file: f
    });
  }
  posts.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return posts;
}

function postCard(p) {
  const cover = p.cover
    ? `<div class="post-thumb"><img src="${p.cover}" alt="${esc(p.coverAlt || p.title)}" loading="lazy"></div>`
    : `<div class="post-thumb"><img src="/assets/img/og-cover.svg" alt="${esc(p.title)}" loading="lazy"></div>`;
  return `<a class="post-card" href="/blog/${p.slug}/" style="text-decoration:none;color:inherit">
    ${cover}
    <div class="post-card-body">
      <span class="post-cat">${esc(p.category)}</span>
      <h3>${esc(p.title)}</h3>
      <p class="post-excerpt">${esc(p.excerpt)}</p>
      <div class="post-meta"><span>${formatDate(p.date)}</span><span class="dot">·</span><span>${p.readingTime} min read</span></div>
    </div>
  </a>`;
}

function buildBlog(posts) {
  const cards = posts.map(postCard).join("");
  const body = `
  <section class="detail-hero"><div class="container">
    <div class="breadcrumb" style="color:#cfe6ff"><a href="/" style="color:#cfe6ff">Home</a> / Blog</div>
    <h1>Dental Travel Blog</h1>
    <p class="tagline">Practical guides, treatment explainers and real patient stories for dental tourists to China.</p>
  </div></section>
  <section><div class="container">
    ${posts.length
      ? `<div class="blog-grid">${cards}</div>`
      : `<p class="lead-lg">No posts yet — check back soon.</p>`}
  </div></section>
  ${ctaBand()}`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": SITE.name + " Blog",
    "url": SITE.domain + "/blog/",
    "blogPost": posts.map((p) => ({
      "@type": "BlogPosting", "headline": p.title, "url": SITE.domain + "/blog/" + p.slug + "/"
    }))
  };
  return page({
    title: "Dental Travel Blog — Guides & Patient Stories",
    description: "Guides and stories for dental tourists to China: implant costs, treatment explainers, travel tips and patient experiences.",
    body, jsonld, active: "/blog/", path: "/blog/",
    extraHead: `<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)} Blog" href="/feed.xml">`
  });
}

function buildPost(p, allPosts) {
  const tocHtml = p.toc.length
    ? `<nav class="post-toc" aria-label="Table of contents"><div class="toc-title">On this page</div><ul>${p.toc.map((t) => `<li class="toc-${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ul></nav>`
    : "";
  /* 相关文章：优先同分类；分类下只有本篇时（如 Travel Tips 首发），回退到最新其他文章，
     保证每篇文章底部都有内链（SEO 内链 + 读者继续阅读路径）。 */
  const sameCat = allPosts.filter((x) => x.slug !== p.slug && x.category === p.category);
  const others = allPosts.filter((x) => x.slug !== p.slug && x.category !== p.category);
  const related = (sameCat.length ? sameCat : others).slice(0, 3);
  const relatedHtml = related.length
    ? `<section class="section-soft"><div class="container" style="max-width:900px">
    <div class="section-head" style="text-align:left;margin-bottom:22px"><div class="eyebrow">Related</div><h2>${sameCat.length ? "More in " + esc(p.category) : "More from the blog"}</h2></div>
    <div class="blog-grid related">${related.map(postCard).join("")}</div>
  </div></section>`
    : "";
  const coverHtml = p.cover
    ? `<div class="post-cover media protect"><img src="${p.cover}" alt="${esc(p.coverAlt || p.title)}" loading="lazy"></div>`
    : "";
  const faqHtml = (Array.isArray(p.faq) && p.faq.length)
    ? `<section class="section-soft"><div class="container" style="max-width:900px">
    <div class="section-head" style="text-align:left;margin-bottom:22px"><div class="eyebrow">FAQ</div><h2>Frequently asked</h2></div>
    <div class="post-faq">${p.faq.map((f) => `
      <div class="faq-item"><button>${esc(f.q)}<span class="plus">+</span></button><div class="answer">${esc(f.a)}</div></div>`).join("")}</div>
  </div></section>`
    : "";
  const body = `
  <article class="post-page">
    <div class="container post-head">
      <div class="breadcrumb"><a href="/">Home</a> / <a href="/blog/">Blog</a> / ${esc(p.category)}</div>
      <span class="post-cat big">${esc(p.category)}</span>
      <h1>${esc(p.title)}</h1>
      ${p.excerpt ? `<p class="lead-lg post-lead">${esc(p.excerpt)}</p>` : ""}
      <div class="post-meta-row">
        <span>By ${esc(p.author)}</span><span class="dot">·</span><span>${formatDate(p.date)}</span><span class="dot">·</span><span>${p.readingTime} min read</span>
      </div>
    </div>
    ${coverHtml}
    <div class="container post-layout">
      <div class="post-body">${p.html}</div>
      ${tocHtml}
    </div>
  </article>
  ${faqHtml}
  ${relatedHtml}
  ${ctaBand()}`;
  // GEO / SEO 结构化数据：BlogPosting + 面包屑，若有 faq 再加 FAQPage
  const graph = [{
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": p.title,
    "description": p.excerpt,
    "author": { "@type": "Organization", "name": p.author },
    "datePublished": p.date,
    "dateModified": p.date,
    "publisher": { "@type": "Organization", "name": SITE.name, "logo": { "@type": "ImageObject", "url": SITE.domain + "/assets/img/og-cover.svg" } },
    "mainEntityOfPage": SITE.domain + "/blog/" + p.slug + "/",
    "image": p.cover ? SITE.domain + p.cover : SITE.domain + "/assets/img/og-cover.svg"
  }, {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.domain + "/" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": SITE.domain + "/blog/" },
      { "@type": "ListItem", "position": 3, "name": p.title, "item": SITE.domain + "/blog/" + p.slug + "/" }
    ]
  }];
  if (Array.isArray(p.faq) && p.faq.length) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": p.faq.map((f) => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    });
  }
  return page({
    title: p.title, description: p.excerpt, body, jsonld: graph, active: "/blog/", path: "/blog/" + p.slug + "/", ogImage: p.cover,
    extraHead: `<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)} Blog" href="/feed.xml">`
  });
}

function buildRss(posts) {
  const items = posts.slice(0, 20).map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE.domain}/blog/${p.slug}/</link>
      <guid isPermaLink="true">${SITE.domain}/blog/${p.slug}/</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <category>${esc(p.category)}</category>
      <description>${esc(p.excerpt)}</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2004/Atom">
  <channel>
    <title>${esc(SITE.name)} Blog</title>
    <link>${SITE.domain}/blog/</link>
    <description>${esc(SITE.description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE.domain}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

/* ================= BUILD ================= */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

/* ---------- favicon：位图（Google 与社交平台不识别 SVG）+ 矢量 ---------- */
async function buildIcons() {
  const png = (size) => encodePNG(size, size, drawIcon(size));
  await writeFile(path.join(DIST, "favicon.svg"), iconSVG());
  await writeFile(path.join(DIST, "favicon.ico"),
    encodeICO([{ size: 32, data: png(32) }, { size: 48, data: png(48) }]));
  await writeFile(path.join(DIST, "favicon-96x96.png"), png(96));
  await writeFile(path.join(DIST, "apple-touch-icon.png"), png(180));
}

async function build() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(IMG, { recursive: true });

  // favicon（必须落在 dist 根：浏览器默认请求 /favicon.ico）
  await buildIcons();

  // assets (src/css + src/js -> dist/assets)
  await copyDir(SRC, path.join(DIST, "assets"));

  // og cover placeholder
  await ph("og-cover", "China Dental Travel", "World-class dental care, unforgettable China", { w: 1200, h: 630, c1: "#004a99", c2: "#2e9e5b" });

  // pre-generate all placeholder art (sync media() references these paths)
  for (const s of services) {
    await ph("svc-" + s.slug, s.name, s.tagline, { w: 800, h: 500, c1: "#0066cc", c2: "#2e9e5b" });
  }
  for (const c of cities) {
    await ph("city-" + c.slug + "-hero", c.name, c.tagline, { w: 1400, h: 700, c1: "#004a99", c2: "#2e9e5b" });
    (c.tourism.highlights || []).forEach((h, i) =>
      ph("city-" + c.slug + "-hl-" + i, h.name, "", { w: 400, h: 400, c1: "#004a99", c2: "#2e9e5b" }));
  }

  // pages
  await writeFile(path.join(DIST, "index.html"), buildHome());
  await writeFile(path.join(DIST, "services", "index.html"), buildServicesIndex());
  for (const s of services) await writeFile(path.join(DIST, "services", s.slug, "index.html"), buildService(s));
  await writeFile(path.join(DIST, "destinations", "index.html"), buildDestinationsIndex());
  for (const c of cities) await writeFile(path.join(DIST, "destinations", c.slug, "index.html"), await buildCity(c));
  await writeFile(path.join(DIST, "network", "index.html"), buildNetwork());
  await writeFile(path.join(DIST, "about", "index.html"), buildAbout());
  await writeFile(path.join(DIST, "contact", "index.html"), buildContact());
  await writeFile(path.join(DIST, "faq", "index.html"), buildFaq());
  await writeFile(path.join(DIST, "pricing", "index.html"), buildPricing());

  // blog (markdown posts via Decap CMS)
  const posts = await readPosts();
  await writeFile(path.join(DIST, "blog", "index.html"), buildBlog(posts));
  for (const p of posts) {
    await writeFile(path.join(DIST, "blog", p.slug, "index.html"), buildPost(p, posts));
  }
  await writeFile(path.join(DIST, "feed.xml"), buildRss(posts));

  // 404 —— 必须 noindex：CloudFlare Pages 会把 /404.html 以 /404 路径以 200 状态返回，
  // 不加 noindex 时 Google 可能把它当普通页面收录（软 404）。
  await writeFile(path.join(DIST, "404.html"), page({
    title: "Page not found", description: "The page you requested could not be found.",
    body: `<section style="padding:120px 0;text-align:center"><div class="container"><h1>404</h1><p class="lead-lg">We couldn't find that page.</p><a class="btn btn-primary" href="/">Back to home</a></div></section>`,
    active: "/", path: "/404.html",
    extraHead: `<meta name="robots" content="noindex, follow">`
  }));

  // sitemap
  const urls = ["/", "/services/", "/network/", "/destinations/", "/pricing/", "/blog/", "/about/", "/contact/", "/faq/",
    ...services.map((s) => "/services/" + s.slug + "/"),
    ...cities.map((c) => "/destinations/" + c.slug + "/"),
    ...posts.map((p) => "/blog/" + p.slug + "/")];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(SITE.domain)}${u}</loc><changefreq>weekly</changefreq><priority>${u === "/" ? "1.0" : "0.8"}</priority></url>`).join("\n")}
</urlset>`;
  await writeFile(path.join(DIST, "sitemap.xml"), sitemap);

  // robots
  await writeFile(path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE.domain}/sitemap.xml\n`);

  // copy admin (Decap CMS)
  await copyDir(path.join(ROOT, "admin"), path.join(DIST, "admin"));

  console.log("✅ Build complete → " + DIST);
  console.log("   Pages: home, services(" + services.length + "), network(" + CLINICS.length + " clinics/" + NETWORK_REGIONS.filter((r) => (r.clinics || []).some((c) => c.status === "operating")).length + " regions), destinations(" + cities.length + "), blog(" + posts.length + "), about, contact, faq, 404");
  console.log("   Sitemap + robots.txt + feed.xml written.");
}

build().catch((e) => { console.error(e); process.exit(1); });
