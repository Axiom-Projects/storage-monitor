#!/usr/bin/env node
// Writes the weekly real-Chrome prices (chrome-runbook.md → JSON) into data.js, mirroring what scrape.js
// buildDataFile() writes for Islington: currentPrices, today's priceHistory point, priceChanges, scrapeStatus,
// currentDeals + dealsHistory. Only the providers in the JSON with status "ok" are touched.
//
//   node apply-chrome-prices.js <result.json> [--dry-run]
// Prints one summary line per provider; exit 1 if nothing could be applied.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data.js");
const SIZES = ["25", "50", "75", "100", "150"];
const MIN = 10, MAX = 600;          // £/wk sanity range
const JUMP = 0.6;                   // >60% move vs last price = suspicious, keep the old price for that size

function main() {
    const [jsonPath, flag] = process.argv.slice(2);
    const dry = flag === "--dry-run";
    const result = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const src = fs.readFileSync(FILE, "utf8");
    const SITES = new Function(src + ";return SITES")();
    const isl = SITES.islington;
    const lines = [];
    let applied = 0;

    for (const key of ["bigyellow", "safestore", "access"]) {
        const r = result[key];
        if (!r) { lines.push(`${key}: not in result`); continue; }
        if (r.status !== "ok") { lines.push(`${key}: ${r.status}${r.note ? " - " + r.note : ""}`); continue; }
        const prices = {}, skipped = [];
        for (const s of SIZES) {
            const p = Number(r.sizes?.[s]?.ongoing);
            const old = isl.currentPrices[key]?.[s];
            if (!(p >= MIN && p <= MAX)) { skipped.push(`${s}:missing`); continue; }
            if (old && Math.abs(p - old) / old > JUMP) { skipped.push(`${s}:£${old}->£${p}?`); continue; }
            prices[s] = Math.round(p * 100) / 100;
        }
        const n = Object.keys(prices).length;
        if (!n) { lines.push(`${key}: no usable prices (${skipped.join(", ")})`); continue; }
        for (const [s, p] of Object.entries(prices)) {
            const old = isl.currentPrices[key]?.[s];
            if (old && old !== p) isl.priceChanges.push({ date: today, provider: key, size: +s, oldPrice: old, newPrice: p });
        }
        isl.currentPrices[key] = { ...(isl.currentPrices[key] || {}), ...prices };
        isl.scrapeStatus[key] = { status: n === 5 ? "ok" : "partial", lastSuccess: today, pricesFound: n,
            message: `Weekly real-Chrome check (${n}/5 sizes)` + (skipped.length ? `; kept old: ${skipped.join(", ")}` : "") };
        const deal = (r.sizes?.["50"]?.deal || r.sizes?.["25"]?.deal || "").trim();
        if (deal) {
            const m = deal.match(/(\d+)\s*%/), w = deal.match(/(\d+)\s*weeks?/i);
            const prev = isl.dealsHistory.find(d => d.provider === key && d.text === deal && d.active);
            if (prev) prev.lastSeen = today; else isl.dealsHistory.push({ provider: key, text: deal, firstSeen: today, lastSeen: today, active: true });
            isl.currentDeals[key] = { active: true, text: deal, discountPct: m ? +m[1] : 0, maxWeeks: w ? +w[1] : 0,
                firstSeen: prev ? prev.firstSeen : today, lastSeen: today };
        }
        applied++;
        lines.push(`${key}: ${n}/5 ` + SIZES.filter(s => prices[s]).map(s => `${s}=£${prices[s]}`).join(" ")
            + (skipped.length ? ` (kept old ${skipped.join(", ")})` : ""));
    }

    if (applied) {
        let h = isl.priceHistory.find(x => x.date === today);
        if (!h) { h = { date: today, prices: {} }; isl.priceHistory.push(h); }
        h.prices = JSON.parse(JSON.stringify(isl.currentPrices));
        const start = src.indexOf("const SITES = "), end = src.indexOf("\n\nconst DEFAULT_SITE");
        if (start < 0 || end < 0) throw new Error("SITES block not found in data.js");
        if (!dry) fs.writeFileSync(FILE, src.slice(0, start) + "const SITES = " + JSON.stringify(SITES, null, 4) + ";" + src.slice(end));
    }
    console.log((dry ? "[dry-run] " : "") + lines.join("\n"));
    process.exit(applied ? 0 : 1);
}

main();
