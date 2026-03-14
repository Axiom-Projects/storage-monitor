#!/usr/bin/env node
// ============================================================
// STORAGE MONITOR - PRICE SCRAPER v4
// Strategy:
//   DAILY: Scrape aggregator sites (StorageLocator) + detect deals
//   WEEKLY (Monday): Submit quote forms with rotating fake identity
//   Email checker runs separately after quote submission
// ============================================================

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.js");
const CREDS_FILE = path.join(__dirname, "email-creds.json");
const TARGET_SIZES = [25, 50, 75, 100, 150];

// Rotating identities - different one each week
const IDENTITIES = [
    { firstName: "James", lastName: "Wilson", phone: "07700900123" },
    { firstName: "Sarah", lastName: "Thompson", phone: "07700900456" },
    { firstName: "David", lastName: "Brown", phone: "07700900789" },
    { firstName: "Emma", lastName: "Taylor", phone: "07700901234" },
    { firstName: "Michael", lastName: "Davies", phone: "07700901567" },
    { firstName: "Rachel", lastName: "Clarke", phone: "07700901890" },
    { firstName: "Tom", lastName: "Harris", phone: "07700902123" },
    { firstName: "Laura", lastName: "Mitchell", phone: "07700902456" },
    { firstName: "Chris", lastName: "Roberts", phone: "07700902789" },
    { firstName: "Katie", lastName: "Evans", phone: "07700903012" }
];

function getWeeklyIdentity() {
    // Pick identity based on week number so it rotates
    const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return IDENTITIES[weekNum % IDENTITIES.length];
}

function isQuoteDay() {
    const day = new Date().getDay(); // 0=Sun, 1=Mon
    return day === 1; // Only submit quote forms on Mondays
}

// ============================================================
// TEMP EMAIL (mail.tm API)
// ============================================================
async function createTempEmail() {
    try {
        const domainRes = await fetch("https://api.mail.tm/domains?page=1");
        const domainData = await domainRes.json();
        const domain = domainData["hydra:member"]?.[0]?.domain;
        if (!domain) throw new Error("No mail.tm domain available");

        const address = `sq${Date.now()}@${domain}`;
        const password = `Sm${Date.now()}!`;

        const createRes = await fetch("https://api.mail.tm/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, password })
        });

        if (!createRes.ok) {
            const err = await createRes.text();
            console.log(`  mail.tm creation: ${createRes.status} - ${err.substring(0, 100)}`);
            return null;
        }

        const tokenRes = await fetch("https://api.mail.tm/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, password })
        });
        const tokenData = await tokenRes.json();

        // Save credentials for the email checker to use later
        const creds = {
            address,
            password,
            token: tokenData.token,
            savedAt: new Date().toISOString(),
            processedMessageIds: []
        };
        fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));

        console.log(`  Temp email created: ${address}`);
        return { address, token: tokenData.token };
    } catch (err) {
        console.log(`  mail.tm error: ${err.message}`);
        return null;
    }
}

async function checkEmailInbox(token, waitMs = 600000) {
    if (!token) return [];
    const messages = [];
    const start = Date.now();

    console.log(`  Polling inbox for ${(waitMs / 60000).toFixed(0)} minutes...`);
    while (Date.now() - start < waitMs) {
        try {
            const res = await fetch("https://api.mail.tm/messages?page=1", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const items = data["hydra:member"] || [];
            if (items.length > 0) {
                for (const item of items) {
                    const msgRes = await fetch(`https://api.mail.tm/messages/${item.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const msg = await msgRes.json();
                    messages.push({
                        from: msg.from?.address,
                        subject: msg.subject,
                        text: msg.text || "",
                        html: (msg.html || []).join("")
                    });
                    console.log(`  Email received: ${msg.subject} (from ${msg.from?.address})`);
                }
                return messages;
            }
        } catch {}
        await new Promise(r => setTimeout(r, 30000)); // Check every 30 seconds
        process.stdout.write(".");
    }
    console.log("");
    return messages;
}

// ============================================================
// PRICE EXTRACTION HELPERS
// ============================================================
function extractDeals(text) {
    const deals = [];
    const patterns = [
        /(\d+%\s*off[^.!\n]{0,80})/gi,
        /(first\s+\w+\s+(?:week|month)[^.!\n]{0,60}(?:free|off|half|discount)[^.!\n]{0,40})/gi,
        /(\d+\s+weeks?\s+(?:free|half\s+price)[^.!\n]{0,60})/gi,
        /(price\s+match\s+guarantee[^.!\n]{0,40})/gi,
        /(lowest\s+price\s+guarantee[^.!\n]{0,40})/gi
    ];
    patterns.forEach(p => {
        const matches = text.match(p);
        if (matches) deals.push(...matches.map(m => m.trim().substring(0, 100)));
    });
    return [...new Set(deals)];
}

function extractPricesFromText(text) {
    const prices = {};
    const chunks = text.split(/\n/).filter(l => l.trim());
    for (const chunk of chunks) {
        const sizeMatch = chunk.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
        if (!sizeMatch) continue;
        const size = parseInt(sizeMatch[1]);
        if (!TARGET_SIZES.includes(size)) continue;

        let priceMatch = chunk.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w|weekly)/i);
        if (priceMatch) { prices[size] = parseFloat(priceMatch[1]); continue; }

        priceMatch = chunk.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+month|\/\s*m(?:onth)?|pm|p\.m|pcm|monthly)/i);
        if (priceMatch) { prices[size] = +(parseFloat(priceMatch[1]) / 4).toFixed(2); continue; }

        priceMatch = chunk.match(/£\s*(\d+(?:\.\d{1,2})?)/);
        if (priceMatch) {
            const p = parseFloat(priceMatch[1]);
            if (p > 10 && p < 300) prices[size] = p;
        }
    }
    return prices;
}

function extractPricesFromJSON(obj, prices = {}) {
    if (!obj || typeof obj !== "object") return prices;
    if (Array.isArray(obj)) { obj.forEach(item => extractPricesFromJSON(item, prices)); return prices; }

    const sizeFields = ["size", "sqft", "squareFeet", "sq_ft", "area", "unitSize", "unit_size", "roomSize"];
    const priceFields = ["price", "weeklyPrice", "weekly_price", "pricePerWeek", "rate", "weeklyRate", "unitPrice", "standardPrice", "webPrice"];

    let foundSize = null, foundPrice = null;
    for (const sf of sizeFields) { if (obj[sf] !== undefined) { foundSize = Number(obj[sf]); break; } }
    for (const pf of priceFields) { if (obj[pf] !== undefined) { foundPrice = Number(obj[pf]); break; } }

    if (foundSize && foundPrice && TARGET_SIZES.includes(foundSize) && foundPrice > 5 && foundPrice < 500) {
        prices[foundSize] = foundPrice;
    }

    Object.values(obj).forEach(val => extractPricesFromJSON(val, prices));
    return prices;
}

function extractPricesFromEmailText(text) {
    const prices = {};
    const cleanText = text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(p|div|tr|td|th|li)[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&pound;/gi, "£")
        .replace(/&nbsp;/g, " ");

    const lines = cleanText.split(/\n/);
    for (const line of lines) {
        const sizeMatch = line.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
        if (!sizeMatch) continue;
        const size = parseInt(sizeMatch[1]);
        if (!TARGET_SIZES.includes(size)) continue;

        let priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w\.?|weekly)/i);
        if (priceMatch) { const p = parseFloat(priceMatch[1]); if (p > 5 && p < 500) { prices[size] = p; continue; } }

        priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+month|\/\s*m(?:onth)?|pm|p\.m\.?|pcm|monthly)/i);
        if (priceMatch) { const m = parseFloat(priceMatch[1]); if (m > 20 && m < 2000) { prices[size] = +(m / 4).toFixed(2); continue; } }

        priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)/);
        if (priceMatch) { const p = parseFloat(priceMatch[1]); if (p > 10 && p < 300) prices[size] = p; }
    }
    return prices;
}

async function tryClick(page, selectors) {
    for (const sel of selectors) {
        try {
            const el = await page.$(sel);
            if (el && await el.isVisible()) { await el.click().catch(() => {}); return true; }
        } catch {}
    }
    return false;
}

async function tryFill(page, selector, value) {
    try { const el = await page.$(selector); if (el && await el.isVisible()) { await el.fill(value); return true; } } catch {}
    return false;
}

async function trySelect(page, selector, value) {
    try { const el = await page.$(selector); if (el && await el.isVisible()) { await el.selectOption(value); return true; } } catch {}
    return false;
}

function interceptAll(page, collector) {
    page.on("response", async (response) => {
        const url = response.url();
        const ct = response.headers()["content-type"] || "";
        if (ct.includes("json") || url.match(/price|quote|room|unit|rate|avail|book/i)) {
            try {
                const body = await response.text();
                if (body.length > 10 && body.length < 500000) {
                    collector.push({ url, body, status: response.status() });
                }
            } catch {}
        }
    });
}

const screenshotsDir = path.join(__dirname, "..", "screenshots");
async function screenshot(page, name) {
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    try { await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: true }); } catch {}
}

// ============================================================
// AGGREGATOR SCRAPER (runs daily - no quote forms needed)
// ============================================================
async function scrapeStorageLocator(context) {
    console.log("\n--- Scraping StorageLocator (aggregator) ---");
    const prices = { access: {}, urban: {}, safestore: {}, bigyellow: {} };

    const pages = {
        access: "https://storagelocator.co.uk/location/access-self-storage-islington/",
        urban: "https://storagelocator.co.uk/location/urban-locker/",
        safestore: "https://storagelocator.co.uk/location/safestore-self-storage-kings-cross/",
        bigyellow: "https://storagelocator.co.uk/location/big-yellow-kings-cross/"
    };

    // Also try nearby branches for Big Yellow
    const fallbackPages = {
        bigyellow: "https://storagelocator.co.uk/location/big-yellow-kennington/"
    };

    for (const [provider, url] of Object.entries(pages)) {
        try {
            const page = await context.newPage();
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
            await page.waitForTimeout(3000);

            const text = await page.evaluate(() => document.body?.innerText || "");

            // StorageLocator shows prices like "25 sq ft ... £35.77 per week"
            const extracted = extractPricesFromText(text);
            if (Object.keys(extracted).length > 0) {
                prices[provider] = extracted;
                console.log(`  ${provider}: ${JSON.stringify(extracted)}`);
            } else {
                console.log(`  ${provider}: No prices found on StorageLocator`);
            }

            await page.close();
        } catch (err) {
            console.log(`  ${provider}: StorageLocator error - ${err.message}`);
        }
    }

    // Try fallback pages for providers with no prices
    for (const [provider, url] of Object.entries(fallbackPages)) {
        if (Object.keys(prices[provider]).length === 0) {
            try {
                console.log(`  ${provider}: Trying fallback location...`);
                const page = await context.newPage();
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
                await page.waitForTimeout(3000);

                const text = await page.evaluate(() => document.body?.innerText || "");
                const extracted = extractPricesFromText(text);
                if (Object.keys(extracted).length > 0) {
                    prices[provider] = extracted;
                    console.log(`  ${provider} (fallback): ${JSON.stringify(extracted)}`);
                }

                await page.close();
            } catch (err) {
                console.log(`  ${provider} fallback error: ${err.message}`);
            }
        }
    }

    return prices;
}

// ============================================================
// DEAL SCRAPERS (runs daily - just reads public pages)
// ============================================================
async function scrapeDailyDeals(context) {
    console.log("\n--- Scraping deals from competitor sites ---");
    const deals = {};

    const sites = {
        metro: "https://www.metro-storage.co.uk/self-storage-n1/",
        access: "https://www.accessstorage.com/central-london/access-self-storage-islington",
        urban: "https://www.urbanlocker.co.uk/storage/islington/",
        safestore: "https://www.safestore.co.uk/self-storage/london/north/kings-cross/",
        bigyellow: "https://www.bigyellow.co.uk/kings-cross-self-storage-units"
    };

    for (const [provider, url] of Object.entries(sites)) {
        try {
            const page = await context.newPage();
            const timeout = provider === "bigyellow" ? 60000 : 30000;
            await page.goto(url, { waitUntil: "domcontentloaded", timeout });

            // Big Yellow needs extra time for Incapsula JS challenge
            const waitTime = provider === "bigyellow" ? 15000 : 5000;
            await page.waitForTimeout(waitTime);

            // Accept cookies
            await tryClick(page, ['#onetrust-accept-btn-handler', 'text=/accept.*cookie/i', 'text=/accept.*all/i', 'text=/agree/i']);
            await page.waitForTimeout(1000);

            const text = await page.evaluate(() => document.body?.innerText || "");
            deals[provider] = extractDeals(text);

            if (deals[provider].length > 0) {
                console.log(`  ${provider}: ${deals[provider].join(" | ")}`);
            } else {
                console.log(`  ${provider}: No deals detected`);
            }

            await screenshot(page, provider);
            await page.close();
        } catch (err) {
            console.log(`  ${provider}: Error - ${err.message}`);
            deals[provider] = [];
        }
    }

    return deals;
}

// ============================================================
// QUOTE FORM SUBMITTERS (runs weekly only)
// ============================================================
async function submitQuoteForms(context, email, identity) {
    console.log(`\n--- Submitting quote forms (weekly) ---`);
    console.log(`  Identity: ${identity.firstName} ${identity.lastName}`);
    console.log(`  Email: ${email}`);
    const prices = {};

    // Access Self Storage - RapidStor widget
    try {
        console.log("\n  >> Access Self Storage");
        const page = await context.newPage();
        const apiData = [];
        interceptAll(page, apiData);

        await page.goto("https://www.accessstorage.com/storage?storeid=26", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(5000);
        await tryClick(page, ['text=/accept.*cookie/i', 'text=/accept.*all/i', '#cookie-accept']);
        await page.waitForTimeout(2000);

        await tryFill(page, 'input[name*="name"], input[name*="first"]', identity.firstName);
        await tryFill(page, 'input[name*="last"], input[name*="surname"]', identity.lastName);
        await tryFill(page, 'input[name*="email"], input[type="email"]', email);
        await tryFill(page, 'input[name*="phone"], input[name*="tel"], input[type="tel"]', identity.phone);
        await tryClick(page, ['text=/get.*quote/i', 'text=/submit/i', 'text=/next/i', 'button[type="submit"]']);
        await page.waitForTimeout(5000);

        const text = await page.evaluate(() => document.body?.innerText || "");
        prices.access = extractPricesFromText(text);
        for (const { body } of apiData) {
            try { Object.assign(prices.access || (prices.access = {}), extractPricesFromJSON(JSON.parse(body))); } catch {}
        }
        console.log(`  Intercepted ${apiData.length} API calls`);
        await page.close();
    } catch (err) {
        console.log(`  Access error: ${err.message}`);
    }

    // Urban Locker - per-size quote pages
    try {
        console.log("\n  >> Urban Locker");
        prices.urban = {};
        for (const size of TARGET_SIZES) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            const url = `https://quote.urbanlocker.co.uk/storage/urban-locker-islington/${size}`;
            try {
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
                await page.waitForTimeout(4000);

                await trySelect(page, 'select[name*="title"]', 'Mr');
                await tryFill(page, 'input[name*="first"], input[name*="First"]', identity.firstName);
                await tryFill(page, 'input[name*="last"], input[name*="Last"], input[name*="surname"]', identity.lastName);
                await tryFill(page, 'input[name*="email"], input[name*="Email"], input[type="email"]', email);
                await tryFill(page, 'input[name*="phone"], input[name*="Phone"], input[name*="tel"]', identity.phone);

                await tryClick(page, ['text=/get.*quote/i', 'text=/submit/i', 'text=/request/i', 'button[type="submit"]', 'input[type="submit"]']);
                await page.waitForTimeout(8000);

                const responseText = await page.evaluate(() => document.body?.innerText || "");
                const found = extractPricesFromText(responseText);
                if (found[size]) prices.urban[size] = found[size];

                for (const { body } of apiData) {
                    try { Object.assign(prices.urban, extractPricesFromJSON(JSON.parse(body))); } catch {}
                }
            } catch (err) {
                console.log(`    ${size}sqft error: ${err.message}`);
            }
            await page.close();
        }
    } catch (err) {
        console.log(`  Urban Locker error: ${err.message}`);
    }

    // Safestore - quote form
    try {
        console.log("\n  >> Safestore");
        const page = await context.newPage();
        const apiData = [];
        interceptAll(page, apiData);

        await page.goto("https://www.safestore.co.uk/self-storage/london/north/kings-cross/", { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(8000);
        await tryClick(page, ['#onetrust-accept-btn-handler', 'text=/accept.*cookie/i']);
        await page.waitForTimeout(2000);

        await tryClick(page, ['text=/get.*quote/i', 'text=/see.*price/i', 'text=/check.*availability/i', 'a[href*="quote"]']);
        await page.waitForTimeout(5000);

        await tryFill(page, 'input[name*="name"], input[name*="first"]', identity.firstName);
        await tryFill(page, 'input[name*="last"], input[name*="surname"]', identity.lastName);
        await tryFill(page, 'input[name*="email"], input[type="email"]', email);
        await tryFill(page, 'input[name*="phone"], input[name*="tel"]', identity.phone);
        await tryClick(page, ['button[type="submit"]', 'text=/submit/i', 'text=/get.*quote/i']);
        await page.waitForTimeout(5000);

        const text = await page.evaluate(() => document.body?.innerText || "");
        prices.safestore = extractPricesFromText(text);
        for (const { body } of apiData) {
            if (body.startsWith("{") || body.startsWith("[")) {
                try { Object.assign(prices.safestore || (prices.safestore = {}), extractPricesFromJSON(JSON.parse(body))); } catch {}
            }
        }
        await page.close();
    } catch (err) {
        console.log(`  Safestore error: ${err.message}`);
    }

    // Big Yellow - uses Imperva Incapsula bot protection
    // Strategy: go to quote estimate page, wait for JS challenge to resolve,
    // then navigate the room selection flow to see prices
    try {
        console.log("\n  >> Big Yellow (Incapsula-protected)");
        prices.bigyellow = {};
        const page = await context.newPage();
        const apiData = [];
        interceptAll(page, apiData);

        // Step 1: Hit the store page first to get past Incapsula challenge
        console.log("    Step 1: Loading store page (waiting for Incapsula)...");
        await page.goto("https://www.bigyellow.co.uk/kings-cross-self-storage-units", {
            waitUntil: "domcontentloaded", timeout: 60000
        });
        // Wait longer for Incapsula JS challenge to complete
        await page.waitForTimeout(15000);

        // Check if we got past Incapsula
        const pageTitle = await page.title();
        const bodyText = await page.evaluate(() => document.body?.innerText || "");
        console.log(`    Page title: ${pageTitle}`);

        if (bodyText.includes("Pardon Our Interruption") || bodyText.includes("Incapsula")) {
            console.log("    Still blocked by Incapsula - waiting longer...");
            await page.waitForTimeout(15000);
        }

        // Accept cookies if we got through
        await tryClick(page, ['#onetrust-accept-btn-handler', 'text=/accept.*cookie/i', 'text=/agree/i', 'text=/got it/i']);
        await page.waitForTimeout(2000);

        // Step 2: Navigate to the quote estimate page for Kings Cross
        console.log("    Step 2: Navigating to quote estimate page...");
        await page.goto("https://www.bigyellow.co.uk/quote/estimate/store/kings-cross/", {
            waitUntil: "domcontentloaded", timeout: 60000
        });
        await page.waitForTimeout(10000);

        // Screenshot the quote page
        await screenshot(page, "bigyellow-quote");

        const quoteText = await page.evaluate(() => document.body?.innerText || "");
        console.log(`    Quote page length: ${quoteText.length} chars`);

        // Extract any visible prices
        const visiblePrices = extractPricesFromText(quoteText);
        if (Object.keys(visiblePrices).length > 0) {
            console.log(`    Visible prices: ${JSON.stringify(visiblePrices)}`);
            Object.assign(prices.bigyellow, visiblePrices);
        }

        // Step 3: Try to interact with room selection
        // Big Yellow quote flow: select room size -> see price -> enter details
        console.log("    Step 3: Trying room size selection...");

        // Look for room/size selection elements
        for (const size of TARGET_SIZES) {
            const clicked = await tryClick(page, [
                `text="${size} sq ft"`, `text="${size}sq ft"`, `text="${size} sqft"`,
                `[data-size="${size}"]`, `[data-sqft="${size}"]`, `[data-area="${size}"]`,
                `text="${size}"`,
            ]);
            if (clicked) {
                console.log(`    Clicked size ${size}`);
                await page.waitForTimeout(3000);
            }
        }

        // Try dropdown/slider for size
        await trySelect(page, 'select[name*="size"], select[name*="room"], select[name*="area"]', '50');
        await page.waitForTimeout(3000);

        // Try filling in move-in date and duration (might unlock price display)
        await tryFill(page, 'input[name*="date"], input[type="date"]', '2026-04-01');
        await trySelect(page, 'select[name*="duration"], select[name*="length"], select[name*="period"]', '4');
        await tryClick(page, [
            'text=/see.*price/i', 'text=/get.*price/i', 'text=/calculate/i',
            'text=/next/i', 'text=/continue/i', 'text=/show.*room/i',
            'button[type="submit"]'
        ]);
        await page.waitForTimeout(5000);

        // Check for prices after interaction
        const afterText = await page.evaluate(() => document.body?.innerText || "");
        const afterPrices = extractPricesFromText(afterText);
        if (Object.keys(afterPrices).length > 0) {
            console.log(`    Prices after interaction: ${JSON.stringify(afterPrices)}`);
            Object.assign(prices.bigyellow, afterPrices);
        }

        // Also scan for any price-like patterns (£XX.XX per week)
        const allPriceMatches = await page.evaluate(() => {
            const text = document.body?.innerText || "";
            const matches = [];
            const re = /£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w\.?|weekly)/gi;
            let m;
            while ((m = re.exec(text)) !== null) {
                matches.push({ price: parseFloat(m[1]), context: text.substring(Math.max(0, m.index - 50), m.index + m[0].length + 50) });
            }
            return matches;
        });
        if (allPriceMatches.length > 0) {
            console.log(`    Found ${allPriceMatches.length} price mentions:`);
            allPriceMatches.forEach(m => console.log(`      £${m.price}/wk - "${m.context.trim()}"`));
        }

        // Step 4: Fill quote form if visible (for email response)
        console.log("    Step 4: Submitting quote form for email...");
        await tryFill(page, 'input[name*="name"], input[name*="first"], input[name*="Name"]', identity.firstName);
        await tryFill(page, 'input[name*="last"], input[name*="Last"], input[name*="surname"]', identity.lastName);
        await tryFill(page, 'input[name*="email"], input[name*="Email"], input[type="email"]', email);
        await tryFill(page, 'input[name*="phone"], input[name*="Phone"], input[name*="tel"], input[type="tel"]', identity.phone);
        await tryClick(page, [
            'text=/get.*quote/i', 'text=/submit/i', 'text=/request/i',
            'text=/send/i', 'button[type="submit"]'
        ]);
        await page.waitForTimeout(5000);

        // Check intercepted API calls for pricing data
        let jsonCount = 0;
        for (const { url, body } of apiData) {
            if (body.startsWith("{") || body.startsWith("[")) {
                jsonCount++;
                try {
                    const json = JSON.parse(body);
                    const apiPrices = extractPricesFromJSON(json);
                    if (Object.keys(apiPrices).length > 0) {
                        console.log(`    API prices from ${url.substring(0, 80)}: ${JSON.stringify(apiPrices)}`);
                        Object.assign(prices.bigyellow, apiPrices);
                    }
                    // Log any response containing price-related keywords
                    const jsonStr = JSON.stringify(json);
                    if (jsonStr.includes("price") || jsonStr.includes("rate") || jsonStr.includes("weekly")) {
                        console.log(`    API with pricing keywords: ${url.substring(0, 100)}`);
                        console.log(`    Preview: ${jsonStr.substring(0, 300)}`);
                    }
                } catch {}
            }
        }
        console.log(`    Total JSON API calls intercepted: ${jsonCount}/${apiData.length}`);

        await screenshot(page, "bigyellow-final");
        await page.close();
    } catch (err) {
        console.log(`  Big Yellow error: ${err.message}`);
    }

    return prices;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log("=== Storage Monitor Scraper v4 ===");
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(`Day: ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()]}`);
    console.log(`Mode: ${isQuoteDay() ? "FULL (daily + weekly quotes)" : "DAILY ONLY (aggregator + deals)"}`);

    const existingData = readExistingData();
    const today = new Date().toISOString().split("T")[0];
    const identity = getWeeklyIdentity();

    const browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox"
        ]
    });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: "en-GB",
        timezoneId: "Europe/London"
    });

    // Remove navigator.webdriver flag (helps bypass Incapsula/bot detection)
    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // --- DAILY: Aggregator prices ---
    const aggregatorPrices = await scrapeStorageLocator(context);

    // --- DAILY: Deals from competitor sites ---
    const dailyDeals = await scrapeDailyDeals(context);

    // --- WEEKLY: Submit quote forms + check emails ---
    let quotePrices = {};
    let emailPrices = {};

    if (isQuoteDay()) {
        console.log("\n--- Monday: Submitting weekly quote requests ---");

        // Create temp email for this week
        const tempEmail = await createTempEmail();

        if (tempEmail) {
            quotePrices = await submitQuoteForms(context, tempEmail.address, identity);

            // Wait 10 minutes for immediate auto-reply emails
            console.log("\n--- Waiting 10 minutes for quote emails ---");
            const emails = await checkEmailInbox(tempEmail.token, 600000);
            console.log(`  Received ${emails.length} emails`);

            for (const msg of emails) {
                console.log(`  From: ${msg.from} | Subject: ${msg.subject}`);
                const parsed = extractPricesFromEmailText(msg.text || msg.html);
                if (Object.keys(parsed).length > 0) {
                    console.log(`  Prices from email: ${JSON.stringify(parsed)}`);
                    // Match to provider
                    const sender = `${msg.from} ${msg.subject}`.toLowerCase();
                    if (sender.includes("access")) emailPrices.access = { ...emailPrices.access, ...parsed };
                    else if (sender.includes("urban")) emailPrices.urban = { ...emailPrices.urban, ...parsed };
                    else if (sender.includes("safestore") || sender.includes("safe store")) emailPrices.safestore = { ...emailPrices.safestore, ...parsed };
                    else if (sender.includes("big yellow") || sender.includes("bigyellow")) emailPrices.bigyellow = { ...emailPrices.bigyellow, ...parsed };
                }
            }
        } else {
            console.log("  Could not create temp email - skipping quote forms");
        }
    }

    await browser.close();

    // --- Merge all price sources (email > quote form > aggregator > existing) ---
    const mergedPrices = {};
    const providerKeys = ["metro", "access", "urban", "safestore", "bigyellow"];

    for (const key of providerKeys) {
        mergedPrices[key] = {};

        // Start with existing prices as base
        if (existingData.currentPrices?.[key]) {
            Object.assign(mergedPrices[key], existingData.currentPrices[key]);
        }

        // Layer on aggregator prices
        if (aggregatorPrices[key] && Object.keys(aggregatorPrices[key]).length > 0) {
            Object.assign(mergedPrices[key], aggregatorPrices[key]);
        }

        // Layer on quote form prices (higher priority)
        if (quotePrices[key] && Object.keys(quotePrices[key]).length > 0) {
            Object.assign(mergedPrices[key], quotePrices[key]);
        }

        // Layer on email prices (highest priority)
        if (emailPrices[key] && Object.keys(emailPrices[key]).length > 0) {
            Object.assign(mergedPrices[key], emailPrices[key]);
        }
    }

    // Build the data file
    const updatedData = buildDataFile(existingData, mergedPrices, dailyDeals, aggregatorPrices, quotePrices, emailPrices, today);
    fs.writeFileSync(DATA_FILE, updatedData, "utf-8");
    console.log(`\nData file updated: ${DATA_FILE}`);
    console.log("=== Done ===");
}

// ============================================================
// DATA FILE MANAGEMENT
// ============================================================
function readExistingData() {
    try {
        const content = fs.readFileSync(DATA_FILE, "utf-8");
        const extract = (varName) => {
            const regex = new RegExp(`const ${varName}\\s*=\\s*([\\s\\S]*?);\\s*(?:const |\/\/|$)`, "m");
            const match = content.match(regex);
            if (match) { try { return eval(`(${match[1]})`); } catch { return null; } }
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

function buildDataFile(existing, mergedPrices, dailyDeals, aggregatorPrices, quotePrices, emailPrices, today) {
    const newChanges = [...(existing.priceChanges || [])];
    const newDeals = {};
    const dealsHistory = [...(existing.dealsHistory || [])];

    // Detect price changes
    if (existing.currentPrices) {
        for (const [key, sizes] of Object.entries(mergedPrices)) {
            for (const [size, newPrice] of Object.entries(sizes)) {
                const oldPrice = existing.currentPrices[key]?.[size];
                if (oldPrice && oldPrice !== newPrice) {
                    newChanges.push({ date: today, provider: key, size: parseInt(size), oldPrice, newPrice });
                    console.log(`  PRICE CHANGE: ${key} ${size}sqft £${oldPrice} -> £${newPrice}`);
                }
            }
        }
    }

    // Process deals
    const providerKeys = ["metro", "access", "urban", "safestore", "bigyellow"];
    for (const key of providerKeys) {
        const providerDeals = dailyDeals[key] || [];
        if (providerDeals.length > 0) {
            const dealText = providerDeals[0];
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
        } else if (existing.currentDeals?.[key]) {
            newDeals[key] = existing.currentDeals[key]; // Keep existing deal info
        } else {
            newDeals[key] = { active: false, text: "No current deal detected", discountPct: 0, maxWeeks: 0, firstSeen: null, lastSeen: null };
        }
    }

    // Build scrape status
    const scrapeStatus = {};
    for (const key of providerKeys) {
        const sources = [];
        const aggCount = aggregatorPrices[key] ? Object.keys(aggregatorPrices[key]).length : 0;
        const quoteCount = quotePrices[key] ? Object.keys(quotePrices[key]).length : 0;
        const emailCount = emailPrices[key] ? Object.keys(emailPrices[key]).length : 0;

        if (aggCount > 0) sources.push(`aggregator:${aggCount}`);
        if (quoteCount > 0) sources.push(`quote-form:${quoteCount}`);
        if (emailCount > 0) sources.push(`email:${emailCount}`);

        const totalNew = aggCount + quoteCount + emailCount;
        const totalSizes = mergedPrices[key] ? Object.keys(mergedPrices[key]).length : 0;

        let status, message;
        if (key === "metro") {
            status = "ok"; message = "Internal price sheet";
        } else if (totalNew > 0) {
            status = totalSizes >= 5 ? "ok" : "partial";
            message = `Sources: ${sources.join(", ")} (${totalSizes}/5 sizes)`;
        } else if (totalSizes > 0) {
            status = "partial";
            message = "Using cached prices - no new data today";
        } else {
            status = "failed";
            message = "No prices available";
        }

        scrapeStatus[key] = {
            status,
            lastSuccess: totalNew > 0 ? today : (existing.scrapeStatus?.[key]?.lastSuccess || null),
            pricesFound: totalSizes,
            message
        };
    }

    // Update history
    const history = [...(existing.priceHistory || [])];
    const existingToday = history.findIndex(h => h.date === today);
    if (existingToday >= 0) {
        history[existingToday].prices = { ...mergedPrices };
    } else {
        history.push({ date: today, prices: { ...mergedPrices } });
    }
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const filteredHistory = history.filter(h => new Date(h.date) >= yearAgo);

    // Read PROVIDERS block from existing file
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
const CURRENT_PRICES = ${JSON.stringify(mergedPrices, null, 4)};

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
    scraperVersion: "4.0.0",
    location: "Islington, N1",
    note: "Auto-generated by scraper. Aggregator daily, quotes weekly (Mondays)."
};
`;
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
