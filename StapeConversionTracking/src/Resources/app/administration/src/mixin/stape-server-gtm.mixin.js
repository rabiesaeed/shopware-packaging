const {Mixin} = Shopware;

const UnknownError = {
    code: 'UNKNOWN',
    status: '500',
    title: 'Unknown error',
    detail: 'Unknown error',
};

Mixin.register('stape-server-gtm-notification', {
    mixins: [
        Mixin.getByName('notification'),
    ],
    methods: {
        createNotificationFromError(options) {
            let {title} = options;
            const {errorResponse, formatMessage = (message => message)} = options;

            let errors = errorResponse?.response?.data?.errors;

            if (!errorResponse) {
                errors = [UnknownError];
            } else if (!errors) {
                const formatedMessage = formatMessage(String(errorResponse), UnknownError);
                this.createNotificationFromError({message: formatedMessage});
                return;
            }

            const messages = errors.map((error) => {
                const message = typeof error.meta?.parameters?.message === 'string'
                    ? error.meta.parameters.message
                    : error.detail;
                const snippet = `stape-server-gtm.errors.${error.code}`;
                const translation = this.$tc(snippet, 0, {message});

                if (snippet !== translation) {
                    return formatMessage(translation, error);
                }

                return formatMessage(message, error);
            });

            if (title) {
                const translation = this.$tc(title);
                title = title !== translation ? translation : title;
            }

            for (let i = 0; i < messages.length; i += 1) {
                this.createNotificationError({message: messages[i], title});
            }
        },

        successNotification() {
            this.createNotificationSuccess({
                title: this.$root.$tc('global.default.success'),
                message: this.$root.$tc('stape-server-gtm.settingForm.messageTestSuccess'),
            });
        }
    }
});