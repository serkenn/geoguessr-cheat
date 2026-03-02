(function (xhr) {

    var XHR = XMLHttpRequest.prototype;

    var open = XHR.open;
    var send = XHR.send;

    XHR.open = function (method, url) {
        this._method = method;
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function (postData) {
        this.addEventListener('load', function () {
            try {
                window.postMessage({ type: 'xhr', url: this._url || '', data: this.response }, '*');
            } catch {
                return;
            }
        });
        return send.apply(this, arguments);
    };
})(XMLHttpRequest);

const { fetch: origFetch } = window;

function shouldInterceptFetch(url) {
    if (!url) return false;
    return url.includes('geoguessr.com') ||
        url.includes('game-server.geoguessr.com') ||
        url.includes('maps.googleapis.com');
}

window.fetch = (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const p = origFetch(...args);

    // Do not touch unrelated third-party requests (ads, trackers, etc.).
    if (!shouldInterceptFetch(url)) return p;

    return p.then((response) => {
        try {
            const clone = response.clone();
            const ct = response.headers.get('content-type') || '';
            // Intercept text-like API payloads only.
            if (ct.includes('json') || ct.includes('text') || ct.includes('protobuf') ||
                ct.includes('octet') || ct.includes('application')) {
                clone.text().then((text) => {
                    window.postMessage({ type: 'fetch', url: url, data: text }, '*');
                }).catch(() => {});
            }
        } catch {}
        return response;
    });
};
