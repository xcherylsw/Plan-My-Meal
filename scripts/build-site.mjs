// Turns site/ (content pages with {{placeholders}}) into public/ (what gets
// published), using the values in site.config.json. Runs automatically before
// `npm run build` and `npm run dev`. No dependencies.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));

const email = (cfg.contactEmail || "").trim();
if (!email) console.warn("[site] contactEmail is empty in site.config.json — the Contact and Privacy pages will say so until you add one.");

const pub = (cfg.adsensePublisherId || "").trim();
const appSlot = (cfg.adsenseAppSlot || "").trim();
const contentSlot = (cfg.adsenseContentSlot || "").trim();
const pubOk = /^ca-pub-\d{10,20}$/.test(pub);
if (pub && !pubOk) console.warn('[site] adsensePublisherId should look like "ca-pub-1234567890123456". Ads stay off until it does.');
const adsOn = pubOk;

const vars = {
  CONTACT_EMAIL: email || "(contact email not set yet)",
  UPDATED: cfg.privacyUpdated || "",
};

function walk(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const src = join(root, "site"), out = join(root, "public");
for (const f of walk(src)) {
  const rel = f.slice(src.length + 1);
  const dest = join(out, rel);
  mkdirSync(dirname(dest), { recursive: true });
  let text = readFileSync(f, "utf8");
  if (/\.(html|js|css)$/.test(f)) text = text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  writeFileSync(dest, text);
}

// What the pages and the app read to decide whether to show ads.
writeFileSync(join(out, "ads-config.js"),
  `window.PMM_ADS = ${JSON.stringify(adsOn ? { publisherId: pub, appSlot, contentSlot } : { publisherId: "", appSlot: "", contentSlot: "" })};\n`);

// AdSense checks this file to confirm the site is yours.
writeFileSync(join(out, "ads.txt"), adsOn
  ? `google.com, ${pub.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`
  : "# No ads yet. Fill in adsensePublisherId in site.config.json to switch this on.\n");

writeFileSync(join(out, "robots.txt"), "User-agent: *\nAllow: /\n");
console.log(`[site] pages written to public/ — ads ${adsOn ? "ON" : "off"}`);
