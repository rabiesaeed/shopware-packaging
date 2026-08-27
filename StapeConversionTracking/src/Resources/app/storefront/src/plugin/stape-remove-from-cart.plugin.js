import Plugin from 'src/plugin-system/plugin.class';
import DomAccess from 'src/helper/dom-access.helper';

export default class StapeRemoveFromCartPlugin extends Plugin
{
    init() {
        this._registerEvents();
    }

    _registerEvents() {
        const form = this.el;
        form.addEventListener('submit', () => {
            const options = this.el.dataset.stapeRemoveFromCartOptions;
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
                const lineItem = this.el.closest('.line-item');
                let quantity;
                const quantityInput = DomAccess.querySelector(lineItem, '.form-control.js-quantity-selector.quantity-selector-group-input', false);
                if (quantityInput) {
                    quantity =  DomAccess.querySelector(lineItem, '.form-control.js-quantity-selector.quantity-selector-group-input').value;
                } else {
                    quantity = data.productQuantity;
                }

                if (isUserDataActive && isUserDefined) {
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push({ecommerce: null});
                    window.dataLayer.push({
                        'event': 'remove_from_cart_stape',
                        'ecomm_pagetype': 'product',
                        'ecommerce': {
                            'currency': data.currency,
                            'value': data.productPrice * quantity,
                            'items': [
                                {
                                    'imageURL': data.productImageURL,
                                    'item_id': data.productId,
                                    'item_name': data.productName,
                                    'price': data.productPrice,
                                    'quantity': Number(quantity)
                                }
                            ]
                        },
                        'user_data': userData
                    });
                } else {
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push({ecommerce: null});
                    window.dataLayer.push({
                        'event': 'remove_from_cart_stape',
                        'ecomm_pagetype': 'product',
                        'ecommerce': {
                            'currency': data.currency,
                            'value': data.productPrice * quantity,
                            'items': [
                                {
                                    'imageURL': data.productImageURL,
                                    'item_id': data.productId,
                                    'item_name': data.productName,
                                    'price': data.productPrice,
                                    'quantity': Number(quantity)
                                }
                            ]
                        }
                    });
                }
            }
        })
    }
}
