import template from './stape-server-gtm-icon.html.twig';

const { Component } = Shopware;

const componentConfig = {
    template,
};

export default Component.wrapComponentConfig
    ? Component.wrapComponentConfig(componentConfig)
    : componentConfig;
