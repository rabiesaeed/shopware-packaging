import stapeIconSvg from './svg/icons-stape-server-gtm.svg';

const resolveSvg = (svg) => {
    if (typeof svg === 'string') {
        return svg;
    }

    return svg?.default || svg?.content || '';
};

export default [
    {
        name: 'icons-stape-server-gtm',
        template: '<span class="stape-server-gtm-icon" v-html="svg"></span>',

        data() {
            return {
                svg: resolveSvg(stapeIconSvg),
            };
        },
    },
];
