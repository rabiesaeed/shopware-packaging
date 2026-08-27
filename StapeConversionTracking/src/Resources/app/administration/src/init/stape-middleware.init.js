import StapeMiddlewareService from "../service/stape-middleware.service";

Shopware.Application.addServiceProvider('stapeMiddleware', container => {
    const initContainer = Shopware.Application.getContainer('init');
    const loginService = Shopware.Application.getContainer('service').loginService;
    return new StapeMiddlewareService(initContainer.httpClient, loginService);
});
