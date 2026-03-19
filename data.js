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
// Last updated: 2026-03-19
const CURRENT_PRICES = {
    "metro": {
        "25": 46.75,
        "50": 78.5,
        "75": 101.25,
        "100": 123.75,
        "150": 188.75
    },
    "access": {
        "25": 46.15,
        "50": 72.92,
        "75": 112.38,
        "100": 132.92,
        "150": 224.08
    },
    "urban": {
        "10": 20.01,
        "25": 45.19,
        "35": 46.25,
        "50": 61.73,
        "75": 76.6,
        "100": 97.72,
        "125": 170.45,
        "150": 210.67
    },
    "safestore": {
        "25": 51.49,
        "50": 91.99,
        "75": 125.49,
        "100": 120.49,
        "150": 258.99
    },
    "bigyellow": {
        "25": 37.8,
        "50": 59.4,
        "75": 80.7,
        "100": 101.7,
        "150": 190.5
    }
};

// Active deals & offers
const CURRENT_DEALS = {
    "metro": {
        "active": true,
        "text": "50% off your first 8 weeks",
        "discountPct": 50,
        "maxWeeks": 8,
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-19"
    },
    "access": {
        "active": true,
        "text": "50% off up to 13 weeks storage",
        "discountPct": 50,
        "maxWeeks": 13,
        "firstSeen": "2026-01-15",
        "lastSeen": "2026-03-19"
    },
    "urban": {
        "active": true,
        "text": "50% off your first two months",
        "discountPct": 50,
        "maxWeeks": 0,
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-19"
    },
    "safestore": {
        "active": true,
        "text": "Lowest Price Guarantee*",
        "discountPct": 0,
        "maxWeeks": 0,
        "firstSeen": "2026-03-15",
        "lastSeen": "2026-03-19"
    },
    "bigyellow": {
        "active": true,
        "text": "50% off for first 8 weeks",
        "discountPct": 50,
        "maxWeeks": 8,
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-14"
    }
};

// Historical price data
const PRICE_HISTORY = [
    {
        "date": "2026-01-06",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 30,
                "50": 52,
                "75": 70,
                "100": 89,
                "150": 126
            },
            "urban": {
                "25": 29,
                "50": 50,
                "75": 67,
                "100": 85,
                "150": 120
            },
            "safestore": {
                "25": 33,
                "50": 55,
                "75": 74,
                "100": 94,
                "150": 135
            },
            "bigyellow": {
                "25": 36,
                "50": 60,
                "75": 80,
                "100": 102,
                "150": 145
            }
        }
    },
    {
        "date": "2026-01-13",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 30,
                "50": 52,
                "75": 70,
                "100": 89,
                "150": 126
            },
            "urban": {
                "25": 29,
                "50": 50,
                "75": 67,
                "100": 85,
                "150": 120
            },
            "safestore": {
                "25": 33,
                "50": 55,
                "75": 74,
                "100": 94,
                "150": 135
            },
            "bigyellow": {
                "25": 36,
                "50": 60,
                "75": 80,
                "100": 102,
                "150": 145
            }
        }
    },
    {
        "date": "2026-01-20",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 31,
                "50": 53,
                "75": 70,
                "100": 90,
                "150": 127
            },
            "urban": {
                "25": 29,
                "50": 50,
                "75": 67,
                "100": 85,
                "150": 120
            },
            "safestore": {
                "25": 34,
                "50": 56,
                "75": 75,
                "100": 95,
                "150": 136
            },
            "bigyellow": {
                "25": 36,
                "50": 60,
                "75": 80,
                "100": 102,
                "150": 145
            }
        }
    },
    {
        "date": "2026-01-27",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 31,
                "50": 53,
                "75": 71,
                "100": 90,
                "150": 128
            },
            "urban": {
                "25": 30,
                "50": 51,
                "75": 68,
                "100": 86,
                "150": 122
            },
            "safestore": {
                "25": 34,
                "50": 56,
                "75": 76,
                "100": 95,
                "150": 137
            },
            "bigyellow": {
                "25": 37,
                "50": 61,
                "75": 81,
                "100": 103,
                "150": 146
            }
        }
    },
    {
        "date": "2026-02-03",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 32,
                "50": 54,
                "75": 71,
                "100": 91,
                "150": 128
            },
            "urban": {
                "25": 30,
                "50": 51,
                "75": 68,
                "100": 87,
                "150": 123
            },
            "safestore": {
                "25": 34,
                "50": 57,
                "75": 76,
                "100": 96,
                "150": 138
            },
            "bigyellow": {
                "25": 37,
                "50": 61,
                "75": 81,
                "100": 104,
                "150": 146
            }
        }
    },
    {
        "date": "2026-02-10",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 32,
                "50": 54,
                "75": 72,
                "100": 91,
                "150": 129
            },
            "urban": {
                "25": 30,
                "50": 52,
                "75": 69,
                "100": 88,
                "150": 125
            },
            "safestore": {
                "25": 35,
                "50": 57,
                "75": 77,
                "100": 97,
                "150": 139
            },
            "bigyellow": {
                "25": 38,
                "50": 62,
                "75": 82,
                "100": 105,
                "150": 148
            }
        }
    },
    {
        "date": "2026-02-17",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 32,
                "50": 54,
                "75": 72,
                "100": 91,
                "150": 129
            },
            "urban": {
                "25": 30,
                "50": 52,
                "75": 69,
                "100": 88,
                "150": 125
            },
            "safestore": {
                "25": 35,
                "50": 57,
                "75": 77,
                "100": 97,
                "150": 139
            },
            "bigyellow": {
                "25": 38,
                "50": 62,
                "75": 82,
                "100": 105,
                "150": 148
            }
        }
    },
    {
        "date": "2026-02-24",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 32.5,
                "50": 55,
                "75": 72,
                "100": 92,
                "150": 130
            },
            "urban": {
                "25": 30,
                "50": 52,
                "75": 69,
                "100": 88,
                "150": 125
            },
            "safestore": {
                "25": 35,
                "50": 58,
                "75": 78,
                "100": 98,
                "150": 140
            },
            "bigyellow": {
                "25": 38,
                "50": 62,
                "75": 82,
                "100": 105,
                "150": 148
            }
        }
    },
    {
        "date": "2026-03-03",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 32.5,
                "50": 55,
                "75": 72,
                "100": 92,
                "150": 130
            },
            "urban": {
                "25": 30,
                "50": 52,
                "75": 69,
                "100": 88,
                "150": 125
            },
            "safestore": {
                "25": 35,
                "50": 58,
                "75": 78,
                "100": 98,
                "150": 140
            },
            "bigyellow": {
                "25": 38,
                "50": 62,
                "75": 82,
                "100": 105,
                "150": 148
            }
        }
    },
    {
        "date": "2026-03-10",
        "prices": {
            "metro": {
                "25": 28,
                "50": 48,
                "75": 65,
                "100": 82,
                "150": 115
            },
            "access": {
                "25": 32.5,
                "50": 55,
                "75": 72,
                "100": 92,
                "150": 130
            },
            "urban": {
                "25": 30,
                "50": 52,
                "75": 69,
                "100": 88,
                "150": 125
            },
            "safestore": {
                "25": 35,
                "50": 58,
                "75": 78,
                "100": 98,
                "150": 140
            },
            "bigyellow": {
                "25": 38,
                "50": 62,
                "75": 82,
                "100": 105,
                "150": 148
            }
        }
    },
    {
        "date": "2026-03-14",
        "prices": {
            "metro": {
                "25": 46.75,
                "50": 78.5,
                "75": 101.25,
                "100": 123.75,
                "150": 188.75
            },
            "access": {
                "25": 45.46,
                "50": 66.23,
                "75": 112.38,
                "100": 132.92,
                "150": 223.85
            },
            "urban": {
                "25": 45.19,
                "50": 61.73,
                "75": 76.6,
                "100": 97.72,
                "150": 210.67
            },
            "safestore": {
                "25": 51.49,
                "50": 91.99,
                "75": 125.49,
                "100": 120.49,
                "150": 258.99
            },
            "bigyellow": {
                "25": 37.8,
                "50": 59.4,
                "75": 80.7,
                "100": 101.7,
                "150": 190.5
            }
        }
    },
    {
        "date": "2026-03-15",
        "prices": {
            "metro": {
                "25": 46.75,
                "50": 78.5,
                "75": 101.25,
                "100": 123.75,
                "150": 188.75
            },
            "access": {
                "25": 45.46,
                "50": 66.23,
                "75": 112.38,
                "100": 132.92,
                "150": 223.85
            },
            "urban": {
                "25": 45.19,
                "50": 61.73,
                "75": 76.6,
                "100": 97.72,
                "150": 210.67
            },
            "safestore": {
                "25": 51.49,
                "50": 91.99,
                "75": 125.49,
                "100": 120.49,
                "150": 258.99
            },
            "bigyellow": {
                "25": 37.8,
                "50": 59.4,
                "75": 80.7,
                "100": 101.7,
                "150": 190.5
            }
        }
    },
    {
        "date": "2026-03-16",
        "prices": {
            "metro": {
                "25": 46.75,
                "50": 78.5,
                "75": 101.25,
                "100": 123.75,
                "150": 188.75
            },
            "access": {
                "25": 46.15,
                "50": 72.92,
                "75": 112.38,
                "100": 132.92,
                "150": 224.08
            },
            "urban": {
                "10": 20.01,
                "25": 45.19,
                "35": 46.25,
                "50": 61.73,
                "75": 76.6,
                "100": 97.72,
                "125": 170.45,
                "150": 210.67
            },
            "safestore": {
                "25": 51.49,
                "50": 91.99,
                "75": 125.49,
                "100": 120.49,
                "150": 258.99
            },
            "bigyellow": {
                "25": 37.8,
                "50": 59.4,
                "75": 80.7,
                "100": 101.7,
                "150": 190.5
            }
        }
    },
    {
        "date": "2026-03-17",
        "prices": {
            "metro": {
                "25": 46.75,
                "50": 78.5,
                "75": 101.25,
                "100": 123.75,
                "150": 188.75
            },
            "access": {
                "25": 46.15,
                "50": 72.92,
                "75": 112.38,
                "100": 132.92,
                "150": 224.08
            },
            "urban": {
                "10": 20.01,
                "25": 45.19,
                "35": 46.25,
                "50": 61.73,
                "75": 76.6,
                "100": 97.72,
                "125": 170.45,
                "150": 210.67
            },
            "safestore": {
                "25": 51.49,
                "50": 91.99,
                "75": 125.49,
                "100": 120.49,
                "150": 258.99
            },
            "bigyellow": {
                "25": 37.8,
                "50": 59.4,
                "75": 80.7,
                "100": 101.7,
                "150": 190.5
            }
        }
    },
    {
        "date": "2026-03-18",
        "prices": {
            "metro": {
                "25": 46.75,
                "50": 78.5,
                "75": 101.25,
                "100": 123.75,
                "150": 188.75
            },
            "access": {
                "25": 46.15,
                "50": 72.92,
                "75": 112.38,
                "100": 132.92,
                "150": 224.08
            },
            "urban": {
                "10": 20.01,
                "25": 45.19,
                "35": 46.25,
                "50": 61.73,
                "75": 76.6,
                "100": 97.72,
                "125": 170.45,
                "150": 210.67
            },
            "safestore": {
                "25": 51.49,
                "50": 91.99,
                "75": 125.49,
                "100": 120.49,
                "150": 258.99
            },
            "bigyellow": {
                "25": 37.8,
                "50": 59.4,
                "75": 80.7,
                "100": 101.7,
                "150": 190.5
            }
        }
    },
    {
        "date": "2026-03-19",
        "prices": {
            "metro": {
                "25": 46.75,
                "50": 78.5,
                "75": 101.25,
                "100": 123.75,
                "150": 188.75
            },
            "access": {
                "25": 46.15,
                "50": 72.92,
                "75": 112.38,
                "100": 132.92,
                "150": 224.08
            },
            "urban": {
                "10": 20.01,
                "25": 45.19,
                "35": 46.25,
                "50": 61.73,
                "75": 76.6,
                "100": 97.72,
                "125": 170.45,
                "150": 210.67
            },
            "safestore": {
                "25": 51.49,
                "50": 91.99,
                "75": 125.49,
                "100": 120.49,
                "150": 258.99
            },
            "bigyellow": {
                "25": 37.8,
                "50": 59.4,
                "75": 80.7,
                "100": 101.7,
                "150": 190.5
            }
        }
    }
];

// Price change log
const PRICE_CHANGES = [
    {
        "date": "2026-01-20",
        "provider": "access",
        "size": 25,
        "oldPrice": 30,
        "newPrice": 31
    },
    {
        "date": "2026-01-20",
        "provider": "access",
        "size": 50,
        "oldPrice": 52,
        "newPrice": 53
    },
    {
        "date": "2026-01-20",
        "provider": "safestore",
        "size": 25,
        "oldPrice": 33,
        "newPrice": 34
    },
    {
        "date": "2026-01-20",
        "provider": "safestore",
        "size": 50,
        "oldPrice": 55,
        "newPrice": 56
    },
    {
        "date": "2026-01-27",
        "provider": "urban",
        "size": 25,
        "oldPrice": 29,
        "newPrice": 30
    },
    {
        "date": "2026-01-27",
        "provider": "urban",
        "size": 50,
        "oldPrice": 50,
        "newPrice": 51
    },
    {
        "date": "2026-01-27",
        "provider": "bigyellow",
        "size": 50,
        "oldPrice": 60,
        "newPrice": 61
    },
    {
        "date": "2026-02-03",
        "provider": "access",
        "size": 50,
        "oldPrice": 53,
        "newPrice": 54
    },
    {
        "date": "2026-02-10",
        "provider": "urban",
        "size": 50,
        "oldPrice": 51,
        "newPrice": 52
    },
    {
        "date": "2026-02-10",
        "provider": "safestore",
        "size": 25,
        "oldPrice": 34,
        "newPrice": 35
    },
    {
        "date": "2026-02-10",
        "provider": "bigyellow",
        "size": 25,
        "oldPrice": 37,
        "newPrice": 38
    },
    {
        "date": "2026-02-10",
        "provider": "bigyellow",
        "size": 50,
        "oldPrice": 61,
        "newPrice": 62
    },
    {
        "date": "2026-02-24",
        "provider": "access",
        "size": 25,
        "oldPrice": 32,
        "newPrice": 32.5
    },
    {
        "date": "2026-02-24",
        "provider": "access",
        "size": 50,
        "oldPrice": 54,
        "newPrice": 55
    },
    {
        "date": "2026-02-24",
        "provider": "safestore",
        "size": 50,
        "oldPrice": 57,
        "newPrice": 58
    },
    {
        "date": "2026-03-16",
        "provider": "access",
        "size": 25,
        "oldPrice": 45.46,
        "newPrice": 46.15
    },
    {
        "date": "2026-03-16",
        "provider": "access",
        "size": 50,
        "oldPrice": 66.23,
        "newPrice": 72.92
    },
    {
        "date": "2026-03-16",
        "provider": "access",
        "size": 150,
        "oldPrice": 223.85,
        "newPrice": 224.08
    }
];

// Deals history
const DEALS_HISTORY = [
    {
        "provider": "metro",
        "text": "50% off for up to 12 weeks",
        "firstSeen": "2026-02-01",
        "lastSeen": "2026-03-14",
        "active": false
    },
    {
        "provider": "access",
        "text": "50% off up to 13 weeks storage",
        "firstSeen": "2026-01-15",
        "lastSeen": "2026-03-19",
        "active": true
    },
    {
        "provider": "urban",
        "text": "50% off your first 2 months + Price Match Guarantee",
        "firstSeen": "2026-02-10",
        "lastSeen": "2026-03-14",
        "active": true
    },
    {
        "provider": "safestore",
        "text": "First 8 weeks free on selected units",
        "firstSeen": "2025-11-15",
        "lastSeen": "2026-01-10",
        "active": false
    },
    {
        "provider": "safestore",
        "text": "50% off for first 8 weeks",
        "firstSeen": "2026-03-01",
        "lastSeen": "2026-03-14",
        "active": false
    },
    {
        "provider": "bigyellow",
        "text": "25% off first 3 months",
        "firstSeen": "2025-12-01",
        "lastSeen": "2026-01-31",
        "active": false
    },
    {
        "provider": "metro",
        "text": "50% off your first 8 weeks\n\nAddress:\n27 Maryland Walk, Islington, London N1 8QZ\n\nExact location using What 3 Words:\nladder.",
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-14",
        "active": false
    },
    {
        "provider": "access",
        "text": "50% off up to 13 weeks storage\n\nat Access Self Storage Islington\n\n4.",
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-14",
        "active": true
    },
    {
        "provider": "urban",
        "text": "50% off your first two months!",
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-14",
        "active": true
    },
    {
        "provider": "safestore",
        "text": "Lowest Price Guarantee*",
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-14",
        "active": false
    },
    {
        "provider": "urban",
        "text": "50% off your first two months",
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-19",
        "active": true
    },
    {
        "provider": "metro",
        "text": "50% off your first 8 weeks",
        "firstSeen": "2026-03-14",
        "lastSeen": "2026-03-19",
        "active": true
    },
    {
        "provider": "safestore",
        "text": "Lowest Price Guarantee*",
        "firstSeen": "2026-03-15",
        "lastSeen": "2026-03-19",
        "active": true
    }
];

// Scrape status
const SCRAPE_STATUS = {
    "metro": {
        "status": "ok",
        "lastSuccess": "2026-03-14",
        "pricesFound": 5,
        "message": "Internal price sheet"
    },
    "access": {
        "status": "partial",
        "lastSuccess": "2026-03-16",
        "pricesFound": 5,
        "message": "Using cached prices - no new data today"
    },
    "urban": {
        "status": "partial",
        "lastSuccess": "2026-03-16",
        "pricesFound": 8,
        "message": "Using cached prices - no new data today"
    },
    "safestore": {
        "status": "partial",
        "lastSuccess": "2026-03-14",
        "pricesFound": 5,
        "message": "Using cached prices - no new data today"
    },
    "bigyellow": {
        "status": "partial",
        "lastSuccess": "2026-03-14",
        "pricesFound": 5,
        "message": "Using cached prices - no new data today"
    }
};

// Metadata
const DATA_META = {
    lastScraped: "2026-03-19T08:12:48.214Z",
    scraperVersion: "4.0.0",
    location: "Islington, N1",
    note: "Auto-generated by scraper. Aggregator daily, quotes weekly (Mondays)."
};
