import Plugin from 'src/plugin-system/plugin.class';
import { COOKIE_CONFIGURATION_UPDATE } from 'src/plugin/cookie/cookie-configuration.plugin';
import CookieStorage from 'src/helper/storage/cookie-storage.helper';

export default class StapeCookiePlugin extends Plugin {
    static options = {
        cookieName: '_sbp',
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

        // BEGIN: Subscribe to Shopware global cookie emitter
        /*
        this.$emitter.subscribe(COOKIE_CONFIGURATION_UPDATE, this._onConsentChange);
        */
        this._cookieEmitter = document.$emitter?.subscribe ? document.$emitter : this.$emitter;
        this._cookieEmitter.subscribe(COOKIE_CONFIGURATION_UPDATE, this._onConsentChange);
        // END: Subscribe to Shopware global cookie emitter

        if (this._hasConsent()) {
            this._enable();
        }
    }

    destroy() {
        // BEGIN: Unsubscribe from Shopware global cookie emitter
        /*
        if (this.$emitter?.unsubscribe) {
            this.$emitter.unsubscribe(COOKIE_CONFIGURATION_UPDATE, this._onConsentChange);
        }
        */
        if (this._cookieEmitter?.unsubscribe) {
            this._cookieEmitter.unsubscribe(COOKIE_CONFIGURATION_UPDATE, this._onConsentChange);
        }
        // END: Unsubscribe from Shopware global cookie emitter

        if (super.destroy) {
            super.destroy();
        }
    }

    _onConsentChange(event) {
        const updated = event?.detail || {};

        // BEGIN: Handle Shopware consent update before cookie persistence
        /*
        const hasKey = typeof updated[this.options.cookieName] !== 'undefined';
        const consent = hasKey ? !!updated[this.options.cookieName] : this._hasConsent();

        if (consent) {
            this._enable();
        } else {
            this._disable();
        }
        */

        const hasKey = Object.prototype.hasOwnProperty.call(
            updated,
            this.options.cookieName
        );

        if (hasKey) {
            const consent = this._toBool(updated[this.options.cookieName]);

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
        // END: Handle Shopware consent update before cookie persistence
    }

    _hasConsent() {
        return !!CookieStorage.getItem(this.options.cookieName);
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

        const existingScript = document.getElementById(this.options.scriptId);
        if (existingScript) {
            if (existingScript.dataset.stapeLoaderSource === 'stored-api') {
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
        executableScript.dataset.stapeLoaderSource = 'stored-api';

        if (storedScript.src) {
            executableScript.async = storedScript.async !== false;
            executableScript.src = storedScript.src;
        } else {
            executableScript.textContent = storedScript.textContent || '';
        }

        document.head.appendChild(executableScript);

        return true;
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

            const bi = this._getCookieValue('_sbp');
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

        let currentValue = this._getCookieValue(this.options.cookieName);
        if (!currentValue) {
            await this._waitForConsentCookie();
            currentValue = this._getCookieValue(this.options.cookieName);
        }

        if (currentValue && currentValue !== '1' && currentValue !== 'true') {
            return;
        }

        if (!currentValue) {
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
        const parts = document.cookie ? document.cookie.split('; ') : [];

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];

            if (p.startsWith(name + '=')) {
                return p.substring(name.length + 1);
            }
        }

        return '';
    }

    _getContainerId(customLoader) {
        const parts = String(customLoader || '').split(':');

        return parts.length >= 2 ? parts[1] : parts[0];
    }

    _toBool(v) {
        return v === true || v === '1' || v === 1 || v === 'true';
    }
}
