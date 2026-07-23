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
    let ovSize = 50;                          // overview reference size
    const OVERVIEW_OPT = "__overview__";

    // --- Init ---
    function init() {
        document.getElementById("login-form").addEventListener("submit", handleLogin);
        document.getElementById("logout-btn").addEventListener("click", handleLogout);
        document.getElementById("ov-logout-btn").addEventListener("click", handleLogout);
        document.getElementById("back-overview").addEventListener("click", showOverview);
        document.getElementById("ov-grid").addEventListener("click", e => {
            const card = e.target.closest(".ov-card");
            if (card) showDetail(card.dataset.site);
        });
        setupSiteSelector();
        setupSizeButtons();
        setupTimeButtons();
        setupOverviewSizeButtons();
        setupUpdater();
        if (sessionStorage.getItem(SESSION_KEY) === "1") showApp();
    }

    // --- Views ---
    function showApp() {
        document.getElementById("login-screen").style.display = "none";
        setupManualEntry();                  // bind detail controls once
        showOverview();
    }

    function showOverview() {
        document.getElementById("dashboard").style.display = "none";
        document.getElementById("overview").style.display = "block";
        const sel = document.getElementById("site-select");
        if (sel) sel.value = OVERVIEW_OPT;
        const u = document.getElementById("ov-updated");
        if (u && typeof DATA_META !== "undefined") {
            const d = new Date(DATA_META.lastScraped);
            u.textContent = `Updated ${d.toLocaleDateString("en-GB")}`;
        }
        renderOverview();
    }

    function showDetail(key) {
        if (key && key !== OVERVIEW_OPT) switchSite(key);
        document.getElementById("overview").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
    }

    // --- Multi-site ---
    function setupSiteSelector() {
        const sel = document.getElementById("site-select");
        if (!sel || typeof SITES === "undefined") return;
        sel.innerHTML = `<option value="${OVERVIEW_OPT}">↩ All sites</option>` +
            Object.entries(SITES).map(([key, s]) => `<option value="${key}">${s.label}</option>`).join("");
        sel.value = ACTIVE_SITE;
        sel.addEventListener("change", () => {
            if (sel.value === OVERVIEW_OPT) showOverview();
            else showDetail(sel.value);
        });
    }

    function switchSite(key) {
        if (!loadSite(key)) return;
        applyOverrides();
        refreshManualProviders();
        updateSiteChrome();
        renderAll();
    }

    function updateSiteChrome() {
        const s = SITES[ACTIVE_SITE];
        const badge = document.getElementById("location-badge");
        if (badge && s) badge.textContent = s.locationBadge;
        const sel = document.getElementById("site-select");
        if (sel) sel.value = ACTIVE_SITE;
    }

    // --- Auth ---
    function handleLogin(e) {
        e.preventDefault();
        const input = document.getElementById("password-input").value;
        if (input === PASSWORD_HASH) {
            sessionStorage.setItem(SESSION_KEY, "1");
            showApp();
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
        document.getElementById("overview").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        document.getElementById("password-input").value = "";
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
        renderInsuranceFees();
        renderChangelog();
        renderScrapeStatus();
        renderOverridesList();
        updateSizeLabels();
    }

    function updateSizeLabels() {
        document.getElementById("table-size-label").textContent = `(${selectedSize} sqft)`;
        document.getElementById("chart-size-label").textContent = `(${selectedSize} sqft/week)`;
        const fl = document.getElementById("fees-size-label");
        if (fl) {
            const tc = (typeof INSURANCE !== "undefined" && INSURANCE.metro && INSURANCE.metro.coverBySize)
                ? INSURANCE.metro.coverBySize[selectedSize] : null;
            fl.textContent = tc
                ? `(all-in at ${selectedSize} sqft · £${(tc / 1000).toFixed(tc % 1000 ? 1 : 0)}k cover)`
                : `(all-in at ${selectedSize} sqft)`;
        }
    }

    function renderLastUpdated() {
        const d = new Date(DATA_META.lastScraped);
        document.getElementById("last-updated").textContent =
            `Last scraped: ${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }

    // --- Summary Cards ---
    function renderSummaryCards() {
        const size = selectedSize;
        const hasNum = v => typeof v === "number" && !isNaN(v);
        const myPrice = CURRENT_PRICES.metro ? CURRENT_PRICES.metro[size] : undefined;
        const competitorPrices = Object.entries(CURRENT_PRICES)
            .filter(([k]) => k !== "metro")
            .map(([k, v]) => ({ provider: k, price: v[size] }))
            .filter(p => hasNum(p.price))
            .sort((a, b) => a.price - b.price);

        const posEl = document.getElementById("your-position");
        const posDetail = document.getElementById("your-position-detail");
        const avgEl = document.getElementById("market-avg");
        const detailEl = document.getElementById("market-avg-detail");

        // Position (needs your price + at least one competitor price)
        if (hasNum(myPrice) && competitorPrices.length) {
            const allPrices = [{ provider: "metro", price: myPrice }, ...competitorPrices]
                .sort((a, b) => a.price - b.price);
            const position = allPrices.findIndex(p => p.provider === "metro") + 1;
            posEl.textContent = `#${position} of ${allPrices.length}`;
            posEl.style.color = position === 1 ? "var(--green)" : position <= 2 ? "var(--amber)" : "var(--red)";
            posDetail.textContent = position === 1
                ? "Cheapest in market"
                : `${formatGBP(myPrice)}/wk vs cheapest ${formatGBP(allPrices[0].price)}/wk`;

            const compAvg = competitorPrices.reduce((s, p) => s + p.price, 0) / competitorPrices.length;
            avgEl.textContent = formatGBP(compAvg);
            const diff = myPrice - compAvg;
            const pctDiff = ((diff / compAvg) * 100).toFixed(0);
            if (diff < 0) {
                detailEl.textContent = `You're ${formatGBP(Math.abs(diff))} below avg (${Math.abs(pctDiff)}% cheaper)`;
                detailEl.style.color = "var(--green)";
            } else {
                detailEl.textContent = `You're ${formatGBP(diff)} above avg (${pctDiff}% pricier)`;
                detailEl.style.color = "var(--red)";
            }
        } else {
            posEl.textContent = "—";
            posEl.style.color = "var(--text-muted)";
            posDetail.textContent = hasNum(myPrice) ? "No competitor prices yet" : "Awaiting your price";
            avgEl.textContent = competitorPrices.length ? formatGBP(competitorPrices.reduce((s, p) => s + p.price, 0) / competitorPrices.length) : "—";
            detailEl.textContent = competitorPrices.length ? `${competitorPrices.length} competitor price(s) on record` : "No price data yet";
            detailEl.style.color = "var(--text-muted)";
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

        // Check if any competitor is now cheaper than you (both prices must exist)
        const myP = CURRENT_PRICES.metro ? CURRENT_PRICES.metro[selectedSize] : undefined;
        if (typeof myP === "number") {
            Object.entries(CURRENT_PRICES).forEach(([key, prices]) => {
                if (key === "metro") return;
                const p = prices[selectedSize];
                if (typeof p === "number" && p < myP) {
                    alerts.push(
                        `<strong>${PROVIDERS[key].name}</strong> is cheaper than you at ${selectedSize}sqft ` +
                        `(${formatGBP(p)}/wk vs your ${formatGBP(myP)}/wk)`
                    );
                }
            });
        }

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
        const has = v => typeof v === "number" && !isNaN(v);
        const myPrice = CURRENT_PRICES.metro ? CURRENT_PRICES.metro[size] : undefined;
        const dash = '<span class="price-muted">—</span>';
        const rows = Object.entries(CURRENT_PRICES)
            .map(([key, prices]) => {
                const price = prices[size];
                const provider = PROVIDERS[key];
                const deal = CURRENT_DEALS[key];
                const hasP = has(price);

                let effectiveWeekly = hasP
                    ? (deal && deal.active && deal.discountPct > 0 ? price * (1 - deal.discountPct / 100) : price)
                    : null;

                let vsYou = "", vsClass = "";
                if (!provider.isYou) {
                    if (hasP && has(myPrice)) {
                        const diff = price - myPrice;
                        const pct = ((diff / myPrice) * 100).toFixed(0);
                        if (diff > 0) { vsYou = `+${formatGBP(diff)} (+${pct}%)`; vsClass = "pricier"; }
                        else if (diff < 0) { vsYou = `${formatGBP(diff)} (${pct}%)`; vsClass = "cheaper"; }
                        else { vsYou = "Same"; vsClass = "price-same"; }
                    } else {
                        vsYou = "n/a"; vsClass = "price-muted";
                    }
                }

                return {
                    key,
                    name: provider.name + (provider.isYou ? " (You)" : ""),
                    isYou: provider.isYou,
                    hasP,
                    price: hasP ? formatGBP(price) : dash,
                    fourWeekly: hasP ? formatGBP(price * 4) : dash,
                    perSqft: hasP ? formatGBP(price / size) : dash,
                    deal: deal && deal.active ? deal.text : "—",
                    dealActive: deal && deal.active,
                    effectiveWeekly: effectiveWeekly != null ? `${formatGBP(effectiveWeekly)}/wk` : dash,
                    vsYou, vsClass,
                    sortKey: hasP ? price : Infinity
                };
            })
            .sort((a, b) => a.sortKey - b.sortKey);

        const tbody = document.getElementById("price-table-body");
        tbody.innerHTML = rows.map(r => `
            <tr class="${r.isYou ? "is-you" : ""}">
                <td>${r.name}</td>
                <td>${r.price}</td>
                <td>${r.fourWeekly}</td>
                <td>${r.perSqft}</td>
                <td>${r.dealActive ? `<span class="deal-badge">${r.deal}</span>` : r.deal}</td>
                <td>${r.effectiveWeekly}</td>
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

    // --- Insurance & Upfront Fees ---
    // Weekly insurance cost for a given cover level, per a provider's insurance model.
    // Returns {known, weekly, included, approx, aboveLadder}; known=false => quote-only.
    function insWeeklyForCover(ins, cover) {
        if (!ins) return { known: false };
        if (ins.model === "included") return { known: true, weekly: 0, included: true };
        if (cover == null) {  // no target cover -> fall back to a provider's published entry
            return (ins.entryWeekly === 0 || ins.entryWeekly)
                ? { known: true, weekly: ins.entryWeekly, approx: ins.model === "rate" }
                : { known: false };
        }
        if (ins.model === "tiered" && ins.tiers && ins.tiers.length) {
            const tier = ins.tiers.find(t => t.coverGBP >= cover);
            if (!tier) return { known: false, aboveLadder: true };   // higher tiers quote-only
            const wk = tier.period === "month" ? tier.costGBP * 12 / 52 : tier.costGBP;
            return { known: true, weekly: +wk.toFixed(2), approx: tier.period === "month" };
        }
        if (ins.model === "rate" && ins.ratePer1000) {
            const billCover = Math.max(cover, ins.minCoverGBP || 0);
            const per = ins.ratePeriod === "month" ? 12 / 52 : 1;
            const wk = ins.ratePer1000 * (billCover / 1000) * per;
            return { known: true, weekly: +wk.toFixed(2), approx: true };
        }
        return { known: false };   // quote-only / unknown
    }

    function renderInsuranceFees() {
        if (typeof INSURANCE === "undefined" || typeof ADMIN_FEES === "undefined") return;
        const size = selectedSize;
        // Cover Metro includes free at this size = the cover competitors must match.
        const targetCover = (INSURANCE.metro && INSURANCE.metro.coverBySize)
            ? INSURANCE.metro.coverBySize[size] : null;
        const myRent = CURRENT_PRICES.metro ? CURRENT_PRICES.metro[size] : null;
        const myAllIn = myRent != null ? myRent : null;   // Metro insurance is included (£0)

        // Headline cover note for this size
        const coverNote = document.getElementById("fees-cover-note");
        if (coverNote) {
            coverNote.innerHTML = targetCover
                ? `At <strong>${size} sqft</strong>, Metro includes <strong>£${(targetCover / 1000).toFixed(targetCover % 1000 ? 1 : 0)}k</strong> of cover free. The Insurance column shows what each competitor would charge to match that cover, <em>added on top of rent</em>.`
                : `Insurance is mandatory everywhere. The Insurance column shows each provider's cover cost added on top of rent.`;
        }

        const rows = Object.keys(PROVIDERS).map(key => {
            const provider = PROVIDERS[key];
            const ins = INSURANCE[key] || {};
            const fee = ADMIN_FEES[key] || {};
            const rent = CURRENT_PRICES[key] ? CURRENT_PRICES[key][size] : null;
            const cov = insWeeklyForCover(ins, targetCover);
            const insWeekly = cov.known ? cov.weekly : null;
            const allIn = (rent != null && insWeekly != null) ? rent + insWeekly : null;

            // Insurance cell (cover-matched to Metro's included cover for this size)
            let insCell, insSub = "";
            if (cov.included) {
                insCell = '<span class="cheaper">Free (incl.)</span>';
                insSub = targetCover ? `£${(targetCover / 1000).toFixed(targetCover % 1000 ? 1 : 0)}k cover incl.` : "included";
            } else if (cov.known) {
                insCell = `${cov.approx ? "≈ " : ""}${formatGBP(insWeekly)}/wk`;
                insSub = "added on top";
            } else {
                insCell = '<span class="quote-only">Quote only</span>';
                if (cov.aboveLadder) insSub = "above published tiers";
            }

            // Upfront fees cell
            let feeCell;
            if (fee.totalUpfront === 0) {
                feeCell = "None";
            } else if (fee.totalUpfront != null) {
                const paid = (fee.items || [])
                    .filter(i => i.oneOff && i.amountGBP > 0)
                    .map(i => `${formatGBP(i.amountGBP)} ${i.label.toLowerCase()}`);
                feeCell = paid.length ? paid.join(", ") : formatGBP(fee.totalUpfront);
            } else {
                feeCell = '<span class="quote-only">Quote only</span>';
            }

            // vs You (all-in basis: rent + cover-matched insurance)
            let vsYou = "", vsClass = "";
            if (!provider.isYou) {
                if (allIn == null || myAllIn == null) {
                    vsYou = "n/a"; vsClass = "price-muted";
                } else {
                    const diff = allIn - myAllIn;
                    const pct = ((diff / myAllIn) * 100).toFixed(0);
                    if (diff > 0) { vsYou = `+${formatGBP(diff)} (+${pct}%)`; vsClass = "pricier"; }
                    else if (diff < 0) { vsYou = `${formatGBP(diff)} (${pct}%)`; vsClass = "cheaper"; }
                    else { vsYou = "Same"; vsClass = "price-same"; }
                }
            }

            return {
                key, name: provider.name + (provider.isYou ? " (You)" : ""), isYou: provider.isYou,
                insCell, insSub, brand: ins.brand || "—", mandatory: ins.mandatory,
                feeCell, feeNote: fee.note || "", insNote: ins.note || "",
                rent, allIn, vsYou, vsClass, conf: ins.confidence || "low",
                sortKey: allIn != null ? allIn : Infinity
            };
        }).sort((a, b) => a.sortKey - b.sortKey);

        const confDot = c => `<span class="conf-dot conf-${c}" title="${c} confidence"></span>`;
        document.getElementById("fees-table-body").innerHTML = rows.map(r => `
            <tr class="${r.isYou ? "is-you" : ""}">
                <td>${r.name} ${confDot(r.conf)}</td>
                <td title="${escapeAttr(r.insNote)}">${r.insCell}${r.insSub ? `<div class="cell-sub">${r.insSub}</div>` : ""}</td>
                <td>${r.brand}${r.mandatory ? ' <span class="tag-mandatory">mandatory</span>' : ""}</td>
                <td title="${escapeAttr(r.feeNote)}">${r.feeCell}</td>
                <td>${r.rent != null ? formatGBP(r.rent) : "—"}</td>
                <td>${r.allIn != null ? `<strong>${formatGBP(r.allIn)}</strong>` : '<span class="price-muted">—</span>'}</td>
                <td class="${r.vsClass}">${r.isYou ? "—" : r.vsYou}</td>
            </tr>
        `).join("");

        // Insurance tier ladder (where published)
        const tierHtml = Object.keys(PROVIDERS).map(key => {
            const ins = INSURANCE[key];
            if (!ins) return "";
            let body;
            if (ins.model === "included") {
                const scale = ins.coverBySize
                    ? Object.entries(ins.coverBySize).map(([s, c]) => `${s}sqft → £${(c / 1000).toFixed(c % 1000 ? 1 : 0)}k`).join(" &middot; ")
                    : "scales with unit size";
                body = `<span class="cheaper">Included free</span>, cover by size: ${scale}; excess £4 per £1,000 / 4wks`;
            } else if (ins.tiers && ins.tiers.length) {
                body = ins.tiers.map(t => {
                    const per = t.period === "month" ? "/mo" : "/wk";
                    return `£${(t.coverGBP / 1000).toFixed(0)}k cover &rarr; <strong>${formatGBP(t.costGBP)}</strong>${per}${t.derived ? " <span class=\"price-muted\">(derived)</span>" : ""}`;
                }).join(" &nbsp;&middot;&nbsp; ") + (ins.published === "partial" ? ' &nbsp;&middot;&nbsp; <span class="price-muted">higher tiers quote-only</span>' : "");
            } else {
                body = '<span class="quote-only">Not published &mdash; quote only</span>';
            }
            return `<div class="tier-row">
                <div><span class="tier-prov" style="color:${PROVIDERS[key].color}">${PROVIDERS[key].shortName}</span>
                <span class="tier-brand">${ins.brand || ""}</span></div>
                <div class="tier-body">${body}</div></div>`;
        }).join("");
        document.getElementById("insurance-tiers").innerHTML =
            `<h3 class="tiers-h">Insurance tiers by cover value <span class="unit-label">(where published)</span></h3>${tierHtml}`;

        // Provenance
        const researched = INSURANCE.metro && INSURANCE.metro.lastResearched;
        document.getElementById("fees-provenance").innerHTML =
            `<strong style="color:var(--text)">About this data:</strong> Insurance &amp; fee figures researched manually from each provider's own pages` +
            `${researched ? ` (${formatDate(researched)})` : ""}, not auto-scraped &mdash; preserved across scraper runs. ` +
            `Confidence: <span class="conf-dot conf-high"></span> confirmed &nbsp; <span class="conf-dot conf-medium"></span> partial / derived &nbsp; <span class="conf-dot conf-low"></span> unpublished (quote-only). ` +
            `Contents protection is mandatory everywhere, but most operators only disclose exact tiers on a personalised quote. Hover a cell for the source note.`;
    }

    function escapeAttr(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    }

    // --- Manual Price Overrides (namespaced per site) ---
    const OVERRIDES_KEY = "storage_monitor_overrides";
    function overridesKey() { return `${OVERRIDES_KEY}:${ACTIVE_SITE}`; }

    function getOverrides() {
        try { return JSON.parse(localStorage.getItem(overridesKey())) || {}; } catch { return {}; }
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

    function refreshManualProviders() {
        const select = document.getElementById("manual-provider");
        if (!select) return;
        select.innerHTML = Object.entries(PROVIDERS)
            .map(([key, p]) => `<option value="${key}">${p.name}${p.isYou ? " (You)" : ""}</option>`).join("");
        renderOverridesList();
    }

    function setupManualEntry() {
        refreshManualProviders();

        document.getElementById("manual-save-btn").addEventListener("click", () => {
            const provider = document.getElementById("manual-provider").value;
            const size = document.getElementById("manual-size").value;
            const price = parseFloat(document.getElementById("manual-price").value);
            if (!price || price <= 0) return;

            const overrides = getOverrides();
            if (!overrides[provider]) overrides[provider] = {};
            overrides[provider][size] = price;
            localStorage.setItem(overridesKey(), JSON.stringify(overrides));

            document.getElementById("manual-price").value = "";
            applyOverrides();
            renderAll();
        });

        document.getElementById("manual-clear-btn").addEventListener("click", () => {
            localStorage.removeItem(overridesKey());  // clears overrides for the active site only
            location.reload();
        });
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

    // --- Overview (all sites) ---
    function setupOverviewSizeButtons() {
        document.querySelectorAll("#ov-size-buttons .size-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#ov-size-buttons .size-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                ovSize = parseInt(btn.dataset.size);
                renderOverview();
            });
        });
    }

    // Site prices with that site's manual overrides overlaid (overview reads sites
    // directly, not via the active globals).
    function effectiveSitePrices(key) {
        const base = (SITES[key] && SITES[key].currentPrices) || {};
        const out = {};
        for (const pk in base) out[pk] = Object.assign({}, base[pk]);
        try {
            const ov = JSON.parse(localStorage.getItem(`${OVERRIDES_KEY}:${key}`)) || {};
            for (const pk in ov) { out[pk] = out[pk] || {}; for (const s in ov[pk]) out[pk][parseInt(s)] = ov[pk][s]; }
        } catch (e) { /* ignore */ }
        return out;
    }

    function renderOverview() {
        const grid = document.getElementById("ov-grid");
        if (!grid || typeof SITES === "undefined") return;
        const size = ovSize;
        const hasNum = v => typeof v === "number" && !isNaN(v);

        grid.innerHTML = Object.entries(SITES).map(([key, site]) => {
            const prices = effectiveSitePrices(key);
            const ins = site.insurance || {};
            const providers = site.providers || {};
            const metroP = prices.metro ? prices.metro[size] : undefined;

            const comps = Object.keys(providers).filter(k => k !== "metro");
            const compPriced = comps.map(k => ({ k, p: prices[k] ? prices[k][size] : undefined }))
                .filter(x => hasNum(x.p));
            const known = compPriced.length, total = comps.length;
            const avg = known ? compPriced.reduce((s, x) => s + x.p, 0) / known : null;

            // --- Insurance-adjusted "all-in" calibration ---
            // Metro bundles cover free, so its all-in == rent. For competitors, add what
            // they'd charge to match Metro's cover at this size (only where that's known).
            const cover = (ins.metro && ins.metro.coverBySize) ? ins.metro.coverBySize[size] : null;
            const compAllIn = compPriced.map(x => {
                const iw = insWeeklyForCover(ins[x.k], cover);
                return iw.known ? { k: x.k, p: x.p + iw.weekly } : null;
            }).filter(Boolean);
            const allInKnown = compAllIn.length;
            const allInAvg = allInKnown ? compAllIn.reduce((s, x) => s + x.p, 0) / allInKnown : null;
            const metroAllIn = hasNum(metroP) ? metroP : null;  // insurance free => all-in == rent

            // Headline rank: prefer insurance-adjusted (all-in); fall back to rent-only.
            let posHtml = '<span class="ov-pos na">no price data</span>';
            if (metroAllIn != null && allInKnown) {
                const all = [{ k: "metro", p: metroAllIn }, ...compAllIn].sort((a, b) => a.p - b.p);
                const pos = all.findIndex(x => x.k === "metro") + 1;
                const cls = pos === 1 ? "good" : pos <= 2 ? "mid" : "bad";
                posHtml = `<span class="ov-pos ${cls}" title="Rank once Metro's free insurance is included on every quote">#${pos} of ${all.length} all-in</span>`;
            } else if (hasNum(metroP) && known) {
                const all = [{ k: "metro", p: metroP }, ...compPriced].sort((a, b) => a.p - b.p);
                const pos = all.findIndex(x => x.k === "metro") + 1;
                const cls = pos === 1 ? "good" : pos <= 2 ? "mid" : "bad";
                posHtml = `<span class="ov-pos ${cls}">#${pos} of ${all.length} on rent</span>`;
            } else if (hasNum(metroP)) {
                posHtml = '<span class="ov-pos na">competitors quote-only</span>';
            }

            // vs all-in market average (insurance-adjusted) — the corrected comparison
            let allInVal = '<span class="val muted">&mdash;</span>', allInSub = "insurance quote-only";
            if (allInAvg != null) {
                allInSub = `avg of ${allInKnown}/${total} all-in`;
                if (metroAllIn != null) {
                    const diff = metroAllIn - allInAvg;
                    const cls = diff < 0 ? "cheaper" : diff > 0 ? "pricier" : "";
                    const word = diff < 0 ? "below" : "above";
                    allInVal = `<span class="val ${cls}">${formatGBP(allInAvg)}</span>`;
                    allInSub = `you ${formatGBP(Math.abs(diff))} ${word} (${allInKnown}/${total})`;
                } else {
                    allInVal = `<span class="val">${formatGBP(allInAvg)}</span>`;
                }
            }

            // vs rent-only market average (kept for contrast with the all-in figure)
            let avgVal = '<span class="val muted">&mdash;</span>', avgSub = "competitors quote-only";
            if (avg != null) {
                avgSub = `avg of ${known}/${total} priced`;
                if (hasNum(metroP)) {
                    const diff = metroP - avg;
                    const cls = diff < 0 ? "cheaper" : diff > 0 ? "pricier" : "";
                    const word = diff < 0 ? "below" : "above";
                    avgVal = `<span class="val ${cls}">${formatGBP(avg)}</span>`;
                    avgSub = `you ${formatGBP(Math.abs(diff))} ${word} (${known}/${total} priced)`;
                } else {
                    avgVal = `<span class="val">${formatGBP(avg)}</span>`;
                }
            }

            const coverLbl = cover ? `£${(cover / 1000).toFixed(cover % 1000 ? 1 : 0)}k` : null;
            const insLine = cover
                ? `Insurance: <strong>Free</strong> &mdash; ${coverLbl} cover included at ${size} sqft. Competitors add it on top.`
                : `Insurance bundled <strong>free</strong>; competitors add it on top.`;

            return `
            <div class="ov-card" data-site="${key}">
                <div class="ov-card-head">
                    <div>
                        <div class="ov-site-name">${site.label}</div>
                        <div class="ov-site-loc">${site.locationBadge || ""} &middot; ${providers.metro ? providers.metro.name : "Metro"}</div>
                    </div>
                    ${posHtml}
                </div>
                <div class="ov-yourprice">
                    <span class="v">${hasNum(metroP) ? formatGBP(metroP) : "TBD"}</span>
                    <span class="l">your all-in / wk &middot; ${size} sqft &middot; insurance incl.</span>
                </div>
                <div class="ov-stats">
                    <div class="ov-stat"><span class="k">All-in avg</span>${allInVal}<span class="k" style="text-transform:none">${allInSub}</span></div>
                    <div class="ov-stat"><span class="k">Rent-only avg</span>${avgVal}<span class="k" style="text-transform:none">${avgSub}</span></div>
                    <div class="ov-stat"><span class="k">Competitors</span><span class="val">${total}</span><span class="k" style="text-transform:none">${known} priced, ${total - known} quote-only</span></div>
                    <div class="ov-stat"><span class="k">Your insurance</span><span class="val cheaper">Free</span><span class="k" style="text-transform:none">${coverLbl ? coverLbl + " incl." : "included"}</span></div>
                </div>
                <div class="ov-ins">${insLine}</div>
                <div class="ov-cta">View site detail &rarr;</div>
            </div>`;
        }).join("");
    }

    // --- Update button (triggers the GitHub Actions scraper) ---
    const GH_OWNER = "Axiom-Projects";
    const GH_REPO = "storage-monitor";
    const GH_WORKFLOW = "scrape.yml";
    const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;
    const TOKEN_KEY = "storage_monitor_gh_token";
    const RUN_KEY = "storage_monitor_update_run";   // {startedAt, runId?} while an update is in flight
    let updateTimer = null;

    function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }

    function ghFetch(path, opts = {}) {
        return fetch(GH_API + path, {
            ...opts,
            headers: {
                "Authorization": "Bearer " + getToken(),
                "Accept": "application/vnd.github+json",
                ...(opts.headers || {})
            }
        });
    }

    function getPendingRun() {
        try { return JSON.parse(localStorage.getItem(RUN_KEY)); } catch { return null; }
    }

    function setUpdateUI(state, label) {
        ["update-btn", "ov-update-btn"].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.remove("updating", "update-error");
            if (state === "updating") {
                btn.classList.add("updating");
                btn.disabled = true;
                btn.textContent = label;
            } else if (state === "error") {
                btn.classList.add("update-error");
                btn.disabled = false;
                btn.textContent = "Update failed - retry";
                btn.title = label || "The scrape run failed. Click to try again.";
            } else {
                btn.disabled = false;
                btn.textContent = "Update prices";
                btn.title = "Run the price scraper now (takes ~20 min)";
            }
        });
    }

    function elapsedLabel(startedAt) {
        const mins = Math.max(0, Math.round((Date.now() - new Date(startedAt)) / 60000));
        return `Updating… ${mins} min`;
    }

    function updateFailed(message) {
        localStorage.removeItem(RUN_KEY);
        clearTimeout(updateTimer);
        setUpdateUI("error", message);
    }

    function setupUpdater() {
        ["update-btn", "ov-update-btn"].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener("click", handleUpdateClick);
        });

        const modal = document.getElementById("update-modal");
        document.getElementById("gh-token-cancel").addEventListener("click", () => {
            modal.style.display = "none";
        });
        document.getElementById("gh-token-save").addEventListener("click", saveTokenAndStart);
        document.getElementById("gh-token-input").addEventListener("keydown", e => {
            if (e.key === "Enter") saveTokenAndStart();
        });

        // An update kicked off earlier (possibly before a page reload) - resume watching it.
        const pending = getPendingRun();
        if (pending && Date.now() - new Date(pending.startedAt) < 2 * 3600000) {
            setUpdateUI("updating", elapsedLabel(pending.startedAt));
            watchUpdate(pending);
        } else if (pending) {
            localStorage.removeItem(RUN_KEY);
        }
    }

    function handleUpdateClick() {
        if (getPendingRun()) return;
        if (!getToken()) {
            openTokenModal("");
        } else {
            startUpdate();
        }
    }

    function openTokenModal(errorMsg) {
        const err = document.getElementById("update-modal-error");
        err.textContent = errorMsg;
        err.style.display = errorMsg ? "block" : "none";
        document.getElementById("update-modal").style.display = "flex";
        document.getElementById("gh-token-input").focus();
    }

    async function saveTokenAndStart() {
        const input = document.getElementById("gh-token-input");
        const token = input.value.trim();
        if (!token) return;
        localStorage.setItem(TOKEN_KEY, token);
        // Validate before accepting: can this token see the workflow?
        try {
            const res = await ghFetch(`/actions/workflows/${GH_WORKFLOW}`);
            if (!res.ok) {
                localStorage.removeItem(TOKEN_KEY);
                openTokenModal(res.status === 401
                    ? "GitHub rejected that token. Check it was copied in full."
                    : `Token can't access the workflow (HTTP ${res.status}). Check the repository and Actions permissions.`);
                return;
            }
        } catch (e) {
            localStorage.removeItem(TOKEN_KEY);
            openTokenModal("Couldn't reach GitHub - check your connection and try again.");
            return;
        }
        input.value = "";
        document.getElementById("update-modal").style.display = "none";
        startUpdate();
    }

    async function startUpdate() {
        setUpdateUI("updating", "Starting…");
        let res;
        try {
            res = await ghFetch(`/actions/workflows/${GH_WORKFLOW}/dispatches`, {
                method: "POST",
                body: JSON.stringify({ ref: "main" })
            });
        } catch (e) {
            setUpdateUI("error", "Couldn't reach GitHub - check your connection.");
            return;
        }
        if (res.status === 401 || res.status === 403 || res.status === 404) {
            localStorage.removeItem(TOKEN_KEY);
            setUpdateUI("idle");
            openTokenModal("GitHub rejected the saved token (it may have expired or lack Actions write access). Paste a new one.");
            return;
        }
        if (!res.ok) {
            setUpdateUI("error", `GitHub returned HTTP ${res.status} when starting the scrape.`);
            return;
        }
        const pending = { startedAt: new Date().toISOString() };
        localStorage.setItem(RUN_KEY, JSON.stringify(pending));
        setUpdateUI("updating", elapsedLabel(pending.startedAt));
        watchUpdate(pending);
    }

    // Poll the run until it finishes, then poll data.js until GitHub Pages serves the
    // new data, then reload. State lives in localStorage so a page reload resumes it.
    function watchUpdate(pending) {
        const baseline = (typeof DATA_META !== "undefined" && DATA_META.lastScraped) || "";
        const deadline = new Date(pending.startedAt).getTime() + 2 * 3600000;

        async function tick() {
            if (Date.now() > deadline) {
                updateFailed("The update didn't finish within 2 hours - check the Actions tab on GitHub.");
                return;
            }
            try {
                if (!pending.runId) {
                    // Dispatch returns no run id; find the run it created.
                    const res = await ghFetch(`/actions/workflows/${GH_WORKFLOW}/runs?event=workflow_dispatch&per_page=5`);
                    if (res.ok) {
                        const cutoff = new Date(pending.startedAt).getTime() - 60000;
                        const run = (await res.json()).workflow_runs
                            .find(r => new Date(r.created_at).getTime() >= cutoff);
                        if (run) {
                            pending.runId = run.id;
                            localStorage.setItem(RUN_KEY, JSON.stringify(pending));
                        }
                    }
                } else if (!pending.runDone) {
                    const res = await ghFetch(`/actions/runs/${pending.runId}`);
                    if (res.ok) {
                        const run = await res.json();
                        if (run.status === "completed") {
                            if (run.conclusion !== "success") {
                                updateFailed(`The scrape run ${run.conclusion} - check the Actions tab on GitHub.`);
                                return;
                            }
                            pending.runDone = true;
                            localStorage.setItem(RUN_KEY, JSON.stringify(pending));
                        }
                    }
                } else {
                    // Run succeeded; wait for Pages to serve the freshly committed data.js.
                    // cache:"reload" also refreshes the HTTP cache so the reload below picks it up.
                    const res = await fetch("data.js", { cache: "reload" });
                    if (res.ok) {
                        const dates = [...(await res.text()).matchAll(/"lastScraped":\s*"([^"]+)"/g)].map(m => m[1]);
                        const newest = dates.sort().pop() || "";
                        if (newest > baseline) {
                            localStorage.removeItem(RUN_KEY);
                            location.reload();
                            return;
                        }
                    }
                }
            } catch (e) { /* transient network error - keep polling */ }
            setUpdateUI("updating", elapsedLabel(pending.startedAt));
            updateTimer = setTimeout(tick, 30000);
        }
        tick();
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
