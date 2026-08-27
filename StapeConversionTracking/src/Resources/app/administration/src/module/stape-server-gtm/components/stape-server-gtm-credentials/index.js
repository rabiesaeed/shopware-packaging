import template from './stape-server-gtm-credential.html.twig';
import './stape-server-gtm-credential.scss';

const {Component, Context, Mixin} = Shopware;
const {Criteria} = Shopware.Data;

const componentConfig = {
    template: template,
    inject: [
        'repositoryFactory',
        'loginService',
        'stapeMiddleware'
    ],
    mixins: [
        Mixin.getByName('stape-server-gtm-notification')
    ],

    props: {
        actualConfigData: {
            type: Object,
            required: true
        },
        allConfigs: {
            type: Object,
            required: true
        },

        selectedSalesChannelId: {
            required: true
        },
        userNameErrorState: {
            type: Object,
            required: false,
            default: null,
        },
        apiDomainErrorState: {
            type: Object,
            required: false,
            default: null,
        },
        passwordErrorState: {
            type: Object,
            required: false,
            default: null,
        },
        userNameFilled: {
            type: Boolean,
            required: true,
        },
        userNameSandboxFilled: {
            type: Boolean,
            required: true,
        },
        passwordFilled: {
            type: Boolean,
            required: true,
        },
        passwordSandboxFilled: {
            type: Boolean,
            required: true,
        },
        isLoading: {
            type: Boolean,
            required: true,
        },
        userNameSandboxErrorState: {
            type: Object,
            required: false,
            default: null,
        },
        passwordSandboxErrorState: {
            type: Object,
            required: false,
            default: null,
        },
    },
    data() {
        return {
            isLoading: false,
            isTestLiveSuccessful: false,
            syncService: false,
            httpClient: false,
            isTestingLive: false,
            isTestingSandbox: false,
            isTestSandboxSuccessful: false
        };
    },
    methods: {
        checkTextFieldInheritance(value) {
            if (typeof value !== 'string') {
                return true;
            }

            return value.length <= 0;
        },

        checkBoolFieldInheritance(value) {
            return typeof value !== 'boolean';
        },

        gtmSnippetUpdate(value) {
            this.actualConfigData['StapeConversionTracking.config.snippetActive'] = value;
            if (!value) {
                this.actualConfigData['StapeConversionTracking.config.customDomainActive'] = false;
                this.actualConfigData['StapeConversionTracking.config.customLoaderActive'] = false;
                this.actualConfigData['StapeConversionTracking.config.cookieKeeper'] = false;
            }
        },

        customDomainUpdate(value) {
            this.actualConfigData['StapeConversionTracking.config.customDomainActive'] = value;
            if (!value) {
                this.actualConfigData['StapeConversionTracking.config.customLoaderActive'] = false;
                this.actualConfigData['StapeConversionTracking.config.cookieKeeper'] = false;
            }
        },

        customLoaderUpdate(value) {
            this.actualConfigData['StapeConversionTracking.config.customLoaderActive'] = value;
            if (!value) {
                this.actualConfigData['StapeConversionTracking.config.cookieKeeper'] = false;
            }
        },

        webhookUpdate(value) {
            this.actualConfigData['StapeConversionTracking.config.sendWebhooks'] = value;
            if (!value) {
                this.actualConfigData['StapeConversionTracking.config.purchaseWebhook'] = false;
                this.actualConfigData['StapeConversionTracking.config.refundWebhook'] = false;
            }
        },

        sendTestWebhook() {
            const url = this.actualConfigData['StapeConversionTracking.config.serverContainerUrl'];

            if (!url) {
                this.createNotificationError({
                    message: this.$tc('stape-server-gtm.middleware.status.notificationFailed')
                });
                return;
            }

            let data = {
                url: url,
                event: 'purchase_stape_webhook',
                user_data: {
                    email: 'some@email.com',
                    first_name: 'Name',
                    last_name: 'Surname',
                    phone: '+380992221212',
                    country: 'USA',
                    region: 'Alaska',
                    street: '3601 Old Capitol Trail',
                    city: 'Wilmington',
                    zip: '19808',
                    customer_id: '99382742',
                    new_customer: 'true'
                },
                ecommerce: {
                    transaction_id: "1223494832",
                    affiliation: "my shop",
                    value: "123.22",
                    tax: "2.00",
                    shipping: "12.00",
                    coupon: "TEST100",
                    discount_amount: "25.00",
                    currency: 'USD',
                    items: [
                        {
                            item_name: 'NAME',
                            item_id: 'ID',
                            item_sku: 'SKU',
                            item_category: 'Product category',
                            price: 19.99,
                            quantity: 2
                        },
                        {
                            item_name: 'NAME',
                            item_id: 'ID',
                            item_sku: 'SKU',
                            item_category: 'Product category',
                            price: 11.99,
                            quantity: 1
                        }
                    ]
                },
                cookies: {
                    _fbp: "fb.2.1672941502036.1800772676",
                    _fbc: "IwAR1vDDeJMw0xqepGjhCR_V7qPfviGD_sfkE0yJN-BYcDOymGgEUTB4RmVTo",
                    FPGCLAW: "",
                    _gcl_aw: "",
                    ttclid: "",
                    _ttp: "",
                }
            }

            this.stapeMiddleware
                .testStape({data: data})
                .then(result => {
                    this.isLoading = false;
                    this.processSuccess = true;

                    this.createNotificationSuccess({
                        message: this.$tc('stape-server-gtm.middleware.status.successfullyNotified')
                    });
                    this.$root.$emit('language-change');
                }, error => {
                    this.isLoading = false;

                    this.createNotificationError({
                        message: this.$tc('stape-server-gtm.middleware.status.notificationFailed')
                    });
                    this.$root.$emit('language-change');
                });
        }
    },
};

export default Component.wrapComponentConfig
    ? Component.wrapComponentConfig(componentConfig)
    : componentConfig;
