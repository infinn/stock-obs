(function (window) {
    'use strict';

    // constants
    const DEFAULT_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    const DEFAULTS = {
        api_key: '',
        provider: 'finnhub',
        sync_timer_seconds: 60,
        type_style: 'horizontal',
        background_style: 'solid',
        typografy_size: 20,
        tickers: DEFAULT_TICKERS,
        style: {
            background: '#030712',
            color_up: '#06df72',
            color_down: '#fb2c36',
            color_text: '#f8fafc',
            color_alert: '#f0b100',
            velocity: 60
        }
    };

    // app state
    let currentConfig = null;

    // main entrypoint
    function startOverlay() {
        const track = document.querySelector('.marquee-track');
        if (!track) {
            return;
        }

        loadOverlayConfig().then(function (config) {
            currentConfig = config;

            applyStyles(currentConfig);

            if (!currentConfig || !currentConfig.api_key || !currentConfig.api_key.trim()) {
                showNoApiKey(track);
                return;
            }

            if (Array.isArray(currentConfig.tickers) && currentConfig.tickers.length > 0) {
                syncTickers();
                setInterval(syncTickers, currentConfig.sync_timer_seconds * 1000);
            }
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
        if (cfg.background_style !== 'transparent') cfg.background_style = 'solid';
        cfg.typografy_size = clampNumber(cfg.typografy_size, 10, 200, DEFAULTS.typografy_size);
        cfg.style = normalizeStyle(cfg.style);

        return cfg;
    }

    // style verification (colors, background, typography size, velocity)
    function normalizeStyle(style) {
        var out = deepMerge(DEFAULTS.style, isConfigLike(style) ? style : {});

        ['background', 'color_up', 'color_down', 'color_text', 'color_alert'].forEach(function (key) {
            if (typeof out[key] !== 'string' || !out[key].trim()) {
                out[key] = DEFAULTS.style[key];
            } else {
                out[key] = out[key].trim();
            }
        });

        out.velocity = clampNumber(out.velocity, 20, 300, DEFAULTS.style.velocity);

        return out;
    }

    function clampNumber(value, min, max, fallback) {
        var n = Number(value);
        if (!isFinite(n)) n = fallback;
        return Math.min(max, Math.max(min, n));
    }

    // applies verified styles to the overlay
    function applyStyles(config) {
        if (!config || !config.style) return;

        var style = config.style;
        var root = document.documentElement;

        root.style.setProperty('--green', style.color_up);
        root.style.setProperty('--red', style.color_down);
        root.style.setProperty('--white', style.color_text);
        root.style.setProperty('--orange', style.color_alert);
        root.style.setProperty('--black', config.background_style === 'transparent' ? 'transparent' : style.background);
        root.style.setProperty('--marquee-duration', style.velocity + 's');

        document.body.style.fontSize = config.typografy_size + 'px';
    }

    // shows "NO API KEY" and stops the marquee animation
    function showNoApiKey(track) {
        track.classList.add('no-animation');
        track.innerHTML = '<div class="marquee-group"><div class="ticket no-api-key">NO API KEY, ADD IN CONFIG.JSON</div></div>';
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
                '<span class="no-data">SIN DATOS</span></div>';
        }
        return '<div class="ticket ' + trendClass(tickerData.change) + '" id="ticket">' +
            '<span class="sym"> ' + tickerData.symbol + '</span>' +
            '<span class="price">' + fmtPrice(tickerData.price) + '</span>' +
            '<span class="chg"><span class="arrow">' + arrow(tickerData.change) +
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

    // Ticker data providers
    function fetchQuote(ticker) {
        var cfg = currentConfig || DEFAULTS;
        var apiKey = (cfg.api_key || DEFAULTS.api_key).trim();
        var provider = String(cfg.provider || 'finnhub').toLowerCase();

        if (provider === 'twelve_data') {
            return fetch('https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(ticker) +
                '&apikey=' + encodeURIComponent(apiKey), { cache: 'no-store' })
                .then(function (res) { return res.json(); })
                .then(function (d) {
                    if (d && d.status === 'error') throw new Error((d.message || 'TwelveData') + ' (' + ticker + ')');
                    var close = Number(d && d.close);
                    var prev = Number(d && d.previous_close);
                    if (!isFinite(close) || !isFinite(prev)) throw new Error('TwelveData: sin datos para ' + ticker);
                    return {
                        symbol: ticker,
                        price: close,
                        change: close - prev,
                        changePct: (close - prev) / prev * 100
                    };
                });
        }

        return fetch('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(ticker) +
            '&token=' + encodeURIComponent(apiKey), { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('Finnhub HTTP ' + res.status);
                return res.json();
            })
            .then(function (d) {
                if (d.c === undefined || d.c === null) throw new Error('Finnhub: sin datos para ' + ticker);
                return {
                    symbol: ticker,
                    price: d.c,
                    change: d.d,
                    changePct: d.dp
                };
            });
    }

    // Ticker sync loop (fetches a quote for every ticker)
    function syncTickers() {
        var tickets = document.querySelectorAll('.marquee-track .ticket');
        if (!tickets.length || !currentConfig) {
            return;
        }

        var items = [];
        var chain = Promise.resolve();

        currentConfig.tickers.forEach(function (ticker) {
            chain = chain.then(function () {
                return fetchQuote(ticker);
            }).then(function (quote) {
                items.push(quote);
            }).catch(function (err) {
                console.error('fetchQuote:', err);
                items.push({ symbol: ticker, error: true });
            });
        });

        chain.then(function () {
            var html = items.map(ticketHTML).join('');

            tickets.forEach(function (ticket) {
                ticket.innerHTML = html;
            });
        });
    }

    window.OVApp = {
        getConfig: getOverlayConfig,
        loadConfig: loadOverlayConfig,
        fetchQuote: fetchQuote,
        syncTickers: syncTickers,
        start: startOverlay
    };

    document.addEventListener('DOMContentLoaded', startOverlay);
}(window));