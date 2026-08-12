(function (window) {
    'use strict';

    // constants
    const DEFAULT_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    const DEFAULTS = {
        api_key: '',
        provider: 'finnhub',
        sync_timer_seconds: 60,
        type_style: 'horizontal',
        tickers: DEFAULT_TICKERS,
        style: {
            background: 'oklch(13% 0.028 261.692)',
            color_up: 'oklch(79.2% 0.209 151.711)',
            color_down: 'oklch(63.7% 0.237 25.331)',
            color_text: 'oklch(98.4% 0.003 247.858)',
            color_alert: 'oklch(79.5% 0.184 86.047)',
            velocity: 60
        }
    };

    // app state
    let currentConfig = null;
    let tickerSearchResults = null;

    // main entrypoint
    function startOverlay() {
        const track = document.querySelector('.marquee-track');
        if (!track) {
            return;
        }

        loadOverlayConfig().then(function (config) {
            currentConfig = config;

            
        });
    }

    // config loader
    function loadOverlayConfig() {
        return fetchConfigJson('config.json').then(function (json) {
            let config = null;
            if (isConfigLike(json)) config = json;

            if (!config && isConfigLike(window.CONFIG)) config = window.CONFIG;

            if (!config) {
                return loadConfigScript('config.js').then(function () {
                    if (isConfigLike(window.CONFIG)) config = window.CONFIG;
                    return normalizeConfig(config);
                });
            }

            return normalizeConfig(config);
        });
    }

    function fetchConfigJson(path) {
        return fetch(path, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) return null;
                return res.json();
            })
            .catch(function () { return null; });
    }

    function loadConfigScript(src) {
        return new Promise(function (resolve) {
            var script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
        });
    }

    function isConfigLike(obj) {
        return obj && typeof obj === 'object' && !Array.isArray(obj);
    }

    function normalizeConfig(raw) {
        var cfg = deepMerge(DEFAULTS, isConfigLike(raw) ? raw : {});

        cfg.tickers = (Array.isArray(cfg.tickers) ? cfg.tickers : [])
            .map(function (ticker) { return String(ticker).toUpperCase().trim(); })
            .filter(Boolean);

        if (cfg.tickers.length === 0) {
            cfg.tickers = DEFAULT_TICKERS.slice();
        }

        if (cfg.type_style !== 'vertical') cfg.type_style = 'horizontal';
        cfg.sync_timer_seconds = Math.max(10, Number(cfg.sync_timer_seconds) || 60);
        cfg.style.velocity = Math.max(20, Number(cfg.style.velocity) || 60);

        return cfg;
    }

    function deepMerge(base, override) {
        var result = Array.isArray(base) ? base.slice() : Object.assign({}, base);
        if (!isConfigLike(override)) return result;

        Object.keys(override).forEach(function (key) {
            var value = override[key];
            if (isConfigLike(value) && isConfigLike(result[key])) {
                result[key] = deepMerge(result[key], value);
            } else if (Array.isArray(value)) {
                result[key] = value.slice();
            } else {
                result[key] = value;
            }
        });

        return result;
    }

    // Ticket function
    function ticketHTML(tickerData) {
        if (tickerData.error) {
            return '<div class="ticket"><span class="sym">' + tickerData.symbol + '</span>' +
                '<span class="no-data">SIN DATOS</span>'
        }
        return '<div class="ticket ' + trendClass(tickerData.change) + '">' +
            '<span class="sym">' + tickerData.symbol + '</span>' +
            '<span class="price">' + fmtPrice(tickerData.price) + '</span>' +
            '<span class="chg"><span class="arrow">' + arrow(tickerData.change) + '</span> ' + fmtChange(tickerData.change) + '</span>' +
            '<span class="pct">' + fmtPct(tickerData.changePct) + '</span>' +
            '</div>';
    }

    // utils
    function arrow(c) {
        return c > 0 ? '▲' : (c < 0 ? '▼' : '▬');
    }

    function getOverlayConfig() {
        return currentConfig;
    }

    function fmtPrice(p) {
        return isFinite(p) ? Number(p).toFixed(2) : '--';
    }

    function fmtChange(c) {
        if (!isFinite(c)) return '--';
        return (c >= 0 ? '+' : '') + Number(c).toFixed(2);
    }

    function fmtPct(p) {
        if (!isFinite(p)) return '--';
        return (p >= 0 ? '+' : '') + Number(p).toFixed(2) + '%';
    }

    function trendClass(c) {
        return c > 0 ? 'up' : (c < 0 ? 'down' : 'flat');
    }

    // Finnhub connection + ticker search
    function searchTicker(query) {
        var apiKey = (currentConfig && currentConfig.api_key) || DEFAULTS.api_key;

        return fetch('https://finnhub.io/api/v1/search?q=' + encodeURIComponent(query) + '&token=' + encodeURIComponent(apiKey))
            .then(function (res) {
                if (!res.ok) throw new Error('Finnhub search failed with status ' + res.status);
                return res.json();
            })
            .then(function (data) {
                tickerSearchResults = data && data.count ? data : null;
                return tickerSearchResults;
            })
            .catch(function (err) {
                console.error('searchTicker:', err);
                tickerSearchResults = null;
                return null;
            });
    }

    window.OVApp = {
        getConfig: getOverlayConfig,
        loadConfig: loadOverlayConfig,
        searchTicker: searchTicker,
        start: startOverlay
    };

    document.addEventListener('DOMContentLoaded', startOverlay);
}(window));