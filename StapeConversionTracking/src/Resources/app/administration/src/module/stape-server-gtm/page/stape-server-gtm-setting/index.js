import template from './stape-server-gtm-setting.html.twig'
import './stape-server-gtm-setting.scss';

const { Component, Defaults, Mixin } = Shopware;
const { Criteria } = Shopware.Data;

export default Shopware.Component.register('stape-server-gtm-setting', {
    template: template,
    inject: [
        'repositoryFactory',
        'stapeMiddleware',
    ],

    mixins: [
        Mixin.getByName('notification')
    ],

    data() {
        return {
            isLoading: false,
            isSaveSuccessful: false,
            messageBlankErrorState: null,
            mappingErrorStates: {},
            config: null,
            selectedSalesChannelId: null,
            salesChannels: []
        };
    },
    metaInfo() {
        return {
            title: this.$createTitle()
        };
    },

    created() {
        this.createdComponent();
    },

    computed: {
        salesChannelRepository() {
            return this.repositoryFactory.create('sales_channel');
        },

        shopDomainErrorState() {
            if (this.shopDomainFilled) {
                return null;
            }

            return this.messageBlankErrorState;
        },

        hasError() {
            return Object.values(this.mappingErrorStates)
                .filter((state) => state.code !== undefined)
                .length !== 0;
        }
    },

    watch: {},

    methods: {
        createdComponent() {
            this.getSalesChannels();

            this.messageBlankErrorState = {
                code: 1,
                detail: this.$tc('stape-server-gtm.configs.general.messageNotBlank'),
            };
        },

        onChangeLanguage() {
            this.getSalesChannels();
        },

        getSalesChannels() {
            this.isLoading = true;

            const criteria = new Criteria();
            criteria.addFilter(Criteria.equalsAny('typeId', [
                Defaults.storefrontSalesChannelTypeId,
                Defaults.apiSalesChannelTypeId,
            ]));

            this.salesChannelRepository.search(criteria, Shopware.Context.api).then(res => {
                res.add({
                    id: null,
                    translated: {
                        name: this.$tc('sw-sales-channel-switch.labelDefaultOption'),
                    },
                });

                this.salesChannels = res;
            }).finally(() => {
                this.isLoading = false;
            });
        },

        onSave() {
            if (this.hasError) {
                return;
            }

            this.isLoading = true;

            // GTM snippet validation
            let gtmSnippetId;
            if (this.config['StapeConversionTracking.config.snippetId']) {
                gtmSnippetId = this.config['StapeConversionTracking.config.snippetId'].trim();
            }
            const gtmSnippetActive = this.config['StapeConversionTracking.config.snippetActive'];
            this.config['StapeConversionTracking.config.snippetId'] = gtmSnippetId;
            if (gtmSnippetActive && gtmSnippetId && (gtmSnippetId.slice(0, 4) !== 'GTM-' || !this.isValidCode(gtmSnippetId.slice(4))) || !gtmSnippetActive && gtmSnippetId != '') {
                this.createNotificationError({
                    message: this.$tc('stape-server-gtm.settingForm.notifications.gtmSnippet.notificationFailed')
                });
                this.isLoading = false;
                return;
            }

            // Custom domain validation
            let customDomain;
            if (this.config['StapeConversionTracking.config.customDomain']) {
                customDomain = this.config['StapeConversionTracking.config.customDomain'].trim();
                if (customDomain.endsWith('/')) {
                    this.config['StapeConversionTracking.config.customDomain'] = customDomain.slice(0, -1);
                    customDomain = this.config['StapeConversionTracking.config.customDomain'];
                }
            }
            let customDomainActive = this.config['StapeConversionTracking.config.customDomainActive'];
            if (customDomainActive && customDomain && (customDomain.slice(0, 8) !== 'https://' || customDomain.endsWith('/'))) {
                this.createNotificationError({
                    message: this.$tc('stape-server-gtm.settingForm.notifications.customDomain.notificationFailed')
                });
                this.isLoading = false;
                return;
            }

            // Server container URL validation
            const sendWebhooks = this.config['StapeConversionTracking.config.sendWebhooks'];
            const serverContainerUrl = this.config['StapeConversionTracking.config.serverContainerUrl'];
            if (sendWebhooks && !serverContainerUrl) {
                this.createNotificationError({
                    message: this.$tc('stape-server-gtm.settingForm.notifications.serverContainerUrl.notificationFailed')
                });
                this.isLoading = false;
                return;
            }

            // Custom loader validation
            let customLoader;
            if (this.config['StapeConversionTracking.config.customLoader']) {
                customLoader = this.config['StapeConversionTracking.config.customLoader'].trim();
            }
            let customLoaderActive = this.config['StapeConversionTracking.config.customLoaderActive'];
            if (customLoaderActive && !customLoader) {
                this.createNotificationError({
                    message: this.$tc('stape-server-gtm.settingForm.notifications.customLoader.notificationFailed')
                });
                this.isLoading = false;
                return;
            }
            this.generateCustomLoaderPrefix();
            this.generateCustomLoaderQueryParameter();
            this.encodeString();
            this.chooseRandomValue();

            this.$refs.configComponent.save().then(() => {
                return this.refreshCustomLoader();
            }).then(() => {
                this.isSaveSuccessful = true;
                this.createNotificationSuccess({
                    message: this.$tc('stape-server-gtm.settingForm.notifications.notificationSuccess')
                });
            }).finally(() => {
                this.isLoading = false;
            });
        },

        onSalesChannelChange(onInput, selectedSalesChannelId) {
            this.selectedSalesChannelId = selectedSalesChannelId;
            onInput(selectedSalesChannelId);
        },

        refreshCustomLoader() {
            return this.stapeMiddleware.refreshCustomLoader({
                salesChannelId: this.selectedSalesChannelId
            }).then((result) => {
                this.config['StapeConversionTracking.config.customLoaderSource'] = result.source || '';
                this.config['StapeConversionTracking.config.customLoaderStatus'] = result.status || '';
                this.config['StapeConversionTracking.config.customLoaderScript'] = result.script || '';
            }).catch((error) => {
                const data = error?.response?.data || error || {};

                this.config['StapeConversionTracking.config.customLoaderSource'] = data.source || '';
                this.config['StapeConversionTracking.config.customLoaderStatus'] = data.status || '';
                this.config['StapeConversionTracking.config.customLoaderScript'] = data.script || '';
            });
        },

        generateCustomLoaderPrefix() {
            const currentPrefix = this.config['StapeConversionTracking.config.customLoaderPrefix'];
            if (currentPrefix && !['kp', 'gt'].includes(currentPrefix.toLowerCase().slice(-2))) {
                return;
            }

            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const length = Math.floor(Math.random() * 5) + 1;
            let randomString = '';

            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                randomString += characters[randomIndex];
            }

            while (randomString.toLowerCase().slice(-2) === 'kp' || randomString.toLowerCase().slice(-2) === 'gt') {
                const randomIndex = Math.floor(Math.random() * characters.length);
                randomString += characters[randomIndex];
            }

            this.config['StapeConversionTracking.config.customLoaderPrefix'] = randomString;
        },

        generateCustomLoaderQueryParameter() {
            if (this.config['StapeConversionTracking.config.customLoaderQueryParameter']) {
                return;
            }

            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const length = Math.floor(Math.random() * 8) + 1;
            let randomString = '';

            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                randomString += characters[randomIndex];
            }

            this.config['StapeConversionTracking.config.customLoaderQueryParameter'] = randomString;
        },

        isValidCode(code) {
            return /^[a-zA-Z0-9]+$/.test(code);
        },

        encodeString() {
            if (this.config['StapeConversionTracking.config.customLoaderEncodedString']) {
                return;
            }

            const idString = `id=${this.config['StapeConversionTracking.config.snippetId']}`;
            this.config['StapeConversionTracking.config.customLoaderEncodedString'] = encodeURIComponent(btoa(idString));
        },

        chooseRandomValue() {
            if (this.config['StapeConversionTracking.config.customLoaderAddQueryParameter']) {
                return;
            }

            if (this.config['StapeConversionTracking.config.customLoader']) {
                const customLoader = this.config['StapeConversionTracking.config.customLoader'].trim();
                const values = ['page=1', 'page=2', 'page=3', `apiKey=${this.md5(customLoader).substring(0, 8)}`, 'sort=asc', 'sort=desc'];
                const randomIndex = Math.floor(Math.random() * values.length);
                this.config['StapeConversionTracking.config.customLoaderAddQueryParameter'] = values[randomIndex];
            }
        },

        md5(string) {
            function RotateLeft(lValue, iShiftBits) {
                return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
            }

            function AddUnsigned(lX,lY) {
                var lX4,lY4,lX8,lY8,lResult;
                lX8 = (lX & 0x80000000);
                lY8 = (lY & 0x80000000);
                lX4 = (lX & 0x40000000);
                lY4 = (lY & 0x40000000);
                lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
                if (lX4 & lY4) {
                    return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
                }
                if (lX4 | lY4) {
                    if (lResult & 0x40000000) {
                        return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
                    } else {
                        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
                    }
                } else {
                    return (lResult ^ lX8 ^ lY8);
                }
            }

            function F(x,y,z) { return (x & y) | ((~x) & z); }
            function G(x,y,z) { return (x & z) | (y & (~z)); }
            function H(x,y,z) { return (x ^ y ^ z); }
            function I(x,y,z) { return (y ^ (x | (~z))); }

            function FF(a,b,c,d,x,s,ac) {
                a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
                return AddUnsigned(RotateLeft(a, s), b);
            };

            function GG(a,b,c,d,x,s,ac) {
                a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
                return AddUnsigned(RotateLeft(a, s), b);
            };

            function HH(a,b,c,d,x,s,ac) {
                a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
                return AddUnsigned(RotateLeft(a, s), b);
            };

            function II(a,b,c,d,x,s,ac) {
                a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
                return AddUnsigned(RotateLeft(a, s), b);
            };

            function ConvertToWordArray(string) {
                var lWordCount;
                var lMessageLength = string.length;
                var lNumberOfWords_temp1=lMessageLength + 8;
                var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
                var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
                var lWordArray=Array(lNumberOfWords-1);
                var lBytePosition = 0;
                var lByteCount = 0;
                while ( lByteCount < lMessageLength ) {
                    lWordCount = (lByteCount-(lByteCount % 4))/4;
                    lBytePosition = (lByteCount % 4)*8;
                    lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
                    lByteCount++;
                }
                lWordCount = (lByteCount-(lByteCount % 4))/4;
                lBytePosition = (lByteCount % 4)*8;
                lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
                lWordArray[lNumberOfWords-2] = lMessageLength<<3;
                lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
                return lWordArray;
            };

            function WordToHex(lValue) {
                var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
                for (lCount = 0;lCount<=3;lCount++) {
                    lByte = (lValue>>>(lCount*8)) & 255;
                    WordToHexValue_temp = "0" + lByte.toString(16);
                    WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
                }
                return WordToHexValue;
            };

            function Utf8Encode(string) {
                string = string.replace(/\r\n/g,"\n");
                var utftext = "";

                for (var n = 0; n < string.length; n++) {

                    var c = string.charCodeAt(n);

                    if (c < 128) {
                        utftext += String.fromCharCode(c);
                    }
                    else if((c > 127) && (c < 2048)) {
                        utftext += String.fromCharCode((c >> 6) | 192);
                        utftext += String.fromCharCode((c & 63) | 128);
                    }
                    else {
                        utftext += String.fromCharCode((c >> 12) | 224);
                        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                        utftext += String.fromCharCode((c & 63) | 128);
                    }

                }

                return utftext;
            };

            var x=Array();
            var k,AA,BB,CC,DD,a,b,c,d;
            var S11=7, S12=12, S13=17, S14=22;
            var S21=5, S22=9 , S23=14, S24=20;
            var S31=4, S32=11, S33=16, S34=23;
            var S41=6, S42=10, S43=15, S44=21;

            string = Utf8Encode(string);

            x = ConvertToWordArray(string);

            a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

            for (k=0;k<x.length;k+=16) {
                AA=a; BB=b; CC=c; DD=d;
                a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
                d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
                c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
                b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
                a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
                d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
                c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
                b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
                a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
                d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
                c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
                b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
                a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
                d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
                c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
                b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
                a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
                d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
                c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
                b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
                a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
                d=GG(d,a,b,c,x[k+10],S22,0x2441453);
                c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
                b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
                a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
                d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
                c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
                b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
                a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
                d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
                c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
                b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
                a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
                d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
                c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
                b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
                a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
                d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
                c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
                b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
                a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
                d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
                c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
                b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
                a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
                d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
                c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
                b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
                a=II(a,b,c,d,x[k+0], S41,0xF4292244);
                d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
                c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
                b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
                a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
                d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
                c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
                b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
                a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
                d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
                c=II(c,d,a,b,x[k+6], S43,0xA3014314);
                b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
                a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
                d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
                c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
                b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
                a=AddUnsigned(a,AA);
                b=AddUnsigned(b,BB);
                c=AddUnsigned(c,CC);
                d=AddUnsigned(d,DD);
            }

            var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);

            return temp.toLowerCase();
        }
    }
})
