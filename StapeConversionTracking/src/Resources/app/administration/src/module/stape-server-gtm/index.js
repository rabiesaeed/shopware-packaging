
import './page/stape-server-gtm-setting'
import stapeServerGtmCredentials from './components/stape-server-gtm-credentials'
import stapeServerGtmIcon from './components/stape-server-gtm-icon';

import deDE from './snippet/de-DE';
import enGB from './snippet/en-GB';

const { Module } = Shopware;

Shopware.Component.register('stape-server-gtm-credentials', stapeServerGtmCredentials);
Shopware.Component.register('stape-server-gtm-icon', stapeServerGtmIcon);

Module.register('stape-server-gtm', {
    type: 'plugin',
    name: 'Stape Server GTM',
    title: 'stape-server-gtm.title',
    description: 'Description',
    version: '1.0.7',
    targetVersion: '1.0.7',
    color: '#9AA8B5',
    icon: 'regular-cog',
    snippets: {
        'de-DE': deDE,
        'en-GB': enGB
    },
    routes: {
        settings: {
            component: 'stape-server-gtm-setting',
            path: 'settings',
            meta: {
                parentPath: 'sw.settings.index.plugins'
            }
        }
    },
    settingsItem: {
        id: 'stape-server-gtm',
        name: 'stape-server-gtm',
        group: 'plugins',
        label: 'stape-server-gtm.title',
        to: 'stape.server.gtm.settings',
        icon: 'regular-cog',
        iconComponent: 'stape-server-gtm-icon',
        backgroundEnabled: true,
    },
});
