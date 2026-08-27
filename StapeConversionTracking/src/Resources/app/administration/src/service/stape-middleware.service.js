/**
 * @class
 * @property {AxiosInstance} httpClient
 */
export default class StapeMiddlewareService {
    /**
     * @constructor
     * @param {AxiosInstance} httpClient
     * @param loginService
     */
    constructor(httpClient, loginService) {
        this.httpClient = httpClient;
        this.loginService = loginService;
    }

    testStape(params = {}, additionalHeaders = {}) {
        const headers = this.getBasicHeaders(additionalHeaders);

        return this.httpClient
            .post('/stape/webhook-test', params, { headers })
            .then(response => {
                if (!response.data.success) {
                    return Promise.reject(response.data);
                }
                return response.data;
            });
    }

    refreshCustomLoader(params = {}, additionalHeaders = {}) {
        const headers = this.getBasicHeaders(additionalHeaders);

        return this.httpClient
            .post('/stape/custom-loader/refresh', params, { headers })
            .then(response => response.data);
    }

    getBasicHeaders(additionalHeaders = {}) {
        const basicHeaders = {
            Accept: 'application/json',
            Authorization: `Bearer ${this.loginService.getToken()}`,
            'Content-Type': 'application/json'
        };

        return Object.assign({}, basicHeaders, additionalHeaders);
    }
}
