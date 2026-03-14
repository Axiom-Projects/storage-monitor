// ============================================================
// STORAGE MONITOR - APPLICATION LOGIC
// ============================================================

(function () {
    "use strict";

    // --- Password ---
    const PASSWORD_HASH = "angus";
    const SESSION_KEY = "storage_monitor_auth";

    // --- State ---
    let selectedSize = 50;
    let selectedPeriod = 30;
    let priceChart = null;
    let sqftChart = null;

    // --- Init ---
    function init() {
        if (sessionStorage.getItem(SESSION_KEY) === "1") {
            showDashboard();
        }
        document.getElementById("login-form").addEventListener("submit", handleLogin);
        document.getElementById("logout-btn").addEventListener("click", handleLogout);
        setupSizeButtons();
        setupTimeButtons();
    }

    // --- Auth ---
    function handleLogin(e) {
        e.preventDefault();
        const input = document.getElementById("password-input").value;
        if (input === PASSWORD_HASH) {
            sessionStorage.setItem(SESSION_KEY, "1");
            showDashboard();
        } else {
            const err = document.getElementById("login-error");
            err.style.display = "block";
            document.getElementById("password-input").value = "";
            document.getElementById("password-input").focus();
        }
    }

    function handleLogout() {
        sessionStorage.removeItem(SESSION_KEY);
        document.getElementById("dashboard").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        document.getElementById("password-input").value = "";
    }

    function showDashboard() {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        applyOverrides();
        setupManualEntry();
        renderAll();
    }

    // --- Controls ---
    function setupSizeButtons() {
        document.querySelectorAll("#size-buttons .size-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#size-buttons .size-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                selectedSize = parseInt(btn.dataset.size);
                renderAll();
            });
        });
    }

    function setupTimeButtons() {
        document.querySelectorAll("#time-buttons .size-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#time-buttons .size-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                selectedPeriod = btn.dataset.period === "all" ? 9999 : parseInt(btn.dataset.period);
                renderAll();
            });
        });
    }

    // --- Render All ---
    function renderAll() {
        renderLastUpdated();
        renderSummaryCards();
        renderAlerts();
        renderPriceTable();
        renderPriceChart();
        renderSqftChart();
        renderDealsTimeline();
        renderChangelog();
        renderScrapeStatus();
        renderOverridesList();
        updateSizeLabels();
    }

    function updateSizeLabels() {
        document.getElementById("table-size-label").textContent = `(${selectedSize} sqft)`;
        document.getElementById("chart-size-label").textContent = `(${selectedSize} sqft/week)`;
    }

    function renderLastUpdated() {
        const d = new Date(DATA_META.lastScraped);
        document.getElementById("last-updated").textContent =
            `Last scraped: ${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }

    // --- Summary Cards ---
    function renderSummaryCards() {
        const size = selectedSize;
        const myPrice = CURRENT_PRICES.metro[size];
        const competitorPrices = Object.entries(CURRENT_PRICES)
            .filter(([k]) => k !== "metro")
            .map(([k, v]) => ({ provider: k, price: v[size] }))
            .sort((a, b) => a.price - b.price);

        // Position
        const allPrices = Object.entries(CURRENT_PRICES)
            .map(([k, v]) => ({ provider: k, price: v[size] }))
            .sort((a, b) => a.price - b.price);
        const position = allPrices.findIndex(p => p.provider === "metro") + 1;
        const posEl = document.getElementById("your-position");
        posEl.textContent = `#${position} of ${allPrices.length}`;
        posEl.style.color = position === 1 ? "var(--green)" : position <= 2 ? "var(--amber)" : "var(--red)";
        document.getElementById("your-position-detail").textContent =
            position === 1 ? "Cheapest in market" : `${formatGBP(myPrice)}/wk vs cheapest ${formatGBP(allPrices[0].price)}/wk`;

        // Market average
        const compAvg = competitorPrices.reduce((s, p) => s + p.price, 0) / competitorPrices.length;
        const avgEl = document.getElementById("market-avg");
        avgEl.textContent = formatGBP(compAvg);
        const diff = myPrice - compAvg;
        const pctDiff = ((diff / compAvg) * 100).toFixed(0);
        const detailEl = document.getElementById("market-avg-detail");
        if (diff < 0) {
            detailEl.textContent = `You're ${formatGBP(Math.abs(diff))} below avg (${Math.abs(pctDiff)}% cheaper)`;
            detailEl.style.color = "var(--green)";
        } else {
            detailEl.textContent = `You're ${formatGBP(diff)} above avg (${pctDiff}% pricier)`;
            detailEl.style.color = "var(--red)";
        }

        // Active deals
        const activeDeals = Object.entries(CURRENT_DEALS).filter(([k, d]) => !PROVIDERS[k].isYou && d.active);
        document.getElementById("active-deals").textContent = activeDeals.length;
        document.getElementById("deals-detail").textContent =
            activeDeals.length > 0
                ? activeDeals.map(([k]) => PROVIDERS[k].shortName).join(", ")
                : "No competitor deals active";

        // Price changes in last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentChanges = PRICE_CHANGES.filter(c => new Date(c.date) >= weekAgo);
        document.getElementById("recent-changes").textContent = recentChanges.length;
        if (recentChanges.length > 0) {
            const ups = recentChanges.filter(c => c.newPrice > c.oldPrice).length;
            const downs = recentChanges.filter(c => c.newPrice < c.oldPrice).length;
            document.getElementById("changes-detail").textContent = `${ups} increase${ups !== 1 ? "s" : ""}, ${downs} decrease${downs !== 1 ? "s" : ""}`;
        } else {
            document.getElementById("changes-detail").textContent = "No changes detected";
        }
    }

    // --- Alerts ---
    function renderAlerts() {
        const alerts = [];

        // Check for new deals in last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        DEALS_HISTORY.forEach(deal => {
            if (deal.active && new Date(deal.firstSeen) >= weekAgo) {
                alerts.push(`<strong>${PROVIDERS[deal.provider].name}</strong> launched a new deal: "${deal.text}"`);
            }
        });

        // Check for significant price drops
        const recentChanges = PRICE_CHANGES.filter(c => new Date(c.date) >= weekAgo);
        recentChanges.forEach(c => {
            const pctChange = ((c.newPrice - c.oldPrice) / c.oldPrice * 100).toFixed(1);
            if (c.newPrice < c.oldPrice && Math.abs(pctChange) >= 3) {
                alerts.push(
                    `<strong>${PROVIDERS[c.provider].name}</strong> dropped ${c.size}sqft price by ${Math.abs(pctChange)}% ` +
                    `(${formatGBP(c.oldPrice)} -> ${formatGBP(c.newPrice)})`
                );
            }
        });

        // Check if any competitor is now cheaper than you
        Object.entries(CURRENT_PRICES).forEach(([key, prices]) => {
            if (key === "metro") return;
            if (prices[selectedSize] < CURRENT_PRICES.metro[selectedSize]) {
                alerts.push(
                    `<strong>${PROVIDERS[key].name}</strong> is cheaper than you at ${selectedSize}sqft ` +
                    `(${formatGBP(prices[selectedSize])}/wk vs your ${formatGBP(CURRENT_PRICES.metro[selectedSize])}/wk)`
                );
            }
        });

        const banner = document.getElementById("alerts-banner");
        const content = document.getElementById("alerts-content");
        if (alerts.length > 0) {
            banner.style.display = "flex";
            content.innerHTML = alerts.map(a => `<div style="margin-bottom:4px">${a}</div>`).join("");
        } else {
            banner.style.display = "none";
        }
    }

    // --- Price Table ---
    function renderPriceTable() {
        const size = selectedSize;
        const myPrice = CURRENT_PRICES.metro[size];
        const rows = Object.entries(CURRENT_PRICES)
            .map(([key, prices]) => {
                const price = prices[size];
                const provider = PROVIDERS[key];
                const deal = CURRENT_DEALS[key];
                const perSqft = (price / size).toFixed(2);
                const monthly = (price * 52 / 12).toFixed(2);

                let effectiveWeekly = price;
                if (deal && deal.active && deal.discountPct > 0) {
                    effectiveWeekly = price * (1 - deal.discountPct / 100);
                }

                let vsYou = "";
                let vsClass = "";
                if (!provider.isYou) {
                    const diff = price - myPrice;
                    const pct = ((diff / myPrice) * 100).toFixed(0);
                    if (diff > 0) {
                        vsYou = `+${formatGBP(diff)} (+${pct}%)`;
                        vsClass = "pricier";
                    } else if (diff < 0) {
                        vsYou = `${formatGBP(diff)} (${pct}%)`;
                        vsClass = "cheaper";
                    } else {
                        vsYou = "Same";
                        vsClass = "price-same";
                    }
                }

                return {
                    key,
                    name: provider.name + (provider.isYou ? " (You)" : ""),
                    isYou: provider.isYou,
                    price,
                    monthly,
                    perSqft,
                    deal: deal && deal.active ? deal.text : "—",
                    dealActive: deal && deal.active,
                    effectiveWeekly: formatGBP(effectiveWeekly),
                    vsYou,
                    vsClass
                };
            })
            .sort((a, b) => a.price - b.price);

        const tbody = document.getElementById("price-table-body");
        tbody.innerHTML = rows.map(r => `
            <tr class="${r.isYou ? "is-you" : ""}">
                <td>${r.name}</td>
                <td>${formatGBP(r.price)}</td>
                <td>${formatGBP(r.monthly)}</td>
                <td>${formatGBP(r.perSqft)}</td>
                <td>${r.dealActive ? `<span class="deal-badge">${r.deal}</span>` : r.deal}</td>
                <td>${r.effectiveWeekly}/wk</td>
                <td class="${r.vsClass}">${r.isYou ? "—" : r.vsYou}</td>
            </tr>
        `).join("");
    }

    // --- Price History Chart ---
    function renderPriceChart() {
        const size = selectedSize;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - selectedPeriod);

        const filteredHistory = selectedPeriod === 9999
            ? PRICE_HISTORY
            : PRICE_HISTORY.filter(h => new Date(h.date) >= cutoff);

        const labels = filteredHistory.map(h => {
            const d = new Date(h.date);
            return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        });

        const datasets = Object.entries(PROVIDERS).map(([key, provider]) => ({
            label: provider.shortName,
            data: filteredHistory.map(h => h.prices[key] ? h.prices[key][size] : null),
            borderColor: provider.color,
            backgroundColor: provider.color + "20",
            borderWidth: provider.isYou ? 3 : 2,
            borderDash: provider.isYou ? [] : [5, 3],
            pointRadius: 3,
            pointHoverRadius: 6,
            tension: 0.3
        }));

        const ctx = document.getElementById("price-chart").getContext("2d");
        if (priceChart) priceChart.destroy();
        priceChart = new Chart(ctx, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: {
                        labels: { color: "#8b90a5", usePointStyle: true, pointStyle: "circle" }
                    },
                    tooltip: {
                        backgroundColor: "#1a1d27",
                        borderColor: "#2e3347",
                        borderWidth: 1,
                        titleColor: "#e4e7f1",
                        bodyColor: "#e4e7f1",
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${formatGBP(ctx.parsed.y)}/wk`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "#2e334730" },
                        ticks: { color: "#8b90a5" }
                    },
                    y: {
                        grid: { color: "#2e334730" },
                        ticks: {
                            color: "#8b90a5",
                            callback: v => formatGBP(v)
                        }
                    }
                }
            }
        });
    }

    // --- Per-Sqft Bar Chart ---
    function renderSqftChart() {
        const sizes = [25, 50, 75, 100, 150];
        const providerKeys = Object.keys(PROVIDERS);

        const datasets = providerKeys.map(key => ({
            label: PROVIDERS[key].shortName,
            data: sizes.map(s => CURRENT_PRICES[key][s] ? +(CURRENT_PRICES[key][s] / s).toFixed(2) : null),
            backgroundColor: PROVIDERS[key].color + "CC",
            borderColor: PROVIDERS[key].color,
            borderWidth: 1,
            borderRadius: 4
        }));

        const ctx = document.getElementById("sqft-chart").getContext("2d");
        if (sqftChart) sqftChart.destroy();
        sqftChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: sizes.map(s => `${s} sqft`),
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: "#8b90a5", usePointStyle: true, pointStyle: "circle" }
                    },
                    tooltip: {
                        backgroundColor: "#1a1d27",
                        borderColor: "#2e3347",
                        borderWidth: 1,
                        titleColor: "#e4e7f1",
                        bodyColor: "#e4e7f1",
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${formatGBP(ctx.parsed.y)}/sqft/wk`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "#2e334730" },
                        ticks: { color: "#8b90a5" }
                    },
                    y: {
                        grid: { color: "#2e334730" },
                        ticks: {
                            color: "#8b90a5",
                            callback: v => `£${v.toFixed(2)}`
                        },
                        title: {
                            display: true,
                            text: "£ per sqft per week",
                            color: "#8b90a5"
                        }
                    }
                }
            }
        });
    }

    // --- Deals Timeline ---
    function renderDealsTimeline() {
        const container = document.getElementById("deals-timeline");
        const sorted = [...DEALS_HISTORY].sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            return new Date(b.firstSeen) - new Date(a.firstSeen);
        });

        container.innerHTML = sorted.map(deal => {
            const provider = PROVIDERS[deal.provider];
            const statusClass = deal.active ? "active" : "expired";
            const statusText = deal.active ? "Active" : "Ended";
            const dates = deal.active
                ? `Since ${formatDate(deal.firstSeen)}`
                : `${formatDate(deal.firstSeen)} - ${formatDate(deal.lastSeen)}`;
            return `
                <div class="deal-item ${deal.active ? "" : "deal-ended"}">
                    <div class="deal-provider" style="color:${provider.color}">${provider.name}</div>
                    <div class="deal-text">${deal.text}</div>
                    <div class="deal-dates">${dates}</div>
                    <span class="deal-status ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join("");
    }

    // --- Changelog ---
    function renderChangelog() {
        const tbody = document.getElementById("changelog-body");
        const sorted = [...PRICE_CHANGES].sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = sorted.map(c => {
            const diff = c.newPrice - c.oldPrice;
            const pct = ((diff / c.oldPrice) * 100).toFixed(1);
            const cls = diff > 0 ? "price-up" : "price-down";
            const arrow = diff > 0 ? "\u2191" : "\u2193";
            return `
                <tr>
                    <td>${formatDate(c.date)}</td>
                    <td>${PROVIDERS[c.provider].name}</td>
                    <td>${c.size} sqft</td>
                    <td>${formatGBP(c.oldPrice)}</td>
                    <td>${formatGBP(c.newPrice)}</td>
                    <td class="${cls}">${arrow} ${formatGBP(Math.abs(diff))} (${pct > 0 ? "+" : ""}${pct}%)</td>
                </tr>
            `;
        }).join("");
    }

    // --- Scrape Status ---
    function renderScrapeStatus() {
        const tbody = document.getElementById("status-table-body");
        if (!tbody) return;
        if (typeof SCRAPE_STATUS === "undefined") {
            tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted)">No scrape status data yet - run the scraper first</td></tr>';
            return;
        }

        const overrides = getOverrides();

        tbody.innerHTML = Object.entries(PROVIDERS).map(([key, provider]) => {
            const s = SCRAPE_STATUS[key] || { status: "unknown", lastSuccess: null, pricesFound: 0, message: "" };
            const hasOverride = overrides[key] && Object.keys(overrides[key]).length > 0;

            let statusBadge;
            if (s.status === "ok") {
                statusBadge = '<span style="color:var(--green); font-weight:700">Automated</span>';
            } else if (s.status === "partial") {
                statusBadge = '<span style="color:var(--amber); font-weight:700">Partial</span>';
            } else if (s.status === "failed") {
                statusBadge = '<span style="color:var(--red); font-weight:700">Failed</span>';
            } else if (s.status === "sample") {
                statusBadge = '<span style="color:var(--amber); font-weight:700">Sample Data</span>';
            } else {
                statusBadge = '<span style="color:var(--text-muted)">Unknown</span>';
            }

            if (hasOverride) {
                statusBadge += ' <span style="color:var(--blue); font-size:11px">+ manual override</span>';
            }

            const lastSuccess = s.lastSuccess ? formatDate(s.lastSuccess) : "Never";
            const daysSince = s.lastSuccess
                ? Math.floor((new Date() - new Date(s.lastSuccess)) / 86400000)
                : null;
            const staleWarning = daysSince !== null && daysSince > 3
                ? ` <span style="color:var(--red); font-size:11px">(${daysSince}d ago!)</span>`
                : "";

            return `
                <tr>
                    <td style="font-weight:600">${provider.name}</td>
                    <td>${statusBadge}</td>
                    <td>${s.pricesFound}/5 sizes</td>
                    <td>${lastSuccess}${staleWarning}</td>
                    <td style="color:var(--text-muted); font-size:13px">${s.message}</td>
                </tr>
            `;
        }).join("");
    }

    // --- Manual Price Overrides ---
    const OVERRIDES_KEY = "storage_monitor_overrides";

    function getOverrides() {
        try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {}; } catch { return {}; }
    }

    function applyOverrides() {
        const overrides = getOverrides();
        for (const [key, sizes] of Object.entries(overrides)) {
            if (CURRENT_PRICES[key]) {
                for (const [size, price] of Object.entries(sizes)) {
                    CURRENT_PRICES[key][parseInt(size)] = price;
                }
            }
        }
    }

    function setupManualEntry() {
        // Populate provider dropdown
        const select = document.getElementById("manual-provider");
        Object.entries(PROVIDERS).forEach(([key, p]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = p.name + (p.isYou ? " (You)" : "");
            select.appendChild(opt);
        });

        document.getElementById("manual-save-btn").addEventListener("click", () => {
            const provider = document.getElementById("manual-provider").value;
            const size = document.getElementById("manual-size").value;
            const price = parseFloat(document.getElementById("manual-price").value);
            if (!price || price <= 0) return;

            const overrides = getOverrides();
            if (!overrides[provider]) overrides[provider] = {};
            overrides[provider][size] = price;
            localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));

            document.getElementById("manual-price").value = "";
            applyOverrides();
            renderAll();
        });

        document.getElementById("manual-clear-btn").addEventListener("click", () => {
            localStorage.removeItem(OVERRIDES_KEY);
            // Reload to reset CURRENT_PRICES from data.js
            location.reload();
        });

        renderOverridesList();
    }

    function renderOverridesList() {
        const overrides = getOverrides();
        const el = document.getElementById("manual-overrides");
        const entries = [];
        for (const [key, sizes] of Object.entries(overrides)) {
            for (const [size, price] of Object.entries(sizes)) {
                entries.push(`${PROVIDERS[key]?.name || key}: ${size}sqft = ${formatGBP(price)}/wk`);
            }
        }
        el.textContent = entries.length > 0
            ? "Active overrides: " + entries.join(" | ")
            : "No manual overrides active";
    }

    // --- Helpers ---
    function formatGBP(val) {
        return "\u00a3" + Number(val).toFixed(2);
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }

    // --- Boot ---
    document.addEventListener("DOMContentLoaded", init);
})();
