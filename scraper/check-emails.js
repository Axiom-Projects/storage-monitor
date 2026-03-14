#!/usr/bin/env node
// ============================================================
// STORAGE MONITOR - EMAIL CHECKER
// Runs after the main scraper to check for quote response emails.
// Re-authenticates with mail.tm and parses any incoming quote emails.
// ============================================================

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.js");
const CREDS_FILE = path.join(__dirname, "email-creds.json");
const TARGET_SIZES = [25, 50, 75, 100, 150];

// Provider keywords to match emails to providers
const PROVIDER_KEYWORDS = {
    metro: ["metro storage", "metro-storage"],
    access: ["access self storage", "access storage", "accessstorage"],
    urban: ["urban locker", "urbanlocker"],
    safestore: ["safestore", "safe store"],
    bigyellow: ["big yellow", "bigyellow"]
};

async function main() {
    console.log("=== Storage Monitor Email Checker ===");
    console.log(`Date: ${new Date().toISOString()}`);

    // Read saved email credentials
    if (!fs.existsSync(CREDS_FILE)) {
        console.log("No email credentials found. Run the scraper first.");
        process.exit(0);
    }

    const creds = JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
    console.log(`Checking inbox for: ${creds.address}`);
    console.log(`Credentials saved at: ${creds.savedAt}`);

    // Check if creds are too old (mail.tm accounts expire)
    const ageHours = (Date.now() - new Date(creds.savedAt).getTime()) / (1000 * 60 * 60);
    if (ageHours > 12) {
        console.log(`Credentials are ${ageHours.toFixed(1)} hours old - may have expired. Trying anyway.`);
    }

    // Re-authenticate to get fresh token
    let token = null;
    try {
        const tokenRes = await fetch("https://api.mail.tm/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: creds.address, password: creds.password })
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.log(`Authentication failed: ${tokenRes.status} ${err}`);
            process.exit(0);
        }

        const tokenData = await tokenRes.json();
        token = tokenData.token;
        console.log("Re-authenticated successfully");
    } catch (err) {
        console.log(`Auth error: ${err.message}`);
        process.exit(0);
    }

    // Check inbox - poll for 3 minutes with 15-second intervals
    console.log("\nChecking inbox (polling for 3 minutes)...");
    const allMessages = [];
    const seenIds = new Set(creds.processedMessageIds || []);
    const startTime = Date.now();
    const maxWait = 3 * 60 * 1000; // 3 minutes

    while (Date.now() - startTime < maxWait) {
        try {
            const res = await fetch("https://api.mail.tm/messages?page=1", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const items = data["hydra:member"] || [];

            let newCount = 0;
            for (const item of items) {
                if (seenIds.has(item.id)) continue;
                seenIds.add(item.id);
                newCount++;

                // Fetch full message
                const msgRes = await fetch(`https://api.mail.tm/messages/${item.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const msg = await msgRes.json();
                allMessages.push({
                    id: item.id,
                    from: msg.from?.address || "",
                    subject: msg.subject || "",
                    text: msg.text || "",
                    html: (msg.html || []).join(""),
                    receivedAt: msg.createdAt
                });
                console.log(`  New email from: ${msg.from?.address} | Subject: ${msg.subject}`);
            }

            if (newCount > 0) {
                console.log(`  Found ${newCount} new message(s)`);
                break; // Got new messages, process them
            }
        } catch (err) {
            console.log(`  Inbox check error: ${err.message}`);
        }

        // Wait 15 seconds between checks
        await new Promise(r => setTimeout(r, 15000));
        process.stdout.write(".");
    }

    console.log(`\nTotal new messages: ${allMessages.length}`);

    if (allMessages.length === 0) {
        console.log("No new quote emails received.");
        // Save updated processed IDs
        creds.processedMessageIds = [...seenIds];
        creds.lastChecked = new Date().toISOString();
        fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
        process.exit(0);
    }

    // Parse prices from emails
    const pricesByProvider = {};

    for (const msg of allMessages) {
        console.log(`\nProcessing: "${msg.subject}" from ${msg.from}`);

        // Try to match to a provider
        const searchText = `${msg.from} ${msg.subject} ${msg.text}`.toLowerCase();
        let matchedProvider = null;

        for (const [provider, keywords] of Object.entries(PROVIDER_KEYWORDS)) {
            if (keywords.some(kw => searchText.includes(kw))) {
                matchedProvider = provider;
                break;
            }
        }

        if (!matchedProvider) {
            console.log(`  Could not match to a provider. From: ${msg.from}`);
            console.log(`  Subject: ${msg.subject}`);
            continue;
        }

        console.log(`  Matched to: ${matchedProvider}`);

        // Extract prices from email body
        const content = msg.text || msg.html;
        const prices = extractPricesFromEmail(content);

        if (Object.keys(prices).length > 0) {
            console.log(`  Prices found: ${JSON.stringify(prices)}`);
            pricesByProvider[matchedProvider] = prices;
        } else {
            console.log(`  No prices could be extracted from email body`);
            // Log a preview of the email for debugging
            const preview = (msg.text || "").substring(0, 500).replace(/\n/g, " | ");
            console.log(`  Preview: ${preview}`);
        }
    }

    // Update data.js if we got any prices
    if (Object.keys(pricesByProvider).length > 0) {
        console.log("\n--- Updating data.js with email prices ---");
        updateDataFile(pricesByProvider);
    } else {
        console.log("\nNo prices extracted from emails.");
    }

    // Save processed message IDs so we don't reprocess
    creds.processedMessageIds = [...seenIds];
    creds.lastChecked = new Date().toISOString();
    fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));

    console.log("=== Email check complete ===");
}

function extractPricesFromEmail(text) {
    const prices = {};

    // Clean HTML if present
    const cleanText = text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(p|div|tr|td|th|li)[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&pound;/gi, "£")
        .replace(/&nbsp;/g, " ");

    const lines = cleanText.split(/\n/);

    for (const line of lines) {
        // Look for size mentions
        const sizeMatch = line.match(/(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)/i);
        if (!sizeMatch) continue;
        const size = parseInt(sizeMatch[1]);
        if (!TARGET_SIZES.includes(size)) continue;

        // Look for weekly price
        let priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+week|\/\s*w(?:ee)?k|pw|p\.w\.?|weekly)/i);
        if (priceMatch) {
            const p = parseFloat(priceMatch[1]);
            if (p > 5 && p < 500) { prices[size] = p; continue; }
        }

        // Look for monthly price and convert
        priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s+month|\/\s*m(?:onth)?|pm|p\.m\.?|pcm|monthly)/i);
        if (priceMatch) {
            const monthly = parseFloat(priceMatch[1]);
            if (monthly > 20 && monthly < 2000) {
                prices[size] = +(monthly / 4).toFixed(2); // Convert to weekly (4-weekly billing)
                continue;
            }
        }

        // Look for any £ amount near a size
        priceMatch = line.match(/£\s*(\d+(?:\.\d{1,2})?)/);
        if (priceMatch) {
            const p = parseFloat(priceMatch[1]);
            if (p > 10 && p < 300) prices[size] = p;
        }
    }

    // Also try to find price tables (common in quote emails)
    // Pattern: size ... price on same line or adjacent lines
    const fullText = cleanText.replace(/\n+/g, "\n");
    const tablePattern = /(\d+)\s*(?:sq\.?\s*f(?:ee)?t|sqft)[^\n]*?£\s*(\d+(?:\.\d{1,2})?)/gi;
    let match;
    while ((match = tablePattern.exec(fullText)) !== null) {
        const size = parseInt(match[1]);
        const price = parseFloat(match[2]);
        if (TARGET_SIZES.includes(size) && price > 5 && price < 500) {
            prices[size] = price;
        }
    }

    return prices;
}

function updateDataFile(pricesByProvider) {
    const content = fs.readFileSync(DATA_FILE, "utf-8");
    const today = new Date().toISOString().split("T")[0];

    // Parse current prices from data.js
    const pricesMatch = content.match(/const CURRENT_PRICES = (\{[\s\S]*?\n\});/);
    if (!pricesMatch) {
        console.log("Could not parse CURRENT_PRICES from data.js");
        return;
    }

    let currentPrices;
    try {
        currentPrices = eval(`(${pricesMatch[1]})`);
    } catch {
        console.log("Could not evaluate CURRENT_PRICES");
        return;
    }

    // Merge new prices
    let changed = false;
    for (const [provider, prices] of Object.entries(pricesByProvider)) {
        if (!currentPrices[provider]) currentPrices[provider] = {};
        for (const [size, price] of Object.entries(prices)) {
            const oldPrice = currentPrices[provider][size];
            if (oldPrice !== price) {
                console.log(`  ${provider} ${size}sqft: £${oldPrice || "?"} -> £${price}`);
                currentPrices[provider][size] = price;
                changed = true;
            }
        }
    }

    if (!changed) {
        console.log("  No price changes detected");
        return;
    }

    // Update the CURRENT_PRICES in the file
    const newPricesStr = JSON.stringify(currentPrices, null, 4);
    const updatedContent = content.replace(
        /const CURRENT_PRICES = \{[\s\S]*?\n\};/,
        `const CURRENT_PRICES = ${newPricesStr};`
    );

    // Also update scrape status for providers with email prices
    let finalContent = updatedContent;
    for (const provider of Object.keys(pricesByProvider)) {
        const statusRegex = new RegExp(`"${provider}":\\s*\\{[^}]*"message":\\s*"[^"]*"`, "g");
        const pricesCount = Object.keys(pricesByProvider[provider]).length;
        finalContent = finalContent.replace(statusRegex, (match) => {
            return match
                .replace(/"status":\s*"[^"]*"/, '"status": "ok"')
                .replace(/"pricesFound":\s*\d+/, `"pricesFound": ${pricesCount}`)
                .replace(/"message":\s*"[^"]*"/, `"message": "Updated via email quote (${today})"`);
        });
    }

    fs.writeFileSync(DATA_FILE, finalContent, "utf-8");
    console.log("  data.js updated successfully");
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
