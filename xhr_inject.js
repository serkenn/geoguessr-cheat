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
window.fetch = async (...args) => {
    const response = await origFetch(...args);
    try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const clone = response.clone();
        const ct = response.headers.get('content-type') || '';
        // Intercept all text-like responses (JSON, text, protobuf, octet-stream)
        if (ct.includes('json') || ct.includes('text') || ct.includes('protobuf') || ct.includes('octet')) {
            clone.text().then(text => {
                window.postMessage({ type: 'fetch', url: url, data: text }, '*');
            }).catch(() => {});
        }
        // Also try to intercept any application/* types we might have missed
        else if (ct.includes('application')) {
            clone.text().then(text => {
                window.postMessage({ type: 'fetch', url: url, data: text }, '*');
            }).catch(() => {});
        }
    } catch (e) {}
    return response;
};
