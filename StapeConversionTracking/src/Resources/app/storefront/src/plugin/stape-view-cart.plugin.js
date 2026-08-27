import Plugin from 'src/plugin-system/plugin.class';

export default class StapeViewCartPlugin extends Plugin {
    init() {
        if (this.el.dataset.stapeViewCartTracked === 'true') {
            return;
        }

        this.el.dataset.stapeViewCartTracked = 'true';
        this._pushViewCart();
    }

    _pushViewCart() {
        const options = this._parseJson(this.el.dataset.stapeViewCartOptions) || {};
        const items = Array.from(this.el.querySelectorAll('[data-stape-view-cart-item]'))
            .map((itemEl) => this._parseJson(itemEl.dataset.stapeViewCartItem))
            .filter(Boolean);

        const cartQuantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0);

        const payload = {
            event: 'view_cart_stape',
            ecomm_pagetype: 'basket',
            ecommerce: {
                cart_total: Number(options.cartTotal || 0),
                currency: options.currency || '',
                cart_quantity: cartQuantity,
                value: Number(options.cartTotal || 0),
                items
            }
        };

        if (options.customerDataEventsActive && options.customerDefined && options.userData) {
            payload.user_data = this._cleanUserData(options.userData);
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ ecommerce: null });
        window.dataLayer.push(payload);
    }

    _parseJson(value) {
        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value);
        } catch (e) {
            return null;
        }
    }

    _cleanUserData(userData) {
        return Object.entries(userData).reduce((cleaned, [key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                cleaned[key] = value;
            }

            return cleaned;
        }, {});
    }
}
