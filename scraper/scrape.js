#!/usr/bin/env node
// ============================================================
// STORAGE MONITOR - PRICE SCRAPER v2
// Strategy: Intercept ALL network traffic + navigate quote flows
// Uses Playwright with full browser emulation
// ============================================================

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.js");
const TARGET_SIZES = [25, 50, 75, 100, 150];

// Helper: extract deals from page text
function extractDeals(text) {
    const deals = [];
    const patterns = [
        /(\d+%\s*off[^.!\n]{0,80})/gi,
        /(first\s+\w+\s+(?:week|month)[^.!\n]{0,60}(?:free|off|half|discount)[^.!\n]{0,40})/gi,
        /(\d+\s+weeks?\s+(?:free|half\s+price)[^.!\n]{0,60})/gi,
        /(price\s+match\s+guarantee[^.!\n]{0,40})/gi,
        /(lowest\s+price\s+guarantee[^.!\n]{0,40})/gi,
        /(special\s+offer[^.!\n]{0,60})/gi,
        /(free\s+(?:first|1st)\s+(?:\w+\s+)?(?:week|month)[^.!\n]{0,40})/gi
    ];
    patterns.forEach(p => {
        const matches = text.match(p);
        if (matches) deals.push(...matches.map(m => m.trim()));
    });
    return [...new Set(deals)];
}

// Helper: extract price/size pairs from text blob
function extractPricesFromText(text) {
    const prices = {};
    // Pattern: size near a price (within same block of text)
    // Split into chunks and look for size+price combos
    const chunks = text.split(/\n/).filter(l => l.trim());

    for (const chunk of chunks) {
        const sizeMatch = chunk.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
        if (!sizeMatch) continue;
        const size = parseInt(sizeMatch[1]);
        if (!TARGET_SIZES.includes(size)) continue;

        // Weekly price
        let priceMatch = chunk.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w|weekly)/i);
        if (priceMatch) {
            prices[size] = parseFloat(priceMatch[1]);
            continue;
        }
        // Monthly price (convert to weekly)
        priceMatch = chunk.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+month|\/\s*m(?:onth)?|pm|p\.m|pcm|monthly)/i);
        if (priceMatch) {
            prices[size] = +(parseFloat(priceMatch[1]) * 12 / 52).toFixed(2);
            continue;
        }
        // Any GBP amount if it's reasonable for weekly storage
        priceMatch = chunk.match(/£\s*(\d+(?:\.\d{1,2})?)/);
        if (priceMatch) {
            const p = parseFloat(priceMatch[1]);
            if (p > 10 && p < 300) {
                prices[size] = p;
            }
        }
    }
    return prices;
}

// Helper: walk JSON tree for price data
function extractPricesFromJSON(obj, prices = {}) {
    if (!obj || typeof obj !== "object") return prices;
    if (Array.isArray(obj)) { obj.forEach(item => extractPricesFromJSON(item, prices)); return prices; }

    // Common API field names for size
    const sizeFields = ["size", "sqft", "squareFeet", "sq_ft", "area", "unitSize", "unit_size", "roomSize", "room_size", "sSize", "fSize"];
    // Common API field names for price
    const priceFields = ["price", "weeklyPrice", "weekly_price", "pricePerWeek", "rate", "weeklyRate", "weekly_rate", "unitPrice", "unit_price", "fPrice", "dPrice", "standardPrice", "webPrice", "onlinePrice"];

    let foundSize = null;
    let foundPrice = null;

    for (const sf of sizeFields) {
        if (obj[sf] !== undefined) { foundSize = Number(obj[sf]); break; }
    }
    for (const pf of priceFields) {
        if (obj[pf] !== undefined) { foundPrice = Number(obj[pf]); break; }
    }

    if (foundSize && foundPrice && TARGET_SIZES.includes(foundSize) && foundPrice > 5 && foundPrice < 500) {
        prices[foundSize] = foundPrice;
    }

    // Also check for name/description containing size info
    const nameFields = ["name", "description", "title", "label", "unitName", "roomName", "sName"];
    for (const nf of nameFields) {
        if (obj[nf] && typeof obj[nf] === "string") {
            const sizeMatch = obj[nf].match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
            if (sizeMatch) {
                const size = parseInt(sizeMatch[1]);
                if (TARGET_SIZES.includes(size) && foundPrice) {
                    prices[size] = foundPrice;
                }
            }
        }
    }

    Object.values(obj).forEach(val => extractPricesFromJSON(val, prices));
    return prices;
}

// --- SCRAPERS ---
const SCRAPERS = {
    metro: {
        name: "Metro Storage",
        async scrape(context) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            // Try the quote/booking page directly
            await page.goto("https://www.metro-storage.co.uk/self-storage-n1/", { waitUntil: "networkidle", timeout: 30000 });
            await page.waitForTimeout(3000);

            // Try clicking any "Get a quote" or "See prices" buttons
            await tryClick(page, ['text=/get.*quote/i', 'text=/see.*price/i', 'text=/view.*price/i', 'text=/book.*now/i', 'a[href*="quote"]', 'a[href*="price"]', 'a[href*="book"]']);

            const text = await page.evaluate(() => document.body.innerText);
            const prices = extractPricesFromText(text);
            const deals = extractDeals(text);

            // Check API data
            for (const { body } of apiData) {
                try { Object.assign(prices, extractPricesFromJSON(JSON.parse(body))); } catch {}
            }

            await screenshot(page, "metro");
            await page.close();
            return { prices, deals };
        }
    },

    access: {
        name: "Access Self Storage",
        async scrape(context) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            // Go directly to the RapidStor quote tool for Islington (store 26)
            await page.goto("https://www.accessstorage.com/storage?storeid=26", { waitUntil: "networkidle", timeout: 30000 });
            await page.waitForTimeout(5000);

            // The RapidStor widget should load - try to interact with size selection
            // Accept cookies if prompted
            await tryClick(page, ['text=/accept/i', 'text=/agree/i', '#cookie-accept', '[class*="cookie"] button']);
            await page.waitForTimeout(1000);

            // RapidStor typically shows unit types - try clicking through each
            const frames = page.frames();
            for (const frame of frames) {
                const frameText = await frame.evaluate(() => document.body?.innerText || "").catch(() => "");
                if (frameText.includes("sq ft") || frameText.includes("sqft") || frameText.includes("storage")) {
                    console.log("  Found RapidStor frame content");
                    const framePrices = extractPricesFromText(frameText);
                    Object.assign(apiData._pagePrices || {}, framePrices);
                }
            }

            // Also try main page text
            const text = await page.evaluate(() => document.body.innerText);
            const prices = extractPricesFromText(text);

            // Try to get deals from the main site page
            const mainPage = await context.newPage();
            await mainPage.goto("https://www.accessstorage.com/central-london/access-self-storage-islington", { waitUntil: "networkidle", timeout: 20000 });
            const mainText = await mainPage.evaluate(() => document.body.innerText);
            const deals = extractDeals(mainText + "\n" + text);
            await mainPage.close();

            // Check API data
            for (const { body } of apiData) {
                try { Object.assign(prices, extractPricesFromJSON(JSON.parse(body))); } catch {}
            }

            await screenshot(page, "access");
            await page.close();
            return { prices, deals };
        }
    },

    urban: {
        name: "Urban Locker",
        async scrape(context) {
            const prices = {};
            const apiData = [];
            let deals = [];

            // Navigate through the quote tool for each size
            const sizeSlugs = { 25: "25", 50: "50", 75: "75", 100: "100", 150: "150" };

            for (const [size, slug] of Object.entries(sizeSlugs)) {
                const page = await context.newPage();
                interceptAll(page, apiData);

                const url = `https://quote.urbanlocker.co.uk/storage/urban-locker-islington/${slug}`;
                console.log(`    Trying Urban Locker size ${size}: ${url}`);
                try {
                    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
                    await page.waitForTimeout(3000);

                    const text = await page.evaluate(() => document.body.innerText);
                    const found = extractPricesFromText(text);
                    if (found[parseInt(size)]) {
                        prices[parseInt(size)] = found[parseInt(size)];
                    }

                    // Also look for price in any element
                    const pagePrice = await page.evaluate((sz) => {
                        const allText = document.body.innerText;
                        // Look for any pound amount on the page
                        const priceMatches = allText.match(/£\s*(\d+(?:\.\d{1,2})?)/g);
                        if (priceMatches) {
                            // Filter to reasonable weekly storage prices
                            for (const m of priceMatches) {
                                const val = parseFloat(m.replace("£", "").trim());
                                if (val > 10 && val < 300) return val;
                            }
                        }
                        return null;
                    }, size);

                    if (pagePrice && !prices[parseInt(size)]) {
                        prices[parseInt(size)] = pagePrice;
                    }

                    if (parseInt(size) === 50) {
                        await screenshot(page, "urban");
                    }
                } catch (err) {
                    console.log(`    Error on size ${size}: ${err.message}`);
                }
                await page.close();
            }

            // Get deals from main site
            const dealsPage = await context.newPage();
            await dealsPage.goto("https://www.urbanlocker.co.uk/storage/islington/", { waitUntil: "networkidle", timeout: 20000 });
            const dealsText = await dealsPage.evaluate(() => document.body.innerText);
            deals = extractDeals(dealsText);
            await dealsPage.close();

            // Check API data
            for (const { body } of apiData) {
                try { Object.assign(prices, extractPricesFromJSON(JSON.parse(body))); } catch {}
            }

            return { prices, deals };
        }
    },

    safestore: {
        name: "Safestore",
        async scrape(context) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            // Safestore has a quote flow - try the store page first
            await page.goto("https://www.safestore.co.uk/self-storage/london/north/kings-cross/", { waitUntil: "networkidle", timeout: 45000 });
            await page.waitForTimeout(5000);

            // Accept cookies
            await tryClick(page, ['text=/accept/i', '#onetrust-accept-btn-handler', '[class*="cookie"] button', 'text=/agree/i']);
            await page.waitForTimeout(2000);

            // Try to find and click quote/pricing buttons
            await tryClick(page, [
                'text=/get.*quote/i', 'text=/see.*price/i', 'text=/view.*room/i',
                'text=/check.*price/i', 'text=/see.*room/i', 'text=/book.*now/i',
                'a[href*="quote"]', 'a[href*="price"]', 'a[href*="book"]',
                'a[href*="room"]', 'button[class*="quote"]', 'button[class*="price"]'
            ]);
            await page.waitForTimeout(3000);

            // Scroll to load lazy content
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 3);
            });
            await page.waitForTimeout(2000);
            await page.evaluate(() => {
                window.scrollTo(0, (document.body.scrollHeight * 2) / 3);
            });
            await page.waitForTimeout(2000);

            const text = await page.evaluate(() => document.body.innerText);
            const prices = extractPricesFromText(text);
            const deals = extractDeals(text);

            // Check API data
            for (const { body } of apiData) {
                try { Object.assign(prices, extractPricesFromJSON(JSON.parse(body))); } catch {}
                // Also try text extraction on API responses
                try { Object.assign(prices, extractPricesFromText(body)); } catch {}
            }

            // Log all intercepted API URLs for debugging
            console.log(`  Intercepted ${apiData.length} API calls:`);
            apiData.slice(0, 10).forEach(d => console.log(`    ${d.url.substring(0, 120)}`));

            await screenshot(page, "safestore");
            await page.close();
            return { prices, deals };
        }
    },

    bigyellow: {
        name: "Big Yellow",
        async scrape(context) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            // Big Yellow - try the store page
            await page.goto("https://www.bigyellow.co.uk/kings-cross-self-storage-units", { waitUntil: "networkidle", timeout: 45000 });
            await page.waitForTimeout(5000);

            // Accept cookies
            await tryClick(page, ['text=/accept/i', '#onetrust-accept-btn-handler', '[class*="cookie"] button', 'text=/agree/i', 'text=/got it/i']);
            await page.waitForTimeout(2000);

            // Try clicking into room listings
            await tryClick(page, [
                'text=/see.*room/i', 'text=/view.*room/i', 'text=/see.*price/i',
                'text=/get.*quote/i', 'text=/check.*price/i', 'text=/all.*room/i',
                'text=/storage.*room/i', 'text=/choose.*room/i', 'text=/book.*now/i',
                'a[href*="quote"]', 'a[href*="price"]', 'a[href*="room"]',
                'a[href*="book"]', '[class*="cta"]', '[class*="action"]'
            ]);
            await page.waitForTimeout(3000);

            // Scroll to trigger lazy loading
            for (let i = 1; i <= 5; i++) {
                await page.evaluate((step) => {
                    window.scrollTo(0, (document.body.scrollHeight * step) / 5);
                }, i);
                await page.waitForTimeout(1000);
            }

            const text = await page.evaluate(() => document.body.innerText);
            const prices = extractPricesFromText(text);
            const deals = extractDeals(text);

            // Check API data
            for (const { body } of apiData) {
                try { Object.assign(prices, extractPricesFromJSON(JSON.parse(body))); } catch {}
                try { Object.assign(prices, extractPricesFromText(body)); } catch {}
            }

            console.log(`  Intercepted ${apiData.length} API calls:`);
            apiData.slice(0, 10).forEach(d => console.log(`    ${d.url.substring(0, 120)}`));

            await screenshot(page, "bigyellow");
            await page.close();
            return { prices, deals };
        }
    }
};

// --- Utilities ---

// Intercept all network responses and capture potentially useful ones
function interceptAll(page, collector) {
    page.on("response", async (response) => {
        const url = response.url();
        const ct = response.headers()["content-type"] || "";
        // Capture JSON responses and any response with pricing keywords in URL
        if (ct.includes("json") || url.match(/api|price|quote|room|unit|store|rate|avail|book|size/i)) {
            try {
                const body = await response.text();
                if (body.length > 10 && body.length < 500000) {
                    collector.push({ url, body, status: response.status() });
                }
            } catch {}
        }
    });
}

// Try clicking various selectors, return true if any clicked
async function tryClick(page, selectors) {
    for (const sel of selectors) {
        try {
            const el = await page.$(sel);
            if (el) {
                await el.click().catch(() => {});
                return true;
            }
        } catch {}
    }
    return false;
}

// Save screenshot
const screenshotsDir = path.join(__dirname, "..", "screenshots");
async function screenshot(page, name) {
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    try {
        await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: true });
        console.log(`  Screenshot: screenshots/${name}.png`);
    } catch {}
}

// --- Main ---
async function main() {
    console.log("=== Storage Monitor Scraper v2 ===");
    console.log(`Date: ${new Date().toISOString()}`);

    const existingData = readExistingData();

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: "en-GB",
        timezoneId: "Europe/London"
    });

    const results = {};
    const today = new Date().toISOString().split("T")[0];

    for (const [key, config] of Object.entries(SCRAPERS)) {
        console.log(`\n--- Scraping: ${config.name} ---`);
        try {
            const result = await config.scrape(context);
            results[key] = result;
            console.log(`  PRICES: ${JSON.stringify(result.prices)}`);
            console.log(`  DEALS: ${result.deals.length > 0 ? result.deals.join(" | ") : "None"}`);
            if (Object.keys(result.prices).length === 0) {
                console.log(`  WARNING: No prices extracted for ${config.name}`);
            }
        } catch (err) {
            console.error(`  FATAL ERROR scraping ${config.name}: ${err.message}`);
            results[key] = { prices: {}, deals: [], error: err.message };
        }
    }

    await browser.close();

    const updatedData = buildDataFile(existingData, results, today);
    fs.writeFileSync(DATA_FILE, updatedData, "utf-8");
    console.log(`\nData file updated: ${DATA_FILE}`);
    console.log("=== Done ===");
}

function readExistingData() {
    try {
        const content = fs.readFileSync(DATA_FILE, "utf-8");
        const extract = (varName) => {
            const regex = new RegExp(`const ${varName}\\s*=\\s*([\\s\\S]*?);\\s*(?:const |\/\/|$)`, "m");
            const match = content.match(regex);
            if (match) {
                try { return eval(`(${match[1]})`); } catch { return null; }
            }
            return null;
        };
        return {
            currentPrices: extract("CURRENT_PRICES"),
            priceHistory: extract("PRICE_HISTORY"),
            priceChanges: extract("PRICE_CHANGES"),
            currentDeals: extract("CURRENT_DEALS"),
            dealsHistory: extract("DEALS_HISTORY"),
            scrapeStatus: extract("SCRAPE_STATUS")
        };
    } catch {
        return { currentPrices: null, priceHistory: [], priceChanges: [], currentDeals: {}, dealsHistory: [] };
    }
}

function buildDataFile(existing, scraped, today) {
    const newPrices = {};
    const newChanges = [...(existing.priceChanges || [])];
    const newDeals = {};
    const dealsHistory = [...(existing.dealsHistory || [])];

    for (const [key, result] of Object.entries(scraped)) {
        if (result.prices && Object.keys(result.prices).length > 0) {
            newPrices[key] = result.prices;
            if (existing.currentPrices && existing.currentPrices[key]) {
                for (const [size, newPrice] of Object.entries(result.prices)) {
                    const oldPrice = existing.currentPrices[key][size];
                    if (oldPrice && oldPrice !== newPrice) {
                        newChanges.push({ date: today, provider: key, size: parseInt(size), oldPrice, newPrice });
                        console.log(`  PRICE CHANGE: ${key} ${size}sqft ${oldPrice} -> ${newPrice}`);
                    }
                }
            }
        } else if (existing.currentPrices && existing.currentPrices[key]) {
            newPrices[key] = existing.currentPrices[key];
        }

        if (result.deals && result.deals.length > 0) {
            const dealText = result.deals[0];
            const discountMatch = dealText.match(/(\d+)%/);
            const weeksMatch = dealText.match(/(\d+)\s*weeks?/i);
            const monthsMatch = dealText.match(/(\d+)\s*months?/i);
            newDeals[key] = {
                active: true, text: dealText,
                discountPct: discountMatch ? parseInt(discountMatch[1]) : 0,
                maxWeeks: weeksMatch ? parseInt(weeksMatch[1]) : (monthsMatch ? parseInt(monthsMatch[1]) * 4 : 0),
                firstSeen: today, lastSeen: today
            };
            const existingDeal = dealsHistory.find(d => d.provider === key && d.text === dealText && d.active);
            if (existingDeal) {
                existingDeal.lastSeen = today;
                newDeals[key].firstSeen = existingDeal.firstSeen;
            } else {
                dealsHistory.push({ provider: key, text: dealText, firstSeen: today, lastSeen: today, active: true });
            }
        } else {
            newDeals[key] = { active: false, text: "No current deal detected", discountPct: 0, maxWeeks: 0, firstSeen: null, lastSeen: null };
            dealsHistory.forEach(d => { if (d.provider === key && d.active) { d.active = false; d.lastSeen = today; } });
        }
    }

    const scrapeStatus = {};
    for (const [key, result] of Object.entries(scraped)) {
        const pricesFound = result.prices ? Object.keys(result.prices).length : 0;
        let status, message;
        if (result.error) { status = "failed"; message = `Scrape error: ${result.error.substring(0, 80)}`; }
        else if (pricesFound >= 5) { status = "ok"; message = "All sizes scraped successfully"; }
        else if (pricesFound > 0) { status = "partial"; message = `Only ${pricesFound}/5 sizes found`; }
        else { status = "failed"; message = "No prices extracted - site may require manual quote"; }
        scrapeStatus[key] = {
            status,
            lastSuccess: pricesFound > 0 ? today : (existing.scrapeStatus?.[key]?.lastSuccess || null),
            pricesFound, message
        };
    }

    const history = [...(existing.priceHistory || [])];
    if (!history.find(h => h.date === today)) {
        history.push({ date: today, prices: { ...newPrices } });
    }
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const filteredHistory = history.filter(h => new Date(h.date) >= yearAgo);

    const existingContent = fs.readFileSync(DATA_FILE, "utf-8");
    const providersMatch = existingContent.match(/const PROVIDERS = \{[\s\S]*?\n\};/);
    const providersBlock = providersMatch ? providersMatch[0] : "";

    return `// ============================================================
// STORAGE MONITOR - DATA FILE
// This file is auto-updated by the scraper (GitHub Action)
// Manual edits will be overwritten on next scrape run
// ============================================================

${providersBlock}

// Current prices per week in GBP, keyed by provider then size (sqft)
// Last updated: ${today}
const CURRENT_PRICES = ${JSON.stringify(newPrices, null, 4)};

// Active deals & offers
const CURRENT_DEALS = ${JSON.stringify(newDeals, null, 4)};

// Historical price data
const PRICE_HISTORY = ${JSON.stringify(filteredHistory, null, 4)};

// Price change log
const PRICE_CHANGES = ${JSON.stringify(newChanges, null, 4)};

// Deals history
const DEALS_HISTORY = ${JSON.stringify(dealsHistory, null, 4)};

// Scrape status
const SCRAPE_STATUS = ${JSON.stringify(scrapeStatus, null, 4)};

// Metadata
const DATA_META = {
    lastScraped: "${new Date().toISOString()}",
    scraperVersion: "2.0.0",
    location: "Islington, N1",
    note: "Auto-generated by scraper"
};
`;
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
