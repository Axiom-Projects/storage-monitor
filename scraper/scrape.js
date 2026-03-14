#!/usr/bin/env node
// ============================================================
// STORAGE MONITOR - PRICE SCRAPER v3
// Strategy: Submit quote forms with temp email, capture prices
// from on-screen responses + parse quote emails
// ============================================================

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.js");
const TARGET_SIZES = [25, 50, 75, 100, 150];

// Dummy contact details for quote forms
const CONTACT = {
    firstName: "James",
    lastName: "Wilson",
    phone: "07700900123",
    // Email will be set dynamically via mail.tm
    email: null
};

// ============================================================
// TEMP EMAIL (mail.tm API)
// ============================================================
async function createTempEmail() {
    try {
        // Get available domain
        const domainRes = await fetch("https://api.mail.tm/domains?page=1");
        const domainData = await domainRes.json();
        const domain = domainData["hydra:member"]?.[0]?.domain;
        if (!domain) throw new Error("No mail.tm domain available");

        const address = `storagemonitor${Date.now()}@${domain}`;
        const password = "StorMon2026!";

        // Create account
        const createRes = await fetch("https://api.mail.tm/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, password })
        });

        if (!createRes.ok) {
            const err = await createRes.text();
            console.log(`  mail.tm account creation: ${createRes.status} ${err}`);
            // Might already exist or rate limited - use a fallback
            return { address: `storagequotes${Math.floor(Math.random() * 9999)}@gmail.com`, token: null, isFake: true };
        }

        // Get auth token
        const tokenRes = await fetch("https://api.mail.tm/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, password })
        });
        const tokenData = await tokenRes.json();

        console.log(`  Temp email created: ${address}`);
        return { address, token: tokenData.token, isFake: false };
    } catch (err) {
        console.log(`  mail.tm error: ${err.message} - using fallback email`);
        return { address: `storagequotes${Math.floor(Math.random() * 9999)}@gmail.com`, token: null, isFake: true };
    }
}

async function checkEmailInbox(token, waitMs = 30000) {
    if (!token) return [];
    const messages = [];
    const start = Date.now();

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
                        html: msg.html?.join("") || ""
                    });
                }
                return messages;
            }
        } catch {}
        await new Promise(r => setTimeout(r, 5000));
    }
    return messages;
}

function extractPricesFromEmailText(text) {
    const prices = {};
    const lines = text.split(/\n/);
    for (const line of lines) {
        const sizeMatch = line.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
        if (!sizeMatch) continue;
        const size = parseInt(sizeMatch[1]);
        if (!TARGET_SIZES.includes(size)) continue;

        let priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w|weekly)/i);
        if (!priceMatch) priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)/);
        if (priceMatch) {
            const p = parseFloat(priceMatch[1]);
            if (p > 5 && p < 500) prices[size] = p;
        }
    }
    return prices;
}

// ============================================================
// HELPERS
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
        if (priceMatch) { prices[size] = +(parseFloat(priceMatch[1]) * 12 / 52).toFixed(2); continue; }

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

    const sizeFields = ["size", "sqft", "squareFeet", "sq_ft", "area", "unitSize", "unit_size", "roomSize", "fSize", "Width"];
    const priceFields = ["price", "weeklyPrice", "weekly_price", "pricePerWeek", "rate", "weeklyRate", "unitPrice", "fPrice", "dPrice", "standardPrice", "webPrice"];

    let foundSize = null, foundPrice = null;
    for (const sf of sizeFields) { if (obj[sf] !== undefined) { foundSize = Number(obj[sf]); break; } }
    for (const pf of priceFields) { if (obj[pf] !== undefined) { foundPrice = Number(obj[pf]); break; } }

    if (foundSize && foundPrice && TARGET_SIZES.includes(foundSize) && foundPrice > 5 && foundPrice < 500) {
        prices[foundSize] = foundPrice;
    }

    const nameFields = ["name", "description", "title", "label", "unitName", "roomName"];
    for (const nf of nameFields) {
        if (obj[nf] && typeof obj[nf] === "string") {
            const m = obj[nf].match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
            if (m && TARGET_SIZES.includes(parseInt(m[1])) && foundPrice) {
                prices[parseInt(m[1])] = foundPrice;
            }
        }
    }

    Object.values(obj).forEach(val => extractPricesFromJSON(val, prices));
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
    try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) { await el.fill(value); return true; }
    } catch {}
    return false;
}

async function trySelect(page, selector, value) {
    try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) { await el.selectOption(value); return true; }
    } catch {}
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
// SCRAPERS
// ============================================================
const SCRAPERS = {
    metro: {
        name: "Metro Storage",
        async scrape(context, email) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            await page.goto("https://www.metro-storage.co.uk/self-storage-n1/", { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(5000);

            // Get deals from page
            const text = await page.evaluate(() => document.body?.innerText || "");
            const deals = extractDeals(text);
            let prices = extractPricesFromText(text);

            // Try to find and click quote/price links
            const clicked = await tryClick(page, [
                'a[href*="quote"]', 'a[href*="price"]', 'a[href*="book"]',
                'text=/get.*quote/i', 'text=/see.*price/i', 'text=/book/i'
            ]);
            if (clicked) {
                await page.waitForTimeout(5000);
                const newText = await page.evaluate(() => document.body?.innerText || "");
                Object.assign(prices, extractPricesFromText(newText));
            }

            // Check intercepted APIs
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
        async scrape(context, email) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            // Go to the RapidStor quote tool
            await page.goto("https://www.accessstorage.com/storage?storeid=26", { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(5000);

            // Accept cookies
            await tryClick(page, ['text=/accept.*cookie/i', 'text=/accept.*all/i', '#cookie-accept', 'button[class*="cookie"]', 'text=/agree/i']);
            await page.waitForTimeout(2000);

            // The RapidStor widget should be loaded. Try to select sizes.
            // Look for size selection buttons or dropdowns
            for (const size of TARGET_SIZES) {
                // Try clicking size options
                await tryClick(page, [
                    `text="${size} sq ft"`, `text="${size} sqft"`, `text="${size}sq ft"`,
                    `[data-size="${size}"]`, `[data-sqft="${size}"]`
                ]);
            }
            await page.waitForTimeout(3000);

            // Try filling in quote form if visible
            await tryFill(page, 'input[name*="name"], input[name*="first"]', CONTACT.firstName);
            await tryFill(page, 'input[name*="last"], input[name*="surname"]', CONTACT.lastName);
            await tryFill(page, 'input[name*="email"], input[type="email"]', email);
            await tryFill(page, 'input[name*="phone"], input[name*="tel"], input[type="tel"]', CONTACT.phone);

            // Submit
            await tryClick(page, ['text=/get.*quote/i', 'text=/submit/i', 'text=/next/i', 'button[type="submit"]']);
            await page.waitForTimeout(5000);

            const text = await page.evaluate(() => document.body?.innerText || "");
            let prices = extractPricesFromText(text);

            // Also get deals from main page
            const mainPage = await context.newPage();
            await mainPage.goto("https://www.accessstorage.com/central-london/access-self-storage-islington", { waitUntil: "domcontentloaded", timeout: 20000 });
            await mainPage.waitForTimeout(3000);
            const mainText = await mainPage.evaluate(() => document.body?.innerText || "");
            const deals = extractDeals(mainText + "\n" + text);
            await mainPage.close();

            for (const { body } of apiData) {
                try { Object.assign(prices, extractPricesFromJSON(JSON.parse(body))); } catch {}
            }

            console.log(`  Intercepted ${apiData.length} API calls`);
            await screenshot(page, "access");
            await page.close();
            return { prices, deals };
        }
    },

    urban: {
        name: "Urban Locker",
        async scrape(context, email) {
            let prices = {};
            const apiData = [];

            // Visit each size's quote page and try to submit
            for (const size of TARGET_SIZES) {
                const page = await context.newPage();
                interceptAll(page, apiData);

                const url = `https://quote.urbanlocker.co.uk/storage/urban-locker-islington/${size}`;
                console.log(`    Size ${size}sqft: ${url}`);
                try {
                    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
                    await page.waitForTimeout(4000);

                    // Fill in the quote form
                    await trySelect(page, 'select[name*="title"]', 'Mr');
                    await tryFill(page, 'input[name*="first"], input[name*="First"]', CONTACT.firstName);
                    await tryFill(page, 'input[name*="last"], input[name*="Last"], input[name*="surname"], input[name*="Surname"]', CONTACT.lastName);
                    await tryFill(page, 'input[name*="email"], input[name*="Email"], input[type="email"]', email);
                    await tryFill(page, 'input[name*="phone"], input[name*="Phone"], input[name*="tel"], input[type="tel"]', CONTACT.phone);

                    // Submit the form
                    const submitted = await tryClick(page, [
                        'text=/get.*quote/i', 'text=/submit/i', 'text=/request/i',
                        'button[type="submit"]', 'input[type="submit"]'
                    ]);

                    if (submitted) {
                        console.log(`    Submitted form for ${size}sqft`);
                        await page.waitForTimeout(8000);

                        // Check if price appeared on screen
                        const responseText = await page.evaluate(() => document.body?.innerText || "");
                        const found = extractPricesFromText(responseText);
                        if (found[size]) {
                            prices[size] = found[size];
                            console.log(`    Got price for ${size}sqft: £${found[size]}`);
                        }

                        // Also check for any price on the page
                        const anyPrice = await page.evaluate(() => {
                            const matches = document.body.innerText.match(/£\s*(\d+(?:\.\d{1,2})?)/g);
                            if (matches) {
                                for (const m of matches) {
                                    const val = parseFloat(m.replace(/£\s*/, ""));
                                    if (val > 10 && val < 300) return val;
                                }
                            }
                            return null;
                        });
                        if (anyPrice && !prices[size]) {
                            prices[size] = anyPrice;
                            console.log(`    Found price on page for ${size}sqft: £${anyPrice}`);
                        }
                    }

                    if (size === 50) await screenshot(page, "urban");
                } catch (err) {
                    console.log(`    Error on size ${size}: ${err.message}`);
                }
                await page.close();
            }

            // Get deals from main page
            const dealsPage = await context.newPage();
            await dealsPage.goto("https://www.urbanlocker.co.uk/storage/islington/", { waitUntil: "domcontentloaded", timeout: 20000 });
            await dealsPage.waitForTimeout(3000);
            const dealsText = await dealsPage.evaluate(() => document.body?.innerText || "");
            const deals = extractDeals(dealsText);
            await dealsPage.close();

            for (const { body } of apiData) {
                try { Object.assign(prices, extractPricesFromJSON(JSON.parse(body))); } catch {}
            }

            return { prices, deals };
        }
    },

    safestore: {
        name: "Safestore",
        async scrape(context, email) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            await page.goto("https://www.safestore.co.uk/self-storage/london/north/kings-cross/", { waitUntil: "domcontentloaded", timeout: 45000 });
            await page.waitForTimeout(8000);

            // Accept cookies
            await tryClick(page, ['#onetrust-accept-btn-handler', 'text=/accept.*cookie/i', 'text=/accept.*all/i']);
            await page.waitForTimeout(2000);

            // Try to find quote form or pricing section
            await tryClick(page, [
                'text=/get.*quote/i', 'text=/see.*price/i', 'text=/view.*room/i',
                'text=/check.*availability/i', 'text=/book.*now/i', 'text=/reserve/i',
                'a[href*="quote"]', 'a[href*="book"]'
            ]);
            await page.waitForTimeout(5000);

            // Try filling any visible form
            await tryFill(page, 'input[name*="name"], input[name*="first"]', CONTACT.firstName);
            await tryFill(page, 'input[name*="last"], input[name*="surname"]', CONTACT.lastName);
            await tryFill(page, 'input[name*="email"], input[type="email"]', email);
            await tryFill(page, 'input[name*="phone"], input[name*="tel"], input[type="tel"]', CONTACT.phone);
            await tryClick(page, ['button[type="submit"]', 'text=/submit/i', 'text=/get.*quote/i']);
            await page.waitForTimeout(5000);

            // Scroll through page
            for (let i = 1; i <= 4; i++) {
                await page.evaluate((step) => window.scrollTo(0, (document.body.scrollHeight * step) / 4), i);
                await page.waitForTimeout(1500);
            }

            const text = await page.evaluate(() => document.body?.innerText || "");
            let prices = extractPricesFromText(text);
            const deals = extractDeals(text);

            // Parse API data - log useful-looking ones
            let jsonApiCount = 0;
            for (const { url, body } of apiData) {
                if (body.startsWith("{") || body.startsWith("[")) {
                    jsonApiCount++;
                    try {
                        const json = JSON.parse(body);
                        Object.assign(prices, extractPricesFromJSON(json));
                        // Also try text-based extraction on stringified JSON
                        const jsonStr = JSON.stringify(json);
                        if (jsonStr.includes("price") || jsonStr.includes("rate") || jsonStr.includes("£")) {
                            console.log(`    API with pricing keywords: ${url.substring(0, 100)}`);
                            console.log(`    Preview: ${jsonStr.substring(0, 200)}`);
                        }
                    } catch {}
                }
            }
            console.log(`  Total JSON API calls: ${jsonApiCount}/${apiData.length}`);

            await screenshot(page, "safestore");
            await page.close();
            return { prices, deals };
        }
    },

    bigyellow: {
        name: "Big Yellow",
        async scrape(context, email) {
            const page = await context.newPage();
            const apiData = [];
            interceptAll(page, apiData);

            // Use domcontentloaded instead of networkidle (Big Yellow is slow)
            await page.goto("https://www.bigyellow.co.uk/kings-cross-self-storage-units", { waitUntil: "domcontentloaded", timeout: 45000 });
            await page.waitForTimeout(8000);

            // Accept cookies
            await tryClick(page, ['#onetrust-accept-btn-handler', 'text=/accept.*cookie/i', 'text=/got it/i', 'text=/agree/i']);
            await page.waitForTimeout(2000);

            // Try various navigation paths
            await tryClick(page, [
                'text=/get.*quote/i', 'text=/see.*room/i', 'text=/view.*room/i',
                'text=/check.*price/i', 'text=/book/i', 'text=/reserve/i',
                'a[href*="quote"]', 'a[href*="price"]', 'a[href*="room"]', 'a[href*="book"]'
            ]);
            await page.waitForTimeout(5000);

            // Fill any visible form
            await tryFill(page, 'input[name*="name"], input[name*="first"]', CONTACT.firstName);
            await tryFill(page, 'input[name*="email"], input[type="email"]', email);
            await tryFill(page, 'input[name*="phone"], input[name*="tel"], input[type="tel"]', CONTACT.phone);
            await tryClick(page, ['button[type="submit"]', 'text=/submit/i', 'text=/get.*quote/i']);
            await page.waitForTimeout(5000);

            // Scroll
            for (let i = 1; i <= 5; i++) {
                await page.evaluate((s) => window.scrollTo(0, (document.body.scrollHeight * s) / 5), i);
                await page.waitForTimeout(1000);
            }

            const text = await page.evaluate(() => document.body?.innerText || "");
            let prices = extractPricesFromText(text);
            const deals = extractDeals(text);

            let jsonApiCount = 0;
            for (const { url, body } of apiData) {
                if (body.startsWith("{") || body.startsWith("[")) {
                    jsonApiCount++;
                    try {
                        const json = JSON.parse(body);
                        Object.assign(prices, extractPricesFromJSON(json));
                        const jsonStr = JSON.stringify(json);
                        if (jsonStr.includes("price") || jsonStr.includes("rate") || jsonStr.includes("£")) {
                            console.log(`    API with pricing keywords: ${url.substring(0, 100)}`);
                            console.log(`    Preview: ${jsonStr.substring(0, 200)}`);
                        }
                    } catch {}
                }
            }
            console.log(`  Total JSON API calls: ${jsonApiCount}/${apiData.length}`);

            await screenshot(page, "bigyellow");
            await page.close();
            return { prices, deals };
        }
    }
};

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log("=== Storage Monitor Scraper v3 ===");
    console.log(`Date: ${new Date().toISOString()}`);

    // Create temp email
    console.log("\n--- Setting up temp email ---");
    const tempEmail = await createTempEmail();
    CONTACT.email = tempEmail.address;
    console.log(`  Using email: ${tempEmail.address} (${tempEmail.isFake ? "fallback" : "live inbox"})`);

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
            const result = await config.scrape(context, tempEmail.address);
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

    // Check email inbox for any quote responses
    if (tempEmail.token) {
        console.log("\n--- Checking email inbox for quotes ---");
        const emails = await checkEmailInbox(tempEmail.token, 30000);
        console.log(`  Received ${emails.length} emails`);
        for (const msg of emails) {
            console.log(`  From: ${msg.from} | Subject: ${msg.subject}`);
            const emailPrices = extractPricesFromEmailText(msg.text || msg.html);
            if (Object.keys(emailPrices).length > 0) {
                console.log(`  Prices from email: ${JSON.stringify(emailPrices)}`);
                // Try to match email to provider
                const sender = (msg.from + " " + msg.subject).toLowerCase();
                for (const [key, config] of Object.entries(SCRAPERS)) {
                    if (sender.includes(key) || sender.includes(config.name.toLowerCase())) {
                        Object.assign(results[key].prices, emailPrices);
                        console.log(`  Matched to ${config.name}`);
                    }
                }
            }
        }
    }

    // Build and save data
    const updatedData = buildDataFile(existingData, results, today);
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
        else { status = "failed"; message = "No prices extracted - quote form may need adjustment"; }
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
    scraperVersion: "3.0.0",
    location: "Islington, N1",
    note: "Auto-generated by scraper"
};
`;
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
