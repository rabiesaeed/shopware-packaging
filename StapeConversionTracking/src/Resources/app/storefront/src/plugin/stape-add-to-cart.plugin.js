import Plugin from 'src/plugin-system/plugin.class';
import DomAccess from 'src/helper/dom-access.helper';


export default class StapeAddToCartObserverPlugin extends Plugin {
    init() {
        this._getForm();
        this._stapePendingAddToCartPayload = null;
        this._stapeLastAddToCartKey = null;
        this._stapeLastAddToCartAt = 0;

        if (!this._form) {
            return;
        }

        this.$emitter.subscribe('beforeFormSubmit', this._onBeforeFormSubmit.bind(this));
        this.$emitter.subscribe('openOffCanvasCart', this._onSuccessfulAddToCart.bind(this));
        this.$emitter.subscribe('addToCartWithoutOffcanvas', this._onSuccessfulAddToCart.bind(this));
    }

    _getForm() {
        if (this.el && this.el.nodeName === 'FORM') {
            this._form = this.el;
            return;
        }

        this._form = this.el.closest('form');
    }

    _onBeforeFormSubmit() {
        this._stapePendingAddToCartPayload = this._buildAddToCartPayload();
    }

    _onSuccessfulAddToCart() {
        if (!this._stapePendingAddToCartPayload) {
            return;
        }

        window.setTimeout(() => {
            this._pushAddToCartPayload(this._stapePendingAddToCartPayload);
            this._stapePendingAddToCartPayload = null;
        }, 100);
    }

    _buildAddToCartPayload() {
        const options = this.el.dataset.stapeAddToCartOptions;
        if (options) {
            const data = JSON.parse(options);
            const isUserDefined = data.customerDefined;
            const isUserDataActive = data.customerDataEventsActive;
            const userData = data.userData || {};
            if (!userData['phone']) {
                delete userData['phone'];
            }
            if (!userData['region']) {
                delete userData['region'];
            }
            let quantity;
            const quantityInput = DomAccess.querySelector(this._form, '.form-control.js-quantity-selector.quantity-selector-group-input', false);
            if (quantityInput) {
                quantity = DomAccess.querySelector(this._form, '.form-control.js-quantity-selector.quantity-selector-group-input').value;
            } else {
                quantity = data.productQuantity;
            }
            const productCategory = data.productCategory ?? '';

            const ecommerce = {
                'currency': data.currency,
                'value': data.productPrice * quantity,
                'items': [
                    {
                        'imageURL': data.productImageURL,
                        'item_brand': data.productManufacturer,
                        'item_category': productCategory,
                        'item_id': data.productId,
                        'item_name': data.productName,
                        'price': data.productPrice,
                        'quantity': Number(quantity)
                    }
                ]
            };

            const payload = {
                'event': 'add_to_cart_stape',
                'ecomm_pagetype': 'product',
                ecommerce
            };

            if (isUserDataActive && isUserDefined) {
                payload.user_data = userData;
            }

            return payload;
        }

        return null;
    }

    _pushAddToCartPayload(payload) {
        const item = payload.ecommerce?.items?.[0] || {};
        const eventKey = `${item.item_id || item.item_name || ''}:${item.quantity || 1}`;
        const now = Date.now();

        if (eventKey === this._stapeLastAddToCartKey && now - this._stapeLastAddToCartAt < 1500) {
            return;
        }

        this._stapeLastAddToCartKey = eventKey;
        this._stapeLastAddToCartAt = now;

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ecommerce: null});
        window.dataLayer.push(payload);
    }
}
