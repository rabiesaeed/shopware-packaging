const PluginManager = window.PluginManager;

PluginManager.register('StapeAddToCartObserver', () => import('./plugin/stape-add-to-cart.plugin'), '[data-stape-add-to-cart-options]');
PluginManager.register('StapeRemoveFromCart', () => import('./plugin/stape-remove-from-cart.plugin'), '[data-stape-remove-from-cart]');
PluginManager.register('StapeCookie', () => import('./plugin/stape-cookie.plugin'), '[data-stape-cookie]');
PluginManager.register('StapeViewCart', () => import('./plugin/stape-view-cart.plugin'), '[data-stape-view-cart]');
