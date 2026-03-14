// ============================================================
// STORAGE MONITOR - DATA FILE
// This file is auto-updated by the scraper (GitHub Action)
// Manual edits will be overwritten on next scrape run
// ============================================================

const PROVIDERS = {
    metro: {
        name: "Metro Storage",
        shortName: "Metro",
        isYou: true,
        url: "https://www.metro-storage.co.uk/self-storage-n1/",
        color: "#6366f1",
        location: "Islington, N1"
    },
    access: {
        name: "Access Self Storage",
        shortName: "Access",
        isYou: false,
        url: "https://www.accessstorage.com/central-london/access-self-storage-islington",
        color: "#3b82f6",
        location: "Islington"
    },
    urban: {
        name: "Urban Locker",
        shortName: "Urban Locker",
        isYou: false,
        url: "https://www.urbanlocker.co.uk/storage/islington/",
        color: "#22c55e",
        location: "Islington"
    },
    safestore: {
        name: "Safestore",
        shortName: "Safestore",
        isYou: false,
        url: "https://www.safestore.co.uk/self-storage/london/north/kings-cross/",
        color: "#f59e0b",
        location: "Kings Cross"
    },
    bigyellow: {
        name: "Big Yellow",
        shortName: "Big Yellow",
        isYou: false,
        url: "https://www.bigyellow.co.uk/kings-cross-self-storage-units",
        color: "#ef4444",
        location: "Kings Cross"
    }
};

// Current prices per week in GBP, keyed by provider then size (sqft)
// Last updated: 2026-03-14 (sample data - will be replaced by scraper)
const CURRENT_PRICES = {
    metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
    access:    { 25: 32.50, 50: 55.00, 75: 72.00, 100: 92.00, 150: 130.00 },
    urban:     { 25: 30.00, 50: 52.00, 75: 69.00, 100: 88.00, 150: 125.00 },
    safestore: { 25: 35.00, 50: 58.00, 75: 78.00, 100: 98.00, 150: 140.00 },
    bigyellow: { 25: 38.00, 50: 62.00, 75: 82.00, 100: 105.00, 150: 148.00 }
};

// Active deals & offers
const CURRENT_DEALS = {
    metro: {
        active: true,
        text: "50% off for up to 12 weeks",
        discountPct: 50,
        maxWeeks: 12,
        firstSeen: "2026-02-01",
        lastSeen: "2026-03-14"
    },
    access: {
        active: true,
        text: "50% off up to 13 weeks storage",
        discountPct: 50,
        maxWeeks: 13,
        firstSeen: "2026-01-15",
        lastSeen: "2026-03-14"
    },
    urban: {
        active: true,
        text: "50% off your first 2 months + Price Match Guarantee",
        discountPct: 50,
        maxWeeks: 8,
        firstSeen: "2026-02-10",
        lastSeen: "2026-03-14"
    },
    safestore: {
        active: true,
        text: "50% off for first 8 weeks",
        discountPct: 50,
        maxWeeks: 8,
        firstSeen: "2026-03-01",
        lastSeen: "2026-03-14"
    },
    bigyellow: {
        active: false,
        text: "No current deal detected",
        discountPct: 0,
        maxWeeks: 0,
        firstSeen: null,
        lastSeen: null
    }
};

// Historical price data - array of snapshots
// Each entry: { date: "YYYY-MM-DD", prices: { provider: { size: price } } }
const PRICE_HISTORY = [
    {
        date: "2026-01-06",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 30.00, 50: 52.00, 75: 70.00, 100: 89.00, 150: 126.00 },
            urban:     { 25: 29.00, 50: 50.00, 75: 67.00, 100: 85.00, 150: 120.00 },
            safestore: { 25: 33.00, 50: 55.00, 75: 74.00, 100: 94.00, 150: 135.00 },
            bigyellow: { 25: 36.00, 50: 60.00, 75: 80.00, 100: 102.00, 150: 145.00 }
        }
    },
    {
        date: "2026-01-13",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 30.00, 50: 52.00, 75: 70.00, 100: 89.00, 150: 126.00 },
            urban:     { 25: 29.00, 50: 50.00, 75: 67.00, 100: 85.00, 150: 120.00 },
            safestore: { 25: 33.00, 50: 55.00, 75: 74.00, 100: 94.00, 150: 135.00 },
            bigyellow: { 25: 36.00, 50: 60.00, 75: 80.00, 100: 102.00, 150: 145.00 }
        }
    },
    {
        date: "2026-01-20",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 31.00, 50: 53.00, 75: 70.00, 100: 90.00, 150: 127.00 },
            urban:     { 25: 29.00, 50: 50.00, 75: 67.00, 100: 85.00, 150: 120.00 },
            safestore: { 25: 34.00, 50: 56.00, 75: 75.00, 100: 95.00, 150: 136.00 },
            bigyellow: { 25: 36.00, 50: 60.00, 75: 80.00, 100: 102.00, 150: 145.00 }
        }
    },
    {
        date: "2026-01-27",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 31.00, 50: 53.00, 75: 71.00, 100: 90.00, 150: 128.00 },
            urban:     { 25: 30.00, 50: 51.00, 75: 68.00, 100: 86.00, 150: 122.00 },
            safestore: { 25: 34.00, 50: 56.00, 75: 76.00, 100: 95.00, 150: 137.00 },
            bigyellow: { 25: 37.00, 50: 61.00, 75: 81.00, 100: 103.00, 150: 146.00 }
        }
    },
    {
        date: "2026-02-03",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 32.00, 50: 54.00, 75: 71.00, 100: 91.00, 150: 128.00 },
            urban:     { 25: 30.00, 50: 51.00, 75: 68.00, 100: 87.00, 150: 123.00 },
            safestore: { 25: 34.00, 50: 57.00, 75: 76.00, 100: 96.00, 150: 138.00 },
            bigyellow: { 25: 37.00, 50: 61.00, 75: 81.00, 100: 104.00, 150: 146.00 }
        }
    },
    {
        date: "2026-02-10",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 32.00, 50: 54.00, 75: 72.00, 100: 91.00, 150: 129.00 },
            urban:     { 25: 30.00, 50: 52.00, 75: 69.00, 100: 88.00, 150: 125.00 },
            safestore: { 25: 35.00, 50: 57.00, 75: 77.00, 100: 97.00, 150: 139.00 },
            bigyellow: { 25: 38.00, 50: 62.00, 75: 82.00, 100: 105.00, 150: 148.00 }
        }
    },
    {
        date: "2026-02-17",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 32.00, 50: 54.00, 75: 72.00, 100: 91.00, 150: 129.00 },
            urban:     { 25: 30.00, 50: 52.00, 75: 69.00, 100: 88.00, 150: 125.00 },
            safestore: { 25: 35.00, 50: 57.00, 75: 77.00, 100: 97.00, 150: 139.00 },
            bigyellow: { 25: 38.00, 50: 62.00, 75: 82.00, 100: 105.00, 150: 148.00 }
        }
    },
    {
        date: "2026-02-24",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 32.50, 50: 55.00, 75: 72.00, 100: 92.00, 150: 130.00 },
            urban:     { 25: 30.00, 50: 52.00, 75: 69.00, 100: 88.00, 150: 125.00 },
            safestore: { 25: 35.00, 50: 58.00, 75: 78.00, 100: 98.00, 150: 140.00 },
            bigyellow: { 25: 38.00, 50: 62.00, 75: 82.00, 100: 105.00, 150: 148.00 }
        }
    },
    {
        date: "2026-03-03",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 32.50, 50: 55.00, 75: 72.00, 100: 92.00, 150: 130.00 },
            urban:     { 25: 30.00, 50: 52.00, 75: 69.00, 100: 88.00, 150: 125.00 },
            safestore: { 25: 35.00, 50: 58.00, 75: 78.00, 100: 98.00, 150: 140.00 },
            bigyellow: { 25: 38.00, 50: 62.00, 75: 82.00, 100: 105.00, 150: 148.00 }
        }
    },
    {
        date: "2026-03-10",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 32.50, 50: 55.00, 75: 72.00, 100: 92.00, 150: 130.00 },
            urban:     { 25: 30.00, 50: 52.00, 75: 69.00, 100: 88.00, 150: 125.00 },
            safestore: { 25: 35.00, 50: 58.00, 75: 78.00, 100: 98.00, 150: 140.00 },
            bigyellow: { 25: 38.00, 50: 62.00, 75: 82.00, 100: 105.00, 150: 148.00 }
        }
    },
    {
        date: "2026-03-14",
        prices: {
            metro:     { 25: 28.00, 50: 48.00, 75: 65.00, 100: 82.00, 150: 115.00 },
            access:    { 25: 32.50, 50: 55.00, 75: 72.00, 100: 92.00, 150: 130.00 },
            urban:     { 25: 30.00, 50: 52.00, 75: 69.00, 100: 88.00, 150: 125.00 },
            safestore: { 25: 35.00, 50: 58.00, 75: 78.00, 100: 98.00, 150: 140.00 },
            bigyellow: { 25: 38.00, 50: 62.00, 75: 82.00, 100: 105.00, 150: 148.00 }
        }
    }
];

// Price change log - auto-generated when scraper detects changes
const PRICE_CHANGES = [
    { date: "2026-01-20", provider: "access", size: 25, oldPrice: 30.00, newPrice: 31.00 },
    { date: "2026-01-20", provider: "access", size: 50, oldPrice: 52.00, newPrice: 53.00 },
    { date: "2026-01-20", provider: "safestore", size: 25, oldPrice: 33.00, newPrice: 34.00 },
    { date: "2026-01-20", provider: "safestore", size: 50, oldPrice: 55.00, newPrice: 56.00 },
    { date: "2026-01-27", provider: "urban", size: 25, oldPrice: 29.00, newPrice: 30.00 },
    { date: "2026-01-27", provider: "urban", size: 50, oldPrice: 50.00, newPrice: 51.00 },
    { date: "2026-01-27", provider: "bigyellow", size: 50, oldPrice: 60.00, newPrice: 61.00 },
    { date: "2026-02-03", provider: "access", size: 50, oldPrice: 53.00, newPrice: 54.00 },
    { date: "2026-02-10", provider: "urban", size: 50, oldPrice: 51.00, newPrice: 52.00 },
    { date: "2026-02-10", provider: "safestore", size: 25, oldPrice: 34.00, newPrice: 35.00 },
    { date: "2026-02-10", provider: "bigyellow", size: 25, oldPrice: 37.00, newPrice: 38.00 },
    { date: "2026-02-10", provider: "bigyellow", size: 50, oldPrice: 61.00, newPrice: 62.00 },
    { date: "2026-02-24", provider: "access", size: 25, oldPrice: 32.00, newPrice: 32.50 },
    { date: "2026-02-24", provider: "access", size: 50, oldPrice: 54.00, newPrice: 55.00 },
    { date: "2026-02-24", provider: "safestore", size: 50, oldPrice: 57.00, newPrice: 58.00 }
];

// Deals history - tracks when deals appear and disappear
const DEALS_HISTORY = [
    {
        provider: "metro",
        text: "50% off for up to 12 weeks",
        firstSeen: "2026-02-01",
        lastSeen: "2026-03-14",
        active: true
    },
    {
        provider: "access",
        text: "50% off up to 13 weeks storage",
        firstSeen: "2026-01-15",
        lastSeen: "2026-03-14",
        active: true
    },
    {
        provider: "urban",
        text: "50% off your first 2 months + Price Match Guarantee",
        firstSeen: "2026-02-10",
        lastSeen: "2026-03-14",
        active: true
    },
    {
        provider: "safestore",
        text: "First 8 weeks free on selected units",
        firstSeen: "2025-11-15",
        lastSeen: "2026-01-10",
        active: false
    },
    {
        provider: "safestore",
        text: "50% off for first 8 weeks",
        firstSeen: "2026-03-01",
        lastSeen: "2026-03-14",
        active: true
    },
    {
        provider: "bigyellow",
        text: "25% off first 3 months",
        firstSeen: "2025-12-01",
        lastSeen: "2026-01-31",
        active: false
    }
];

// Scrape status - tracks whether each provider's prices were successfully scraped
// "ok" = prices extracted, "partial" = some sizes missing, "failed" = no prices extracted
const SCRAPE_STATUS = {
    metro:     { status: "sample", lastSuccess: "2026-03-14", pricesFound: 5, message: "Sample data - awaiting first real scrape" },
    access:    { status: "sample", lastSuccess: "2026-03-14", pricesFound: 5, message: "Sample data - awaiting first real scrape" },
    urban:     { status: "sample", lastSuccess: "2026-03-14", pricesFound: 5, message: "Sample data - awaiting first real scrape" },
    safestore: { status: "sample", lastSuccess: "2026-03-14", pricesFound: 5, message: "Sample data - awaiting first real scrape" },
    bigyellow: { status: "sample", lastSuccess: "2026-03-14", pricesFound: 5, message: "Sample data - awaiting first real scrape" }
};

// Metadata
const DATA_META = {
    lastScraped: "2026-03-14T08:30:00Z",
    scraperVersion: "1.0.0",
    location: "Islington, N1",
    note: "Sample data - prices are illustrative. Replace with real scraped data."
};
