/* =========================================================
   China Dental Travel — Static Site Generator
   Zero external dependencies. Run: node build.mjs
   Output: ./dist  (deploy to CloudFlare Pages, build=node build.mjs)
   ========================================================= */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/* ---------- data ---------- */
const siteData = await readJSON(path.join(CONTENT, "site.json"));
const SITE = siteData;
const NAV = siteData.nav;
const services = await readDirJSON(path.join(CONTENT, "services"));
services.sort((a, b) => (a.priority > b.priority ? 1 : -1));
const cities = await readDirJSON(path.join(CONTENT, "cities"));
const featured = cities.filter((c) => c.featured);
const faqs = (await readJSON(path.join(CONTENT, "faq.json"))).items;
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
      <div class="translate-wrap"><div id="google_translate_element"></div></div>
      <a class="btn btn-whatsapp" href="${WA_LINK}">WhatsApp</a>
      <button class="nav-toggle" aria-label="Menu" id="navToggle">&#9776;</button>
    </div>
  </div>
</header>`;
}

function footer() {
  const explore = NAV.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join("");
  const svcLinks = services.map((s) => `<a href="/services/${s.slug}/">${esc(s.name)}</a>`).join("");
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="brand" style="color:#fff"><span class="logo-mark">✚</span><span>China Dental Travel</span></div>
        <p style="color:#cdd7e2;margin-top:12px;font-size:14px">${esc(SITE.description)}</p>
      </div>
      <div><h4>Explore</h4>${explore}</div>
      <div><h4>Services</h4>${svcLinks}</div>
      <div><h4>Contact</h4>
        <a href="${WA_LINK}">WhatsApp: ${esc(SITE.contact.whatsappDisplay)}</a>
        <a href="mailto:${esc(SITE.contact.email)}">${esc(SITE.contact.email)}</a>
        <a href="${esc(SITE.contact.facebook)}">Facebook Messenger</a>
        <a href="tel:${esc(SITE.contact.phone)}">${esc(SITE.contact.phone)}</a>
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

function page({ title, description, body, jsonld, active, ogImage }) {
  const fullTitle = title.includes(SITE.name) ? title : title + (SITE.seo.titleSuffix || "");
  const og = ogImage || SITE.seo.ogImage;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="${esc(SITE.seo.keywords)}">
  <link rel="canonical" href="${esc(SITE.domain)}${active}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(SITE.domain)}${og}">
  <meta property="og:url" content="${esc(SITE.domain)}${active}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(SITE.domain)}${og}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/style.css">
  ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
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

/* ---- Home ---- */
function buildHome() {
  const why = siteData.whyChina.map((w) => `
    <div class="card">
      <div class="ic">${w.icon}</div>
      <h3>${esc(w.title)}</h3>
      <p>${esc(w.text)}</p>
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
      <div class="media protect" style="height:180px"><img src="/assets/img/city-${c.slug}-hero.svg" alt="${esc(c.name)}" loading="lazy"></div>
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
        <div><strong>6</strong>Curated destinations</div>
        <div><strong>3</strong>Core treatments</div>
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
    }
  };
  return page({ title: SITE.name, description: "Affordable dental tourism in China: implants, whitening and general care from licensed English-speaking dentists, paired with travel to Beijing and Guizhou.", body, jsonld, active: "/" });
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
  return page({ title: "Dental Services in China", description: "Dental implants, teeth whitening and general dental care in China at transparent prices — treatment plans and costs for international patients.", body, active: "/services/" });
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
  return page({ title: s.name + " in China", description: s.summary, body, jsonld, active: "/services/" });
}

/* ---- Destinations index ---- */
function buildDestinationsIndex() {
  const cards = cities.map((c) => `
    <a class="card city-card" href="/destinations/${c.slug}/" style="text-decoration:none;color:inherit">
      <div class="media protect" style="height:180px"><img src="/assets/img/city-${c.slug}-hero.svg" alt="${esc(c.name)}" loading="lazy"></div>
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
  return page({ title: "Dental Tourism Destinations in China", description: "Explore dental tourism destinations in China — Beijing and Guizhou (Xingyi, Kaili, Zunyi, Bijie, Liupanshui) with clinics, prices and travel guides.", body, jsonld, active: "/destinations/" });
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

  const inst = c.institutions.map((inst, ii) => {
    const docs = (inst.doctors || []).map((doc, j) => `
      <div class="doctor">
        ${media(doc.image, doc.name, "", { key: "doc-" + c.slug + "-" + ii + "-" + j })}
        <div>
          <h5>${esc(doc.name)}</h5>
          <div class="role">${esc(doc.nameZh || "")}</div>
        </div>
      </div>`).join("");
    const instMedia = media(inst.image, inst.name, "", { key: "inst-" + c.slug + "-" + ii });
    return `
    <div class="institution">
      <div class="head"><h4>${esc(inst.name)} <span style="font-weight:400;font-size:.9rem;color:var(--muted)">${esc(inst.nameZh || "")}</span></h4></div>
      <div class="body">
        <div>
          ${instMedia}
        </div>
        <div>
          <h5 style="margin:0 0 10px">Medical team</h5>
          ${docs || '<p style="color:var(--muted);font-size:14px">Details coming soon.</p>'}
        </div>
      </div>
    </div>`;
  }).join("");

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
      <div class="block-title green"><span class="badge">2</span><h2>Medical Resources</h2></div>
      <p class="lead-lg">${esc(c.medical.advantages)}</p>
      <h3 style="margin-top:24px">Partner clinics</h3>
      ${inst}
    </div>
  </section>

  <section class="block">
    <div class="container" style="max-width:860px">
      <div class="block-title"><span class="badge">$</span><h2>Indicative price ranges</h2></div>
      <table class="price-table">
        <thead><tr><th>Treatment</th><th>Price range</th><th>Unit</th></tr></thead>
        <tbody>${priceRows}</tbody>
      </table>
      <p class="notice" style="margin-top:14px">Prices are indicative only and vary by individual assessment and clinic. Final quotes are confirmed by a licensed dentist.</p>
      <div style="margin-top:24px">${ctaBand().replace(/<section class="section-soft">/, '<div>').replace(/<\/section>/, '</div>')}</div>
    </div>
  </section>`;

  const localBiz = c.institutions.map((inst) => ({
    "@type": "MedicalOrganization",
    "name": inst.name
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
  return page({ title: c.name + " Dental Tourism", description: c.tagline + " — licensed dental clinics and transparent treatment prices in " + c.name + ", China. Plan your dental trip with our local team.", body, jsonld, active: "/destinations/" });
}

/* ---- About ---- */
function buildAbout() {
  const body = `
  <section class="detail-hero"><div class="container">
    <h1>About China Dental Travel</h1>
    <p class="tagline">An information & referral platform for international dental patients.</p>
  </div></section>
  <section><div class="container grid grid-2" style="align-items:start">
    <div>
      <h2>${esc(SITE.organization.founderClinic)} as our founding clinic</h2>
      <p>China Dental Travel was built to connect overseas patients with licensed, high-quality dental care in China — and to turn necessary treatment into an extraordinary trip. Our founding and preferred clinic, ${esc(SITE.organization.founderClinic)}, brings 16 years of clinical heritage across more than 20 locations.</p>
      <p>Because no single clinic can serve every traveller, we also curate and verify partner institutions in other provinces. Every clinic on the platform holds a valid Chinese Medical Institution License and employs licensed dentists — we verify before we list.</p>
    </div>
    <div class="card" style="text-align:center">
      <div class="stat-row" style="justify-content:space-around">
        <div class="stat"><strong>16+</strong><span>Years heritage</span></div>
        <div class="stat"><strong>20+</strong><span>Clinic locations</span></div>
        <div class="stat"><strong>6</strong><span>Destinations</span></div>
      </div>
      <p style="color:var(--muted);margin-top:18px;font-size:14px">Numbers reflect the founding group's footprint; partner network is expanding.</p>
    </div>
  </div></section>

  <section class="section-soft"><div class="container">
    <div class="section-head"><div class="eyebrow">Our promise</div><h2>What you can count on</h2></div>
    <div class="grid grid-3">
      <div class="card"><h3>Verified clinics</h3><p style="color:var(--muted)">Licensed medical institutions only. No exceptions.</p></div>
      <div class="card"><h3>Transparent prices</h3><p style="color:var(--muted)">Indicative ranges up front; confirmed quotes before treatment.</p></div>
      <div class="card"><h3>English support</h3><p style="color:var(--muted)">Bilingual coordination from first message to aftercare.</p></div>
    </div>
  </div></section>
  ${ctaBand()}`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE.name,
    "url": SITE.domain,
    "description": SITE.description,
    "founder": { "@type": "Organization", "name": SITE.organization.founderClinic }
  };
  return page({ title: "About Us — Dental Tourism in China", description: "China Dental Travel connects international patients with licensed dental clinics in China — affordable treatment, verified clinics, and travel coordination.", body, jsonld, active: "/about/" });
}

/* ---- Contact ---- */
function buildContact() {
  const qr = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(WA_LINK);
  const body = `
  <section class="detail-hero"><div class="container">
    <h1>Contact Us</h1>
    <p class="tagline">We usually reply within 24 hours.</p>
  </div></section>
  <section><div class="container">
    <div class="contact-grid">
      <div class="contact-card">
        <div class="ic">💬</div>
        <h3>WhatsApp</h3>
        <p style="color:var(--muted);font-size:14px">Fastest way to reach us. Scan or tap.</p>
        <img class="qr protect" src="${qr}" alt="WhatsApp QR code" loading="lazy">
        <a class="btn btn-whatsapp" href="${WA_LINK}">${esc(SITE.contact.whatsappDisplay)}</a>
      </div>
      <div class="contact-card">
        <div class="ic">✉️</div>
        <h3>Email</h3>
        <p style="color:var(--muted);font-size:14px">Send your X-rays and questions anytime.</p>
        <div style="height:160px;display:grid;place-items:center;color:var(--blue);font-weight:700">@</div>
        <a class="big" href="mailto:${esc(SITE.contact.email)}">${esc(SITE.contact.email)}</a>
      </div>
      <div class="contact-card">
        <div class="ic">👍</div>
        <h3>Facebook</h3>
        <p style="color:var(--muted);font-size:14px">Message us on Messenger.</p>
        <div style="height:160px;display:grid;place-items:center;color:var(--blue);font-weight:700">f</div>
        <a class="big" href="${esc(SITE.contact.facebook)}">Message us</a>
      </div>
      <div class="contact-card">
        <div class="ic">📞</div>
        <h3>Phone</h3>
        <p style="color:var(--muted);font-size:14px">For urgent enquiries.</p>
        <div style="height:160px;display:grid;place-items:center;color:var(--blue);font-weight:700">☎</div>
        <a class="big" href="tel:${esc(SITE.contact.phone)}">${esc(SITE.contact.phone)}</a>
      </div>
    </div>
    <p class="notice" style="margin-top:26px">When you contact us, please include your country, the treatment you need, and any recent X-rays if available. This helps us match you with the right licensed clinic and prepare an accurate plan.</p>
    <p class="disclaimer" style="margin-top:14px">${esc(SITE.disclaimer)}</p>
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
  return page({ title: "Contact Us — Dental Treatment in China", description: "Contact China Dental Travel on WhatsApp or email — free treatment plans and price quotes for dental care in China within 24 hours.", body, jsonld, active: "/contact/" });
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
  return page({ title: "FAQ — Dental Tourism in China", description: "Dental tourism in China FAQ: safety, savings, visas, aftercare, treatment quality and pricing — answered for international patients.", body, jsonld, active: "/faq/" });
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

async function build() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(IMG, { recursive: true });

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
    (c.institutions || []).forEach((inst, ii) => {
      ph("inst-" + c.slug + "-" + ii, inst.nameZh || inst.name, "", { w: 600, h: 360, c1: "#0066cc", c2: "#1f7a44" });
      (inst.doctors || []).forEach((doc, j) =>
        ph("doc-" + c.slug + "-" + ii + "-" + j, doc.name, "", { w: 200, h: 200, c1: "#2e9e5b", c2: "#0066cc" }));
    });
  }

  // pages
  await writeFile(path.join(DIST, "index.html"), buildHome());
  await writeFile(path.join(DIST, "services", "index.html"), buildServicesIndex());
  for (const s of services) await writeFile(path.join(DIST, "services", s.slug, "index.html"), buildService(s));
  await writeFile(path.join(DIST, "destinations", "index.html"), buildDestinationsIndex());
  for (const c of cities) await writeFile(path.join(DIST, "destinations", c.slug, "index.html"), await buildCity(c));
  await writeFile(path.join(DIST, "about", "index.html"), buildAbout());
  await writeFile(path.join(DIST, "contact", "index.html"), buildContact());
  await writeFile(path.join(DIST, "faq", "index.html"), buildFaq());

  // 404
  await writeFile(path.join(DIST, "404.html"), page({
    title: "Page not found", description: "The page you requested could not be found.",
    body: `<section style="padding:120px 0;text-align:center"><div class="container"><h1>404</h1><p class="lead-lg">We couldn't find that page.</p><a class="btn btn-primary" href="/">Back to home</a></div></section>`,
    active: "/"
  }));

  // sitemap
  const urls = ["/", "/services/", "/destinations/", "/about/", "/contact/", "/faq/",
    ...services.map((s) => "/services/" + s.slug + "/"),
    ...cities.map((c) => "/destinations/" + c.slug + "/")];
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
  console.log("   Pages: home, services(" + services.length + "), destinations(" + cities.length + "), about, contact, faq, 404");
  console.log("   Sitemap + robots.txt written.");
}

build().catch((e) => { console.error(e); process.exit(1); });
