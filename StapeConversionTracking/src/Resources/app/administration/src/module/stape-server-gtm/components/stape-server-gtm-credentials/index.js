import template from './stape-server-gtm-credential.html.twig';
import './stape-server-gtm-credential.scss';

const {Component, Context, Mixin} = Shopware;
const {Criteria} = Shopware.Data;
const CONFIG_PREFIX = 'StapeConversionTracking.config.';

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
    computed: {
        isLocalGeneratedLoader() {
            return this.actualConfigData?.['StapeConversionTracking.config.customLoaderSource'] === 'local';
        },

        gtmSnippetReady() {
            return this.effectiveBool('snippetActive') && this.effectiveString('snippetId') !== '';
        },

        customDomainReady() {
            return this.gtmSnippetReady
                && this.effectiveBool('customDomainActive')
                && this.effectiveString('customDomain') !== '';
        },

        customLoaderReady() {
            return this.customDomainReady
                && this.effectiveBool('customLoaderActive')
                && this.effectiveString('customLoader') !== '';
        },

        webhooksActive() {
            return this.effectiveBool('sendWebhooks');
        }
    },
    methods: {
        configKey(key) {
            return `${CONFIG_PREFIX}${key}`;
        },

        isInheritedConfigValue(value) {
            return value === undefined || value === null || value === '';
        },

        effectiveConfigValue(key) {
            const configKey = this.configKey(key);
            const currentValue = this.actualConfigData?.[configKey];

            if (this.selectedSalesChannelId !== null && this.isInheritedConfigValue(currentValue)) {
                return this.allConfigs?.['null']?.[configKey];
            }

            return currentValue;
        },

        effectiveBool(key) {
            return this.effectiveConfigValue(key) === true;
        },

        effectiveString(key) {
            const value = this.effectiveConfigValue(key);

            return typeof value === 'string' ? value.trim() : '';
        },

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
                this.actualConfigData['StapeConversionTracking.config.snippetId'] = '';
                this.clearCustomDomainFields();
            }
        },

        customDomainUpdate(value) {
            this.actualConfigData['StapeConversionTracking.config.customDomainActive'] = value;
            if (!value) {
                this.clearCustomDomainFields();
            }
        },

        customLoaderUpdate(value) {
            this.actualConfigData['StapeConversionTracking.config.customLoaderActive'] = value;
            if (!value) {
                this.clearCustomLoaderFields();
            }
        },

        clearCustomDomainFields() {
            this.actualConfigData['StapeConversionTracking.config.customDomainActive'] = false;
            this.actualConfigData['StapeConversionTracking.config.customDomain'] = '';
            this.clearCustomLoaderFields();
        },

        clearCustomLoaderFields() {
            this.actualConfigData['StapeConversionTracking.config.customLoaderActive'] = false;
            this.actualConfigData['StapeConversionTracking.config.customLoader'] = '';
            this.actualConfigData['StapeConversionTracking.config.cookieKeeper'] = false;
            this.clearGeneratedCustomLoaderFields();
        },

        clearGeneratedCustomLoaderFields() {
            this.actualConfigData['StapeConversionTracking.config.customLoaderScript'] = '';
            this.actualConfigData['StapeConversionTracking.config.customLoaderSource'] = '';
            this.actualConfigData['StapeConversionTracking.config.customLoaderStatus'] = '';
            this.actualConfigData['StapeConversionTracking.config.customLoaderSignature'] = '';
        },

        webhookUpdate(value) {
            this.actualConfigData['StapeConversionTracking.config.sendWebhooks'] = value;
            if (!value) {
                this.actualConfigData['StapeConversionTracking.config.serverContainerUrl'] = '';
                this.actualConfigData['StapeConversionTracking.config.purchaseWebhook'] = false;
                this.actualConfigData['StapeConversionTracking.config.refundWebhook'] = false;
            }
        },

        sendTestWebhook() {
            const url = this.effectiveString('serverContainerUrl');

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
        },

        setCustomLoaderFallbackMode(enabled) {
            this.stapeMiddleware
                .setCustomLoaderFallbackMode({
                    enabled,
                    salesChannelId: this.selectedSalesChannelId
                })
                .then((result) => {
                    this.actualConfigData['StapeConversionTracking.config.forceApiFallback'] = result.forceApiFallback;
                    this.actualConfigData['StapeConversionTracking.config.customLoaderSource'] = result.source || '';
                    this.actualConfigData['StapeConversionTracking.config.customLoaderStatus'] = result.status || '';
                    this.actualConfigData['StapeConversionTracking.config.customLoaderScript'] = result.script || '';

                    this.createNotificationSuccess({
                        message: enabled
                            ? this.$tc('stape-server-gtm.settingForm.credentials.gtmSnippet.apiFallback.blockedSuccess')
                            : this.$tc('stape-server-gtm.settingForm.credentials.gtmSnippet.apiFallback.unblockedSuccess')
                    });
                }, () => {
                    this.createNotificationError({
                        message: this.$tc('stape-server-gtm.settingForm.credentials.gtmSnippet.apiFallback.failed')
                    });
                });
        },

        removeCustomLoader() {
            this.stapeMiddleware
                .removeCustomLoader({
                    salesChannelId: this.selectedSalesChannelId
                })
                .then((result) => {
                    this.actualConfigData['StapeConversionTracking.config.customLoaderSource'] = result.source || '';
                    this.actualConfigData['StapeConversionTracking.config.customLoaderStatus'] = result.status || '';
                    this.actualConfigData['StapeConversionTracking.config.customLoaderScript'] = result.script || '';

                    this.createNotificationSuccess({
                        message: this.$tc('stape-server-gtm.settingForm.credentials.gtmSnippet.apiFallback.removeSuccess')
                    });
                }, () => {
                    this.createNotificationError({
                        message: this.$tc('stape-server-gtm.settingForm.credentials.gtmSnippet.apiFallback.removeFailed')
                    });
                });
        }
    },
};

export default Component.wrapComponentConfig
    ? Component.wrapComponentConfig(componentConfig)
    : componentConfig;
