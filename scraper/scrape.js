#!/usr/bin/env node
// ============================================================
// STORAGE MONITOR - PRICE SCRAPER
// Runs via GitHub Actions on a schedule (daily)
// Uses Playwright to render JS-heavy storage sites
// ============================================================

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.js");

// --- Scraper Configs ---
const SCRAPERS = {
    metro: {
        url: "https://www.metro-storage.co.uk/self-storage-n1/",
        async scrape(page) {
            await page.goto(this.url, { waitUntil: "networkidle", timeout: 30000 });
            return await page.evaluate(() => {
                const prices = {};
                const deals = [];

                // Look for pricing elements - Metro uses various selectors
                // Try common patterns for storage site pricing
                const priceElements = document.querySelectorAll(
                    '[class*="price"], [class*="cost"], [class*="rate"], ' +
                    '[data-price], [data-size], .unit-price, .storage-price, ' +
                    '.price-card, .pricing-card, .unit-card'
                );

                priceElements.forEach(el => {
                    const text = el.textContent;
                    // Look for patterns like "25 sq ft" or "25sqft" paired with "£XX.XX"
                    const sizeMatch = text.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
                    const priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)/);
                    if (sizeMatch && priceMatch) {
                        const size = parseInt(sizeMatch[1]);
                        const price = parseFloat(priceMatch[1]);
                        if ([25, 50, 75, 100, 150].includes(size)) {
                            prices[size] = price;
                        }
                    }
                });

                // Look for deals/offers
                const allText = document.body.innerText;
                const dealPatterns = [
                    /(\d+%\s*off[^.!]*(?:[.!]|$))/gi,
                    /(first\s+\w+\s+(?:week|month)[^.!]*(?:free|off|discount)[^.!]*)/gi,
                    /(free\s+(?:first|1st)\s+\w+\s+(?:week|month)[^.!]*)/gi,
                    /(special\s+offer[^.!]*(?:[.!]|$))/gi
                ];
                dealPatterns.forEach(pattern => {
                    const matches = allText.match(pattern);
                    if (matches) deals.push(...matches.map(m => m.trim()));
                });

                return { prices, deals: [...new Set(deals)] };
            });
        }
    },

    access: {
        url: "https://www.accessstorage.com/central-london/access-self-storage-islington",
        async scrape(page) {
            await page.goto(this.url, { waitUntil: "networkidle", timeout: 30000 });
            // Access sometimes loads prices via XHR - wait for content
            await page.waitForTimeout(3000);
            return await page.evaluate(() => {
                const prices = {};
                const deals = [];

                // Access Storage typically shows unit cards with size + price
                const cards = document.querySelectorAll(
                    '[class*="unit"], [class*="room"], [class*="size"], ' +
                    '[class*="price"], .card, [class*="storage-option"]'
                );

                cards.forEach(card => {
                    const text = card.textContent;
                    const sizeMatch = text.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
                    const priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w)/i);
                    if (sizeMatch && priceMatch) {
                        const size = parseInt(sizeMatch[1]);
                        const price = parseFloat(priceMatch[1]);
                        if ([25, 50, 75, 100, 150].includes(size)) {
                            prices[size] = price;
                        }
                    }
                });

                // Also try monthly prices and convert
                if (Object.keys(prices).length === 0) {
                    cards.forEach(card => {
                        const text = card.textContent;
                        const sizeMatch = text.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
                        const priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+month|\/\s*m(?:onth)?|pm|p\.m|pcm)/i);
                        if (sizeMatch && priceMatch) {
                            const size = parseInt(sizeMatch[1]);
                            const monthlyPrice = parseFloat(priceMatch[1]);
                            const weeklyPrice = +(monthlyPrice * 12 / 52).toFixed(2);
                            if ([25, 50, 75, 100, 150].includes(size)) {
                                prices[size] = weeklyPrice;
                            }
                        }
                    });
                }

                // Deals
                const allText = document.body.innerText;
                const dealPatterns = [
                    /(\d+%\s*off[^.!]*(?:[.!]|$))/gi,
                    /(first\s+\w+\s+(?:week|month)[^.!]*(?:free|off|discount)[^.!]*)/gi,
                    /(special\s+offer[^.!]*(?:[.!]|$))/gi
                ];
                dealPatterns.forEach(pattern => {
                    const matches = allText.match(pattern);
                    if (matches) deals.push(...matches.map(m => m.trim()));
                });

                return { prices, deals: [...new Set(deals)] };
            });
        }
    },

    urban: {
        url: "https://www.urbanlocker.co.uk/storage/islington/",
        async scrape(page) {
            await page.goto(this.url, { waitUntil: "networkidle", timeout: 30000 });
            await page.waitForTimeout(3000);
            return await page.evaluate(() => {
                const prices = {};
                const deals = [];

                // Urban Locker shows unit cards
                const elements = document.querySelectorAll(
                    '[class*="unit"], [class*="price"], [class*="size"], ' +
                    '[class*="locker"], .card, [class*="storage"]'
                );

                elements.forEach(el => {
                    const text = el.textContent;
                    const sizeMatch = text.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
                    const priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w)/i);
                    if (sizeMatch && priceMatch) {
                        const size = parseInt(sizeMatch[1]);
                        const price = parseFloat(priceMatch[1]);
                        if ([25, 50, 75, 100, 150].includes(size)) {
                            prices[size] = price;
                        }
                    }
                });

                // Deals
                const allText = document.body.innerText;
                const dealPatterns = [
                    /(\d+%\s*off[^.!]*(?:[.!]|$))/gi,
                    /(price\s+match[^.!]*(?:[.!]|$))/gi,
                    /(first\s+\w+\s+(?:week|month)[^.!]*(?:free|off)[^.!]*)/gi
                ];
                dealPatterns.forEach(pattern => {
                    const matches = allText.match(pattern);
                    if (matches) deals.push(...matches.map(m => m.trim()));
                });

                return { prices, deals: [...new Set(deals)] };
            });
        }
    },

    safestore: {
        url: "https://www.safestore.co.uk/self-storage/london/north/kings-cross/",
        async scrape(page) {
            // Safestore uses Cloudflare + heavy JS. Intercept API responses for pricing data.
            const apiPrices = [];
            page.on("response", async (response) => {
                const url = response.url();
                if (url.includes("api") || url.includes("price") || url.includes("quote") || url.includes("room") || url.includes("unit")) {
                    try {
                        const body = await response.text();
                        if (body.includes("price") || body.includes("sqft") || body.includes("sq ft")) {
                            apiPrices.push({ url, body });
                        }
                    } catch {}
                }
            });

            await page.goto(this.url, { waitUntil: "networkidle", timeout: 45000 });
            await page.waitForTimeout(8000); // Extra time for Cloudflare challenge

            // Try clicking "View prices" or "Get a quote" if available
            try {
                const viewPricesBtn = await page.$('text=/view.*price|see.*price|get.*quote|show.*price/i');
                if (viewPricesBtn) {
                    await viewPricesBtn.click();
                    await page.waitForTimeout(3000);
                }
            } catch {}

            // Extract from rendered page
            const pageData = await page.evaluate(() => {
                const prices = {};
                const deals = [];

                // Try all possible selectors for Safestore's layout
                const selectors = [
                    '[class*="price"]', '[class*="unit"]', '[class*="room"]',
                    '[class*="size"]', '[class*="product"]', '.card',
                    '[class*="storage-room"]', '[class*="room-card"]',
                    '[data-room]', '[data-unit]', '[data-price]',
                    'table tr', 'li', '.list-item'
                ];

                document.querySelectorAll(selectors.join(", ")).forEach(el => {
                    const text = el.textContent;
                    const sizeMatch = text.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
                    // Try weekly price first
                    let priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w)/i);
                    let isMonthly = false;
                    // Fall back to monthly
                    if (!priceMatch) {
                        priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+month|\/\s*m(?:onth)?|pm|p\.m|pcm)/i);
                        isMonthly = true;
                    }
                    // Fall back to any price near a size
                    if (!priceMatch) {
                        priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)/);
                    }
                    if (sizeMatch && priceMatch) {
                        const size = parseInt(sizeMatch[1]);
                        let price = parseFloat(priceMatch[1]);
                        if (isMonthly) price = +(price * 12 / 52).toFixed(2);
                        if ([25, 50, 75, 100, 150].includes(size) && price > 5 && price < 500) {
                            prices[size] = price;
                        }
                    }
                });

                // Deals
                const allText = document.body.innerText;
                const dealPatterns = [
                    /(\d+%\s*off[^.!\n]*)/gi,
                    /(first\s+\w+\s+(?:week|month)[^.!\n]*(?:free|off|half)[^.!\n]*)/gi,
                    /(\d+\s+weeks?\s+(?:free|half)[^.!\n]*)/gi,
                    /(lowest\s+price\s+guarantee[^.!\n]*)/gi,
                    /(special\s+offer[^.!\n]*)/gi
                ];
                dealPatterns.forEach(pattern => {
                    const matches = allText.match(pattern);
                    if (matches) deals.push(...matches.map(m => m.trim()));
                });

                return { prices, deals: [...new Set(deals)] };
            });

            // Also try to parse intercepted API data
            for (const { body } of apiPrices) {
                try {
                    const json = JSON.parse(body);
                    // Walk the JSON looking for price/size pairs
                    const walk = (obj) => {
                        if (!obj || typeof obj !== "object") return;
                        if (Array.isArray(obj)) { obj.forEach(walk); return; }
                        const size = obj.size || obj.sqft || obj.squareFeet || obj.sq_ft;
                        const price = obj.price || obj.weeklyPrice || obj.weekly_price || obj.pricePerWeek;
                        if (size && price && [25, 50, 75, 100, 150].includes(Number(size))) {
                            pageData.prices[Number(size)] = Number(price);
                        }
                        Object.values(obj).forEach(walk);
                    };
                    walk(json);
                } catch {}
            }

            return pageData;
        }
    },

    bigyellow: {
        url: "https://www.bigyellow.co.uk/kings-cross-self-storage-units",
        async scrape(page) {
            // Big Yellow also blocks simple requests. Use API interception approach.
            const apiPrices = [];
            page.on("response", async (response) => {
                const url = response.url();
                if (url.includes("api") || url.includes("price") || url.includes("quote") || url.includes("room") || url.includes("unit") || url.includes("store")) {
                    try {
                        const body = await response.text();
                        if (body.includes("price") || body.includes("sqft") || body.includes("size")) {
                            apiPrices.push({ url, body });
                        }
                    } catch {}
                }
            });

            await page.goto(this.url, { waitUntil: "networkidle", timeout: 45000 });
            await page.waitForTimeout(5000);

            // Try to interact with the page to load prices
            try {
                const seeAllBtn = await page.$('text=/see all|view.*room|view.*price|all.*size|show.*all/i');
                if (seeAllBtn) {
                    await seeAllBtn.click();
                    await page.waitForTimeout(3000);
                }
            } catch {}

            // Scroll down to trigger lazy-loaded content
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);

            const pageData = await page.evaluate(() => {
                const prices = {};
                const deals = [];

                // Big Yellow uses structured room cards
                const selectors = [
                    '[class*="price"]', '[class*="unit"]', '[class*="room"]',
                    '[class*="size"]', '[class*="product"]', '.card',
                    '[class*="storage"]', '[class*="space"]',
                    '[data-room]', '[data-unit]', '[data-price]',
                    'table tr', 'li', '.list-item'
                ];

                document.querySelectorAll(selectors.join(", ")).forEach(el => {
                    const text = el.textContent;
                    const sizeMatch = text.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
                    let priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w)/i);
                    let isMonthly = false;
                    if (!priceMatch) {
                        priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+month|\/\s*m(?:onth)?|pm|p\.m|pcm)/i);
                        isMonthly = true;
                    }
                    if (!priceMatch) {
                        priceMatch = text.match(/£\s*(\d+(?:\.\d{1,2})?)/);
                    }
                    if (sizeMatch && priceMatch) {
                        const size = parseInt(sizeMatch[1]);
                        let price = parseFloat(priceMatch[1]);
                        if (isMonthly) price = +(price * 12 / 52).toFixed(2);
                        if ([25, 50, 75, 100, 150].includes(size) && price > 5 && price < 500) {
                            prices[size] = price;
                        }
                    }
                });

                // Deals
                const allText = document.body.innerText;
                const dealPatterns = [
                    /(\d+%\s*off[^.!\n]*)/gi,
                    /(first\s+\w+\s+(?:week|month)[^.!\n]*(?:free|off|discount)[^.!\n]*)/gi,
                    /(special\s+offer[^.!\n]*)/gi
                ];
                dealPatterns.forEach(pattern => {
                    const matches = allText.match(pattern);
                    if (matches) deals.push(...matches.map(m => m.trim()));
                });

                return { prices, deals: [...new Set(deals)] };
            });

            // Parse intercepted API data
            for (const { body } of apiPrices) {
                try {
                    const json = JSON.parse(body);
                    const walk = (obj) => {
                        if (!obj || typeof obj !== "object") return;
                        if (Array.isArray(obj)) { obj.forEach(walk); return; }
                        const size = obj.size || obj.sqft || obj.squareFeet || obj.sq_ft;
                        const price = obj.price || obj.weeklyPrice || obj.weekly_price || obj.pricePerWeek;
                        if (size && price && [25, 50, 75, 100, 150].includes(Number(size))) {
                            pageData.prices[Number(size)] = Number(price);
                        }
                        Object.values(obj).forEach(walk);
                    };
                    walk(json);
                } catch {}
            }

            return pageData;
        }
    }
};

// --- Main ---
async function main() {
    console.log("=== Storage Monitor Scraper ===");
    console.log(`Date: ${new Date().toISOString()}`);

    // Read existing data
    const existingData = readExistingData();

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });

    const results = {};
    const today = new Date().toISOString().split("T")[0];

    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, "..", "screenshots");
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    for (const [key, config] of Object.entries(SCRAPERS)) {
        console.log(`\nScraping ${key} (${config.url})...`);
        const page = await context.newPage();
        try {
            const result = await config.scrape(page);
            results[key] = result;
            console.log(`  Prices found: ${JSON.stringify(result.prices)}`);
            console.log(`  Deals found: ${result.deals.length > 0 ? result.deals.join(" | ") : "None"}`);

            // Take screenshot for debugging
            await page.screenshot({
                path: path.join(screenshotsDir, `${key}.png`),
                fullPage: true
            });
            console.log(`  Screenshot saved: screenshots/${key}.png`);

            // If no prices found, dump page text for analysis
            if (Object.keys(result.prices).length === 0) {
                const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
                console.log(`  WARNING: No prices extracted. Page text preview:\n    ${bodyText.replace(/\n/g, "\n    ").substring(0, 500)}`);
            }
        } catch (err) {
            console.error(`  ERROR scraping ${key}: ${err.message}`);
            results[key] = { prices: {}, deals: [], error: err.message };
            try {
                await page.screenshot({ path: path.join(screenshotsDir, `${key}-error.png`) });
            } catch {}
        }
        await page.close();
    }

    await browser.close();

    // Build updated data
    const updatedData = buildDataFile(existingData, results, today);
    fs.writeFileSync(DATA_FILE, updatedData, "utf-8");
    console.log(`\nData file updated: ${DATA_FILE}`);
    console.log("Done.");
}

function readExistingData() {
    try {
        const content = fs.readFileSync(DATA_FILE, "utf-8");
        // Parse out the JS objects (simple extraction)
        const extract = (varName) => {
            const regex = new RegExp(`const ${varName}\\s*=\\s*([\\s\\S]*?);\\s*(?:const |$)`, "m");
            const match = content.match(regex);
            if (match) {
                try {
                    return eval(`(${match[1]})`);
                } catch { return null; }
            }
            return null;
        };
        return {
            currentPrices: extract("CURRENT_PRICES"),
            priceHistory: extract("PRICE_HISTORY"),
            priceChanges: extract("PRICE_CHANGES"),
            currentDeals: extract("CURRENT_DEALS"),
            dealsHistory: extract("DEALS_HISTORY")
        };
    } catch {
        return { currentPrices: null, priceHistory: [], priceChanges: [], currentDeals: {}, dealsHistory: [] };
    }
}

function buildDataFile(existing, scraped, today) {
    // Merge scraped prices with existing (keep existing if scrape failed)
    const newPrices = {};
    const newChanges = [...(existing.priceChanges || [])];
    const newDeals = {};
    const dealsHistory = [...(existing.dealsHistory || [])];

    for (const [key, result] of Object.entries(scraped)) {
        // Prices - only update if we got data
        if (result.prices && Object.keys(result.prices).length > 0) {
            newPrices[key] = result.prices;

            // Detect price changes
            if (existing.currentPrices && existing.currentPrices[key]) {
                for (const [size, newPrice] of Object.entries(result.prices)) {
                    const oldPrice = existing.currentPrices[key][size];
                    if (oldPrice && oldPrice !== newPrice) {
                        newChanges.push({
                            date: today,
                            provider: key,
                            size: parseInt(size),
                            oldPrice,
                            newPrice
                        });
                        console.log(`  PRICE CHANGE: ${key} ${size}sqft ${oldPrice} -> ${newPrice}`);
                    }
                }
            }
        } else if (existing.currentPrices && existing.currentPrices[key]) {
            // Keep existing prices if scrape got nothing
            newPrices[key] = existing.currentPrices[key];
        }

        // Deals
        if (result.deals && result.deals.length > 0) {
            const dealText = result.deals[0]; // Primary deal
            const discountMatch = dealText.match(/(\d+)%/);
            const weeksMatch = dealText.match(/(\d+)\s*weeks?/i);
            const monthsMatch = dealText.match(/(\d+)\s*months?/i);

            newDeals[key] = {
                active: true,
                text: dealText,
                discountPct: discountMatch ? parseInt(discountMatch[1]) : 0,
                maxWeeks: weeksMatch ? parseInt(weeksMatch[1]) : (monthsMatch ? parseInt(monthsMatch[1]) * 4 : 0),
                firstSeen: today,
                lastSeen: today
            };

            // Check if this deal already exists in history
            const existingDeal = dealsHistory.find(d => d.provider === key && d.text === dealText && d.active);
            if (existingDeal) {
                existingDeal.lastSeen = today;
                newDeals[key].firstSeen = existingDeal.firstSeen;
            } else {
                dealsHistory.push({
                    provider: key,
                    text: dealText,
                    firstSeen: today,
                    lastSeen: today,
                    active: true
                });
            }
        } else {
            newDeals[key] = {
                active: false,
                text: "No current deal detected",
                discountPct: 0,
                maxWeeks: 0,
                firstSeen: null,
                lastSeen: null
            };

            // Mark any active deals for this provider as ended
            dealsHistory.forEach(d => {
                if (d.provider === key && d.active) {
                    d.active = false;
                    d.lastSeen = today;
                }
            });
        }
    }

    // Add today's prices to history
    const history = [...(existing.priceHistory || [])];
    // Don't add duplicate date entries
    if (!history.find(h => h.date === today)) {
        history.push({ date: today, prices: { ...newPrices } });
    }

    // Keep only last 365 days of history
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const filteredHistory = history.filter(h => new Date(h.date) >= yearAgo);

    // Re-read the PROVIDERS block from existing file to preserve it
    const existingContent = fs.readFileSync(DATA_FILE, "utf-8");
    const providersMatch = existingContent.match(/const PROVIDERS = \{[\s\S]*?\n\};/);
    const providersBlock = providersMatch ? providersMatch[0] : "";

    // Generate output
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

// Metadata
const DATA_META = {
    lastScraped: "${new Date().toISOString()}",
    scraperVersion: "1.0.0",
    location: "Islington, N1",
    note: "Auto-generated by scraper"
};
`;
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
