import Plugin from 'src/plugin-system/plugin.class';
import { COOKIE_CONFIGURATION_UPDATE } from 'src/plugin/cookie/cookie-configuration.plugin';
import CookieStorage from 'src/helper/storage/cookie-storage.helper';

export default class StapeCookiePlugin extends Plugin {
    static options = {
        cookieName: '_sbp',
        consentCookieName: '_sbp_consent',
        browserIdentifierCookieName: '_sbp',
        gtmId: '',
        customDomainActive: false,
        customDomain: '',
        customLoaderActive: false,
        customLoader: '',
        customLoaderPrefix: '',
        customLoaderQueryParameter: '',
        customLoaderEncodedString: '',
        customLoaderAddQueryParameter: '',
        customLoaderScript: '',
        customLoaderSource: '',
        cookieKeeper: false,
        dataLayerName: 'dataLayer',
        scriptId: 'stape-gtm-loader'
    };

    init() {
        this.isLoaded = false;

        this._onConsentChange = this._onConsentChange.bind(this);

        this._cookieEmitter = document.$emitter?.subscribe ? document.$emitter : this.$emitter;
        this._cookieEmitter.subscribe(COOKIE_CONFIGURATION_UPDATE, this._onConsentChange);

        if (this._hasConsent()) {
            this._enable();
        }
    }

    destroy() {
        if (this._cookieEmitter?.unsubscribe) {
            this._cookieEmitter.unsubscribe(COOKIE_CONFIGURATION_UPDATE, this._onConsentChange);
        }

        if (super.destroy) {
            super.destroy();
        }
    }

    _onConsentChange(event) {
        const updated = event?.detail || event || {};

        const consentCookieName = this._getConsentCookieName();
        const legacyCookieName = this.options.cookieName;
        const hasKey = Object.prototype.hasOwnProperty.call(updated, consentCookieName)
            || Object.prototype.hasOwnProperty.call(updated, legacyCookieName);

        if (hasKey) {
            const consent = Object.prototype.hasOwnProperty.call(updated, consentCookieName)
                ? this._toBool(updated[consentCookieName])
                : this._toBool(updated[legacyCookieName]);

            if (consent) {
                this._enable();
            } else {
                this._disable();
            }

            return;
        }

        let attempts = 0;
        const maxAttempts = 10;

        const checkConsent = () => {
            if (this._hasConsent()) {
                this._enable();
                return;
            }

            attempts += 1;

            if (attempts < maxAttempts) {
                window.setTimeout(checkConsent, 100);
                return;
            }

            this._disable();
        };

        window.setTimeout(checkConsent, 100);
    }

    _hasConsent() {
        if (CookieStorage.getItem(this._getConsentCookieName())) {
            return true;
        }

        return this._getCookieValues(this._getIdentifierCookieName()).some((value) => value !== '');
    }

    async _enable() {
        if (this.isLoaded) {
            this._runDataLayerTemplatesOnce();
            return;
        }

        await this._ensureCookieKeeperCookie();

        if (this._loadStoredLoaderScript()) {
            this.isLoaded = true;
            this._runDataLayerTemplatesOnce();
            return;
        }

        const src = this._buildScriptSrc();
        if (!src) return;

        const dl = this.options.dataLayerName || 'dataLayer';
        window[dl] = window[dl] || [];
        window[dl].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

        if (!document.getElementById(this.options.scriptId)) {
            const s = document.createElement('script');
            s.async = true;
            s.src = src;
            s.id = this.options.scriptId;
            s.dataset.stapeTracking = 'true';
            document.head.appendChild(s);
        }

        this.isLoaded = true;

        this._runDataLayerTemplatesOnce();
    }

    _disable() {
        const scripts = document.querySelectorAll('[data-stape-tracking="true"]');
        scripts.forEach((script) => script.remove());

        this.isLoaded = false;

        this._clearCookieKeeperCookie();
    }

    _loadStoredLoaderScript() {
        const script = (this.options.customLoaderScript || '').trim();

        if (!script || !this._toBool(this.options.customLoaderActive)) {
            return false;
        }

        const template = document.createElement('template');
        template.innerHTML = script;
        const storedScript = template.content.querySelector('script');

        if (!storedScript) {
            return false;
        }

        const loaderSource = this.options.customLoaderSource === 'local' ? 'stored-local' : 'stored-api';
        const loaderSignature = this._hashString(script);
        const existingScript = document.getElementById(this.options.scriptId);
        if (existingScript) {
            if (
                existingScript.dataset.stapeLoaderSource === loaderSource
                && existingScript.dataset.stapeLoaderSignature === loaderSignature
            ) {
                return true;
            }

            existingScript.remove();
        }

        const executableScript = document.createElement('script');
        Array.from(storedScript.attributes).forEach((attribute) => {
            executableScript.setAttribute(attribute.name, attribute.value);
        });

        executableScript.id = this.options.scriptId;
        executableScript.dataset.stapeTracking = 'true';
        executableScript.dataset.stapeLoaderSource = loaderSource;
        executableScript.dataset.stapeLoaderSignature = loaderSignature;

        if (storedScript.src) {
            executableScript.async = storedScript.async !== false;
            executableScript.src = storedScript.src;
        } else {
            executableScript.textContent = storedScript.textContent || '';
        }

        document.head.appendChild(executableScript);

        return true;
    }

    _hashString(value) {
        let hash = 0;

        for (let i = 0; i < value.length; i++) {
            hash = ((hash << 5) - hash) + value.charCodeAt(i);
            hash |= 0;
        }

        return String(hash);
    }

    _buildScriptSrc() {
        const gtmId = (this.options.gtmId || '').trim();
        if (!gtmId) return null;

        const customDomainActive = this._toBool(this.options.customDomainActive);
        const customLoaderActive = this._toBool(this.options.customLoaderActive);
        const cookieKeeper = this._toBool(this.options.cookieKeeper);

        const customDomain = (this.options.customDomain || '').trim().replace(/\/+$/, '');

        if (!customDomainActive && !customLoaderActive && !cookieKeeper) {
            return `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
        }

        if (customDomainActive && customDomain && !customLoaderActive && !cookieKeeper) {
            return `${customDomain}/gtm.js?id=${encodeURIComponent(gtmId)}`;
        }

        if (customLoaderActive && this.options.customLoader && !cookieKeeper) {
            const prefix = this.options.customLoaderPrefix || '';
            const loader = this._getContainerId(this.options.customLoader);
            const qp = `${this.options.customLoaderQueryParameter}=${this.options.customLoaderEncodedString}&${this.options.customLoaderAddQueryParameter}`;
            return `${customDomain}/${prefix}${loader}.js?${qp}`;
        }

        if (cookieKeeper) {
            const loader = this._getContainerId(this.options.customLoader);
            const prefixAndLoader = `${this.options.customLoaderPrefix || ''}kp${loader}`;
            const c = `${this.options.customLoaderQueryParameter}=${this.options.customLoaderEncodedString}&${this.options.customLoaderAddQueryParameter}`;

            const bi = this._getBrowserIdentifierValue();
            const v = bi ? `&bi=${encodeURIComponent(bi)}` : '';

            const base = customDomain || '';
            if (!base || !prefixAndLoader) return null;

            return `${base}/${prefixAndLoader}.js?${c}${v}`;
        }

        return null;
    }

    async _ensureCookieKeeperCookie() {
        if (!this._toBool(this.options.cookieKeeper)) {
            return;
        }

        if (this._getBrowserIdentifierValue()) {
            return;
        }

        let hasConsent = this._hasConsent();
        if (!hasConsent) {
            await this._waitForConsentCookie();
            hasConsent = this._hasConsent();
        }

        if (!hasConsent) {
            return;
        }

        try {
            await fetch('/stape/cookie-keeper/enable', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
        } catch (e) {
            // Keep the consent-gated GTM path working if the local helper route is unavailable.
        }
    }

    async _clearCookieKeeperCookie() {
        if (!this._toBool(this.options.cookieKeeper)) {
            return;
        }

        try {
            await fetch('/stape/cookie-keeper/disable', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
        } catch (e) {
            // Shopware already removes host-only consent cookies; this only clears the server domain copy.
        }
    }

    _waitForConsentCookie() {
        return new Promise((resolve) => window.setTimeout(resolve, 100));
    }

    _runDataLayerTemplatesOnce() {
        if (window.__stapeDlRan) return;

        const templates = document.querySelectorAll('script[data-stape-data-layer-template="true"]');
        if (!templates.length) return;

        const dl = this.options.dataLayerName || 'dataLayer';
        window[dl] = window[dl] || [];

        templates.forEach((tpl) => {
            const code = tpl.textContent || '';
            if (!code.trim()) return;

            const executableScript = document.createElement('script');
            executableScript.type = 'text/javascript';
            executableScript.dataset.stapeDataLayerExecuted = 'true';

            Array.from(tpl.attributes).forEach((attribute) => {
                if (attribute.name === 'type' || attribute.name === 'data-stape-data-layer-template') {
                    return;
                }

                executableScript.setAttribute(attribute.name, attribute.value);
            });

            executableScript.textContent = code;

            tpl.parentNode.insertBefore(executableScript, tpl.nextSibling);
        });

        window.__stapeDlRan = true;
    }

    _getCookieValue(name) {
        const values = this._getCookieValues(name);

        return values.length > 0 ? values[0] : '';
    }

    _getCookieValues(name) {
        const parts = document.cookie ? document.cookie.split('; ') : [];
        const values = [];

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];

            if (p.startsWith(name + '=')) {
                values.push(p.substring(name.length + 1));
            }
        }

        return values;
    }

    _getBrowserIdentifierValue() {
        const values = this._getCookieValues(this._getIdentifierCookieName());
        const generatedValue = values.find((value) => !this._isPlaceholderValue(value));

        return generatedValue || '';
    }

    _getConsentCookieName() {
        return this.options.consentCookieName || '_sbp_consent';
    }

    _getIdentifierCookieName() {
        return this.options.browserIdentifierCookieName || this.options.cookieName || '_sbp';
    }

    _isPlaceholderValue(value) {
        return value === '' || value === '1' || value === 'true';
    }

    _getContainerId(customLoader) {
        const parts = String(customLoader || '').split(':');

        return parts.length >= 2 ? parts[1] : parts[0];
    }

    _toBool(v) {
        return v === true || v === '1' || v === 1 || v === 'true';
    }
}
