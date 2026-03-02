/* ===================================================================
 *  ApvGuessr – Auto Location / Auto Pin / Auto Guess
 *  Robust coordinate extraction from Google StreetView metadata
 *  and GeoGuessr API responses with automatic gameplay.
 * =================================================================== */

let lat = 999;
let long = 999;
let strCoord = null;
let lastPlacedCoords = null;

// ─── Utilities ─────────────────────────────────────────────────────

function convertToMinutes(d) { return Math.floor(d * 60); }
function convertToSeconds(d) { return (d * 3600 % 60).toFixed(1); }
function getLatDir(v) { return v >= 0 ? 'N' : 'S'; }
function getLngDir(v) { return v >= 0 ? 'E' : 'W'; }
function isDecimal(s) { s = String(s); return !isNaN(s) && s.includes('.') && !isNaN(parseFloat(s)); }
function isValidCoord(la, ln) {
    return typeof la === 'number' && typeof ln === 'number' &&
        la >= -90 && la <= 90 && ln >= -180 && ln <= 180 &&
        isDecimal(la) && isDecimal(ln);
}
function stringToBool(s) { return s === 'true' ? true : s === 'false' ? false : null; }

function getRandomOffset() {
    const off = 0.5 + Math.random() * 2;
    return Math.random() < 0.5 ? -off : off;
}

function convertCoords(la, ln) {
    const aLat = Math.abs(la), aLng = Math.abs(ln);
    return Math.floor(aLat) + '°' + convertToMinutes(aLat % 1) + "'" + convertToSeconds(aLat % 1) + '"' + getLatDir(la) +
        '+' + Math.floor(aLng) + '°' + convertToMinutes(aLng % 1) + "'" + convertToSeconds(aLng % 1) + '"' + getLngDir(ln);
}

// ─── Coordinate Extraction ─────────────────────────────────────────

// Known array paths where lat/lng appear in Google SV metadata
const KNOWN_PATHS = [
    [[1,0,5,0,1,0,2], [1,0,5,0,1,0,3]],
    [[1,5,0,1,0,2],   [1,5,0,1,0,3]],
    [[1,0,5,0,8,0,2], [1,0,5,0,8,0,3]],
    [[2,0,5,0,1,0,2], [2,0,5,0,1,0,3]],
    [[2,5,0,1,0,2],   [2,5,0,1,0,3]],
    [[1,0,3,0,2],     [1,0,3,0,3]],
    [[3,0,1,0,2],     [3,0,1,0,3]],
    [[1,0,5,0,2,0,2], [1,0,5,0,2,0,3]],
    [[1,0,5,0,1,0,5,0,2], [1,0,5,0,1,0,5,0,3]],
];

function getDeep(obj, path) {
    let cur = obj;
    for (const k of path) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[k];
    }
    return cur;
}

function extractFromKnownPaths(arr) {
    for (const [latP, lngP] of KNOWN_PATHS) {
        try {
            const la = Number(getDeep(arr, latP));
            const ln = Number(getDeep(arr, lngP));
            if (isValidCoord(la, ln) && la !== 0 && ln !== 0) return { lat: la, lng: ln };
        } catch {}
    }
    return null;
}

// Deep recursive search – looks for [?, ?, lat, lng] pattern
function deepSearch(obj, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 15 || obj == null || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
        if (obj.length >= 4) {
            const la = obj[2], ln = obj[3];
            if (typeof la === 'number' && typeof ln === 'number' &&
                la >= -90 && la <= 90 && ln >= -180 && ln <= 180 &&
                Math.abs(la) > 0.5 && Math.abs(ln) > 0.5 &&
                String(la).includes('.') && String(ln).includes('.')) {
                return { lat: la, lng: ln };
            }
        }
        for (let i = 0; i < obj.length; i++) {
            const r = deepSearch(obj[i], depth + 1);
            if (r) return r;
        }
    }
    return null;
}

// Parse GeoGuessr API JSON responses
function extractFromApiResponse(obj) {
    try {
        // /api/v3/games/{token} → rounds array
        if (obj.rounds && Array.isArray(obj.rounds) && obj.rounds.length) {
            const idx = (typeof obj.round === 'number') ? obj.round - 1 : obj.rounds.length - 1;
            const r = obj.rounds[idx];
            if (r && isValidCoord(r.lat, r.lng)) return { lat: r.lat, lng: r.lng };
        }
        // Direct lat/lng
        if (isValidCoord(obj.lat, obj.lng)) return { lat: obj.lat, lng: obj.lng };
        // streetViewMeta
        if (obj.streetViewMeta && isValidCoord(obj.streetViewMeta.lat, obj.streetViewMeta.lng)) {
            return { lat: obj.streetViewMeta.lat, lng: obj.streetViewMeta.lng };
        }
    } catch {}
    return null;
}

// Main response processor
function processResponse(dataStr) {
    if (typeof dataStr !== 'string' || dataStr.length < 10) return null;
    try {
        // Handle Google's XSSI prefix  )]}'
        const cleaned = dataStr.replace(/^\)\]\}'\s*\n?/, '');
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return extractFromKnownPaths(parsed) || deepSearch(parsed);
        } else if (typeof parsed === 'object' && parsed !== null) {
            return extractFromApiResponse(parsed);
        }
    } catch {}
    return null;
}

// ─── Intercepted Message Handler ───────────────────────────────────

window.addEventListener('message', async function (e) {
    if (!e.data || !e.data.data) return;

    let data = e.data.data;

    // Handle Blob (legacy fallback)
    if (data instanceof Blob) {
        try { data = await data.text(); } catch { return; }
    }

    const coords = processResponse(data);
    if (coords) {
        lat = coords.lat;
        long = coords.lng;
        strCoord = null;
        console.log('[ApvGuessr] 📍 Detected:', lat, long);
        showStatus('📍 ' + lat.toFixed(4) + ', ' + long.toFixed(4));
        onCoordsDetected();
    }
});

// ─── Auto-Play Logic ───────────────────────────────────────────────

function onCoordsDetected() {
    const auto = localStorage.getItem('autoGuess') !== 'false';
    if (!auto) return;

    const key = lat.toFixed(6) + ',' + long.toFixed(6);
    if (lastPlacedCoords === key) return;

    const delay = Math.floor(Math.random() * 2000) + 1500;
    setTimeout(function () {
        if (lastPlacedCoords === key) return;

        const safe = localStorage.getItem('safeMode') === 'true';
        const placed = doAutoPlace(safe);
        if (placed) {
            lastPlacedCoords = key;
            showStatus('📌 Pin set – submitting…');
            const gDelay = Math.floor(Math.random() * 3000) + 1000;
            setTimeout(function () { doAutoGuess(); }, gDelay);
        }
    }, delay);
}

// ─── DOM Finders (resilient selectors) ─────────────────────────────

function findGuessMapCanvas() {
    const sels = [
        '[class*="guess-map_canvasContainer"]',
        '[class*="guess-map_canvas"]',
        '[class*="guess-map"] [class*="canvas"]',
        '[class*="GuessMap"]',
        '[class*="guessMap"]',
    ];
    for (const s of sels) { const el = document.querySelector(s); if (el) return el; }
    return null;
}

function findReactFiber(el) {
    if (!el) return null;
    const key = Object.keys(el).find(function (k) { return k.startsWith('__reactFiber$'); });
    return key ? el[key] : null;
}

function findMarkerCallback(element) {
    let fiber = findReactFiber(element);
    let depth = 0;
    while (fiber && depth < 30) {
        const p = fiber.memoizedProps;
        if (p) {
            if (typeof p.onMarkerLocationChanged === 'function') return p.onMarkerLocationChanged;
            if (typeof p.onPinLocationChanged === 'function') return p.onPinLocationChanged;
            if (typeof p.onLocationChanged === 'function') return p.onLocationChanged;
        }
        fiber = fiber.return;
        depth++;
    }
    return null;
}

function findGuessButton() {
    const sels = [
        'button[data-qa="perform-guess"]',
        'button[class*="guess-map_guessButton"]',
        'button[class*="GuessButton"]',
        'button[class*="guessButton"]',
    ];
    for (const s of sels) { const el = document.querySelector(s); if (el) return el; }
    // Text-based fallback
    const btns = document.querySelectorAll('button');
    for (let i = 0; i < btns.length; i++) {
        const t = btns[i].textContent.trim().toLowerCase();
        if (t.includes('guess') && !btns[i].disabled) return btns[i];
    }
    return null;
}

// ─── Auto Place & Guess ────────────────────────────────────────────

function doAutoPlace(safeMode) {
    const el = findGuessMapCanvas();
    if (!el) { console.warn('[ApvGuessr] Map canvas not found'); return false; }

    const placeMarker = findMarkerCallback(el);
    if (!placeMarker) { console.warn('[ApvGuessr] Marker callback not found'); return false; }

    let pLat = lat, pLng = long;
    if (safeMode) {
        pLat += getRandomOffset();
        pLng += getRandomOffset();
    }
    placeMarker({ lat: pLat, lng: pLng });
    console.log('[ApvGuessr] 📌 Pin placed:', pLat, pLng);
    return true;
}

function doAutoGuess() {
    const btn = findGuessButton();
    if (!btn) { console.warn('[ApvGuessr] Guess button not found'); return false; }
    humanClick(btn);
    console.log('[ApvGuessr] ✅ Guess submitted');
    showStatus('✅ Guess submitted');
    return true;
}

function humanClick(el) {
    var delay = Math.floor(Math.random() * 100) + 50;
    setTimeout(function () {
        el.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
        setTimeout(function () {
            el.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
        }, delay);
    }, delay);
}

// ─── Reverse Geocoding ─────────────────────────────────────────────

async function getCoordInfo() {
    if (strCoord !== null) return strCoord;
    try {
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + long + '&format=json');
        if (!r.ok) return;
        const d = await r.json();
        return d.address;
    } catch { return; }
}

// ─── Status Overlay ────────────────────────────────────────────────

function showStatus(text, duration) {
    if (!duration) duration = 3000;
    var ov = document.getElementById('apv-status');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'apv-status';
        ov.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(86,59,154,.9);color:#fff;' +
            'padding:10px 18px;border-radius:12px;z-index:99999;font-family:neo-sans,sans-serif;font-size:14px;' +
            'transition:opacity .3s;pointer-events:none;';
        document.body.appendChild(ov);
    }
    ov.textContent = text;
    ov.style.opacity = '1';
    clearTimeout(ov._t);
    ov._t = setTimeout(function () { ov.style.opacity = '0'; }, duration);
}

// ─── UI Setup ──────────────────────────────────────────────────────

window.addEventListener('load', function () {
    if (localStorage.getItem('safeMode') == null) localStorage.setItem('safeMode', 'true');
    if (localStorage.getItem('autoGuess') == null) localStorage.setItem('autoGuess', 'true');

    const pinImg = 'https://raw.githubusercontent.com/realapire/geoguessr-cheat/ui-fix/assets/view.png';
    const viewImg = 'https://raw.githubusercontent.com/realapire/geoguessr-cheat/ui-fix/assets/pin.png';
    const safeImg = 'https://raw.githubusercontent.com/realapire/geoguessr-cheat/ui-safemode-noalert/assets/safe.png';

    // ── Inject control buttons ──
    setInterval(function () {
        // Control buttons
        var col = document.querySelector('[class^="styles_columnTwo__"]');
        if (col && !document.getElementById('apv-tellLocation')) {
            col.appendChild(makeCtrlBtn('apv-tellLocation', pinImg, function () { tellLocation(); }));
            col.appendChild(makeCtrlBtn('apv-autoPlace', viewImg, function () {
                var safe = localStorage.getItem('safeMode') === 'true';
                doAutoPlace(safe);
                setTimeout(function () { doAutoGuess(); }, Math.random() * 2000 + 500);
            }));
        }

        // Settings menu
        var menu = document.querySelector('[class^="game-menu_optionsContainer__"]');
        if (menu && !menu.querySelector('.apv-opt')) {
            menu.appendChild(makeSettingsToggle('safeMode', 'Safe Mode', safeImg));
            menu.appendChild(makeSettingsToggle('autoGuess', 'Auto Guess', safeImg));
        }
    }, 100);

    // ── Reset state on URL change (new round) ──
    var lastUrl = location.href;
    setInterval(function () {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            lastPlacedCoords = null;
        }
    }, 500);
});

// ─── UI Helpers ────────────────────────────────────────────────────

function makeCtrlBtn(id, imgSrc, onClick) {
    var a = document.createElement('a');
    a.href = '#';
    a.id = id;
    a.style.cssText = 'margin-bottom:1rem;position:relative;touch-action:pan-x pan-y;background:rgba(0,0,0,.6);' +
        'border:0;border-bottom:.0625rem solid rgba(0,0,0,.4);cursor:pointer;height:40px;display:flex;' +
        'align-items:center;justify-content:center;width:40px;border-radius:50%;';
    var img = document.createElement('img');
    img.src = imgSrc;
    img.width = 22; img.height = 24;
    img.style.cssText = 'filter:invert(1);position:absolute;';
    a.appendChild(img);
    a.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
    return a;
}

function makeSettingsToggle(key, label, iconSrc) {
    var w = document.createElement('label');
    w.className = 'game-options_option__xQZVa game-options_editableOption__0hL4c apv-opt';
    var inner = '<img src="' + iconSrc + '" width="24" height="24" style="color:transparent;filter:invert(1);">';
    inner += '<div class="game-options_optionLabel__Vk5xN">' + label + '</div>';
    inner += '<div class="game-options_optionInput__paPBZ"><input type="checkbox" class="toggle_toggle__qfXpL apv-toggle-' + key + '"';
    if (localStorage.getItem(key) === 'true') inner += ' checked';
    inner += '></div>';
    w.innerHTML = inner;
    w.querySelector('input').addEventListener('change', function () {
        localStorage.setItem(key, this.checked);
    });
    return w;
}

// ─── Keyboard Shortcuts ────────────────────────────────────────────

document.addEventListener('keydown', async function (event) {
    if (lat === 999 && long === 999) return;
    if (event.ctrlKey && event.code === 'Space' && localStorage.getItem('safeMode') === 'false') {
        doAutoPlace(false);
        setTimeout(function () { doAutoGuess(); }, Math.random() * 2000 + 500);
    }
    if (event.ctrlKey && event.shiftKey && localStorage.getItem('safeMode') === 'false') {
        await tellLocation();
    }
});

// ─── Tell Location Popup ───────────────────────────────────────────

async function tellLocation() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:9998;';

    var popup = document.createElement('div');
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgb(86,59,154);' +
        'padding:20px;border-radius:20px;box-shadow:0 0 10px rgba(0,0,0,.5);z-index:9999;color:#fff;text-align:center;max-width:420px;';

    var title = document.createElement('h2');
    title.style.cssText = 'color:#a19bd9;font-style:italic;font-weight:700;font-family:neo-sans,sans-serif;';
    title.innerText = 'LOCATION';
    popup.appendChild(title);

    var coordText = document.createElement('p');
    coordText.style.cssText = 'font-family:monospace;margin:12px 0;font-size:13px;';
    coordText.innerText = lat.toFixed(6) + ', ' + long.toFixed(6);
    popup.appendChild(coordText);

    var content = document.createElement('div');
    content.style.cssText = 'font-family:neo-sans,sans-serif;padding:0 20px;margin-top:10px;';
    var info = await getCoordInfo();
    if (info) {
        for (var k in info) {
            if (!info.hasOwnProperty(k)) continue;
            var row = document.createElement('p');
            row.style.cssText = 'display:flex;justify-content:flex-start;flex-wrap:wrap;gap:10px;margin:4px 0;';
            var ks = document.createElement('span');
            ks.style.cssText = 'text-align:left;font-weight:700;text-transform:uppercase;';
            ks.innerText = k + ':';
            var vs = document.createElement('span');
            vs.style.textAlign = 'left';
            vs.innerText = info[k];
            row.appendChild(ks);
            row.appendChild(vs);
            content.appendChild(row);
        }
    }
    popup.appendChild(content);

    var closeBtn = document.createElement('button');
    closeBtn.innerText = 'Close';
    closeBtn.style.cssText = 'margin-top:20px;color:#fff;cursor:pointer;padding:10px 20px;border-radius:15px;' +
        'background:#6cb928;font-family:neo-sans,sans-serif;font-style:italic;font-weight:700;font-size:16px;width:100%;border:none;';
    closeBtn.onclick = overlay.onclick = function () {
        popup.remove(); overlay.remove();
    };
    popup.appendChild(closeBtn);

    document.body.appendChild(overlay);
    document.body.appendChild(popup);
}

