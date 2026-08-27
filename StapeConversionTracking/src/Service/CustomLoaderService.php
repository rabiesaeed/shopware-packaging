<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Service;

use GuzzleHttp\Client;
use Doctrine\DBAL\Connection;
use Psr\Log\LoggerInterface;
use Shopware\Core\Framework\Adapter\Cache\CacheInvalidator;
use Shopware\Core\Framework\Uuid\Uuid;
use Shopware\Core\System\SystemConfig\SystemConfigService;

class CustomLoaderService
{
    private const STAPE_API_BASE_GLOBAL = 'https://api.app.stape.io/api/v2/container';
    private const STAPE_API_BASE_EU = 'https://api.app.eu.stape.io/api/v2/container';
    private const CONFIG_PREFIX = 'StapeConversionTracking.config.';
    private const SOURCE_API = 'api';
    private const SOURCE_FALLBACK = 'fallback';
    private const SOURCE_LOCAL = 'local';
    private const SYSTEM_CONFIG_CACHE_TAG_PREFIX = 'system.config-';

    public function __construct(
        private readonly SystemConfigService $systemConfigService,
        private readonly LoggerInterface $logger,
        private readonly CacheInvalidator $cacheInvalidator,
        private readonly Connection $connection
    ) {
    }

    /**
     * @return array{success: bool, source: string|null, status: string, script: string|null}
     */
    public function generateAndStoreCustomLoader(?string $salesChannelId = null, bool $force = false): array
    {
        $snippetActive = $this->getBool('snippetActive', $salesChannelId);
        $snippetId = $this->getString('snippetId', $salesChannelId);
        $customDomainActive = $this->getBool('customDomainActive', $salesChannelId);
        $customDomain = $this->getString('customDomain', $salesChannelId);
        $customLoaderActive = $this->getBool('customLoaderActive', $salesChannelId);
        $customLoader = $this->getString('customLoader', $salesChannelId);
        $cookieKeeper = $this->getBool('cookieKeeper', $salesChannelId);
        $forceApiFallback = $this->getBool('forceApiFallback', $salesChannelId);

        if (!$snippetActive || $snippetId === '') {
            return $this->clearStoredLoader('GTM snippet is disabled or GTM ID is missing.', $salesChannelId);
        }

        if (!$customDomainActive || $customDomain === '' || !$customLoaderActive || $customLoader === '') {
            $script = $this->buildStandardGtmScript($snippetId, $customDomain ?: 'https://www.googletagmanager.com');
            return $this->storeLoader($script, self::SOURCE_FALLBACK, 'Standard GTM fallback generated because custom loader prerequisites are missing.', $salesChannelId);
        }

        $settings = $this->buildActiveLoaderSettings($customLoader, $snippetId, $customDomain, $cookieKeeper, $salesChannelId);
        $signature = $this->buildSettingsSignature($settings);
        $storedSignature = $this->getString('customLoaderSignature', $salesChannelId);
        $storedScript = $this->getString('customLoaderScript', $salesChannelId);
        $storedSource = $this->getString('customLoaderSource', $salesChannelId);

        if (!$force && $storedScript !== '' && $storedSignature === $signature) {
            return [
                'success' => true,
                'source' => $this->getString('customLoaderSource', $salesChannelId) ?: 'stored',
                'status' => $this->getString('customLoaderStatus', $salesChannelId) ?: 'Stored loader is up to date.',
                'script' => $storedScript,
            ];
        }

        $apiScript = $forceApiFallback
            ? null
            : $this->fetchCustomLoaderScriptFromApi($settings['containerId'], $settings['apiKey'], $settings['payload']);

        if ($apiScript !== null) {
            return $this->storeLoader($apiScript, self::SOURCE_API, 'Loader generated via Stape API.', $salesChannelId, $signature);
        }

        if ($storedScript !== '' && ($storedSource === self::SOURCE_API || $storedSource === '')) {
            $status = $forceApiFallback
                ? 'Stape API blocked from settings; existing custom loader from database kept unchanged.'
                : 'Stape API failed; existing custom loader from database kept unchanged.';

            return $this->keepStoredLoader($storedScript, $storedSource ?: 'stored', $status, $salesChannelId);
        }

        $localScript = $this->buildLocalCustomLoaderScript($settings);
        $status = $forceApiFallback
            ? 'Loader generated locally because Stape API is blocked from settings.'
            : 'Loader generated locally because Stape API failed.';

        return $this->storeLoader($localScript, self::SOURCE_LOCAL, $status, $salesChannelId, $signature);
    }

    /**
     * @return array{success: bool, source: string|null, status: string, script: string|null, forceApiFallback: bool}
     */
    public function setForceApiFallback(bool $enabled, ?string $salesChannelId = null): array
    {
        $this->systemConfigService->set(self::CONFIG_PREFIX . 'forceApiFallback', $enabled, $salesChannelId);
        $result = $this->generateAndStoreCustomLoader($salesChannelId, true);
        $result['forceApiFallback'] = $enabled;

        return $result;
    }

    /**
     * @return array{success: bool, source: null, status: string, script: null, forceApiFallback: bool}
     */
    public function removeStoredCustomLoader(?string $salesChannelId = null): array
    {
        foreach ([
            'customLoaderScript',
            'customLoaderSource',
            'customLoaderStatus',
            'customLoaderSignature',
        ] as $key) {
            $this->systemConfigService->delete(self::CONFIG_PREFIX . $key, $salesChannelId);
        }

        $this->invalidateConfigCache($salesChannelId);

        return [
            'success' => true,
            'source' => null,
            'status' => 'Stored custom loader script removed.',
            'script' => null,
            'forceApiFallback' => $this->getBool('forceApiFallback', $salesChannelId),
        ];
    }

    /**
     * @return array{containerId: string, apiKey: string|null, webGtmId: string, customDomain: string, prefix: string, loader: string, queryParameter: string, encodedString: string, addQueryParameter: string, cookieKeeper: bool, payload: array<string, string>}
     */
    private function buildActiveLoaderSettings(string $customLoader, string $snippetId, string $customDomain, bool $cookieKeeper, ?string $salesChannelId): array
    {
        $parts = explode(':', $customLoader);
        $containerId = count($parts) >= 2 ? $parts[1] : $customLoader;
        $apiKey = count($parts) >= 2 ? $customLoader : null;
        $domainParts = $this->parseCustomDomain($customDomain);
        $loaderConfig = $this->getOrCreateLocalLoaderConfig($customLoader, $snippetId, $salesChannelId);

        $payload = [
            'webGtmId' => $snippetId,
            'domain' => $domainParts['domain'],
            'source' => 'shopware',
            'dataLayerObjectName' => 'dataLayer',
        ];

        if ($cookieKeeper) {
            $payload['userIdentifierType'] = 'cookie';
            $payload['userIdentifierValue'] = '_sbp';
        }

        if ($domainParts['sameOriginPath'] !== null) {
            $payload['sameOriginPath'] = $domainParts['sameOriginPath'];
        }

        return [
            'containerId' => $containerId,
            'apiKey' => $apiKey,
            'webGtmId' => $snippetId,
            'customDomain' => rtrim($customDomain, '/'),
            'prefix' => $loaderConfig['prefix'],
            'loader' => $containerId,
            'queryParameter' => $loaderConfig['queryParameter'],
            'encodedString' => $loaderConfig['encodedString'],
            'addQueryParameter' => $loaderConfig['addQueryParameter'],
            'cookieKeeper' => $cookieKeeper,
            'payload' => $payload,
        ];
    }

    /**
     * @return array{prefix: string, queryParameter: string, encodedString: string, addQueryParameter: string}
     */
    private function getOrCreateLocalLoaderConfig(string $customLoader, string $snippetId, ?string $salesChannelId): array
    {
        $prefix = $this->getString('customLoaderPrefix', $salesChannelId);
        $queryParameter = $this->getString('customLoaderQueryParameter', $salesChannelId);
        $encodedString = $this->getString('customLoaderEncodedString', $salesChannelId);
        $addQueryParameter = $this->getString('customLoaderAddQueryParameter', $salesChannelId);

        $updates = [];

        if ($prefix === '' || $this->hasReservedLoaderSuffix($prefix)) {
            $prefix = $this->generateLoaderPrefix();
            $updates[self::CONFIG_PREFIX . 'customLoaderPrefix'] = $prefix;
        }

        if ($queryParameter === '') {
            $queryParameter = $this->generateRandomString(random_int(1, 8));
            $updates[self::CONFIG_PREFIX . 'customLoaderQueryParameter'] = $queryParameter;
        }

        if ($encodedString === '') {
            $encodedString = rawurlencode(base64_encode('id=' . $snippetId));
            $updates[self::CONFIG_PREFIX . 'customLoaderEncodedString'] = $encodedString;
        }

        if ($addQueryParameter === '') {
            $addQueryParameter = 'apiKey=' . substr(md5($customLoader), 0, 8);
            $updates[self::CONFIG_PREFIX . 'customLoaderAddQueryParameter'] = $addQueryParameter;
        }

        if ($updates !== []) {
            $this->systemConfigService->setMultiple($updates, $salesChannelId);
        }

        return [
            'prefix' => $prefix,
            'queryParameter' => $queryParameter,
            'encodedString' => $encodedString,
            'addQueryParameter' => $addQueryParameter,
        ];
    }

    private function generateLoaderPrefix(): string
    {
        do {
            $prefix = $this->generateRandomString(random_int(1, 5));
        } while ($this->hasReservedLoaderSuffix($prefix));

        return $prefix;
    }

    private function hasReservedLoaderSuffix(string $value): bool
    {
        $suffix = strtolower(substr($value, -2));

        return $suffix === 'kp' || $suffix === 'gt';
    }

    private function generateRandomString(int $length): string
    {
        $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        $value = '';
        $max = strlen($characters) - 1;

        for ($i = 0; $i < $length; $i++) {
            $value .= $characters[random_int(0, $max)];
        }

        return $value;
    }

    /**
     * @param array<string, string> $payload
     */
    private function fetchCustomLoaderScriptFromApi(string $containerId, ?string $apiKey, array $payload): ?string
    {
        try {
            $client = new Client(['timeout' => 12]);
            $headers = ['Content-Type' => 'application/json'];
            if ($apiKey !== null) {
                $headers['Authorization'] = 'Bearer ' . $apiKey;
            }

            $response = $this->requestCustomLoader($client, self::STAPE_API_BASE_GLOBAL, $containerId, $headers, $payload);
            if ($response->getStatusCode() === 404) {
                $response = $this->requestCustomLoader($client, self::STAPE_API_BASE_EU, $containerId, $headers, $payload);
            }

            if ($response->getStatusCode() !== 200) {
                return null;
            }

            return $this->extractCustomLoaderScript((string) $response->getBody());
        } catch (\Throwable $e) {
            $this->logger->warning('Stape custom loader API failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * @param array<string, string> $headers
     * @param array<string, string> $payload
     */
    private function requestCustomLoader(Client $client, string $baseUrl, string $containerId, array $headers, array $payload): \Psr\Http\Message\ResponseInterface
    {
        return $client->post(
            $baseUrl . '/' . $containerId . '/custom-loader',
            [
                'headers' => $headers,
                'http_errors' => false,
                'json' => $payload,
            ]
        );
    }

    private function extractCustomLoaderScript(string $body): ?string
    {
        $data = json_decode($body, true);
        $script = $data['body']['jsCode']
            ?? $data['body']['code']
            ?? $data['jsCode']
            ?? $data['code']
            ?? null;

        return is_string($script) && trim($script) !== '' ? $script : null;
    }

    private function buildStandardGtmScript(string $snippetId, string $customDomain): string
    {
        $gtmDomain = $this->normalizeUrl($customDomain);

        return sprintf(
            '<script async src="%s/gtm.js?id=%s"></script>',
            htmlspecialchars($gtmDomain, \ENT_QUOTES | \ENT_SUBSTITUTE, 'UTF-8'),
            htmlspecialchars($snippetId, \ENT_QUOTES | \ENT_SUBSTITUTE, 'UTF-8')
        );
    }

    /**
     * @param array{customDomain: string, prefix: string, loader: string, queryParameter: string, encodedString: string, addQueryParameter: string, cookieKeeper: bool} $settings
     */
    private function buildLocalCustomLoaderScript(array $settings): string
    {
        $loaderPrefix = $settings['prefix'] . ($settings['cookieKeeper'] ? 'kp' : '');
        $loaderUrl = sprintf(
            '%s/%s%s.js?%s=%s&%s',
            $this->normalizeUrl($settings['customDomain']),
            $loaderPrefix,
            $settings['loader'],
            $settings['queryParameter'],
            $settings['encodedString'],
            $settings['addQueryParameter']
        );

        return sprintf(
            '<!-- Google Tag Manager -->' . "\n"
            . '<script>' . "\n"
            . '(function(w,d,s,u,c){"use strict";var l="dataLayer";w[l]=w[l]||[];w[l].push({"gtm.start":new Date().getTime(),event:"gtm.js"});'
            . 'if(c){var p=d.cookie?d.cookie.split("; "):[];for(var i=0;i<p.length;i++){if(p[i].indexOf("_sbp=")===0){var v=p[i].substring(5);if(v&&v!=="1"&&v!=="true"){u+="&bi="+encodeURIComponent(v);break;}}}}'
            . 'var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src=u;if(f&&f.parentNode){f.parentNode.insertBefore(j,f);}else{d.head.appendChild(j);}})'
            . '(window,document,"script",%s,%s);' . "\n"
            . '</script>' . "\n"
            . '<!-- End Google Tag Manager -->',
            json_encode($loaderUrl, \JSON_THROW_ON_ERROR),
            $settings['cookieKeeper'] ? 'true' : 'false'
        );
    }

    private function normalizeUrl(string $url): string
    {
        $url = rtrim($url, '/');

        if (!preg_match('#^https?://#', $url)) {
            $url = 'https://' . $url;
        }

        return $url;
    }

    /**
     * @return array{domain: string, sameOriginPath: string|null}
     */
    private function parseCustomDomain(string $customDomain): array
    {
        $domain = preg_replace('#^https?://#', '', rtrim($customDomain, '/')) ?? '';
        $sameOriginPath = null;
        $slashPosition = strpos($domain, '/');

        if ($slashPosition !== false) {
            $sameOriginPath = substr($domain, $slashPosition);
            $domain = substr($domain, 0, $slashPosition);
        }

        return [
            'domain' => $domain,
            'sameOriginPath' => $sameOriginPath,
        ];
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function buildSettingsSignature(array $settings): string
    {
        return hash('sha256', json_encode([
            'containerId' => $settings['containerId'] ?? '',
            'apiKeyHash' => hash('sha256', (string) ($settings['apiKey'] ?? '')),
            'webGtmId' => $settings['webGtmId'] ?? '',
            'customDomain' => $this->normalizeUrl((string) ($settings['customDomain'] ?? '')),
            'prefix' => $settings['prefix'] ?? '',
            'loader' => $settings['loader'] ?? '',
            'queryParameter' => $settings['queryParameter'] ?? '',
            'encodedString' => $settings['encodedString'] ?? '',
            'addQueryParameter' => $settings['addQueryParameter'] ?? '',
            'cookieKeeper' => (bool) ($settings['cookieKeeper'] ?? false),
            'payload' => $settings['payload'] ?? [],
        ]));
    }

    /**
     * @return array{success: bool, source: string, status: string, script: string}
     */
    private function storeLoader(string $script, string $source, string $status, ?string $salesChannelId, ?string $signature = null): array
    {
        $this->systemConfigService->setMultiple([
            self::CONFIG_PREFIX . 'customLoaderScript' => $script,
            self::CONFIG_PREFIX . 'customLoaderSource' => $source,
            self::CONFIG_PREFIX . 'customLoaderStatus' => $status,
            self::CONFIG_PREFIX . 'customLoaderSignature' => $signature,
        ], $salesChannelId);

        $this->invalidateConfigCache($salesChannelId);

        return [
            'success' => true,
            'source' => $source,
            'status' => $status,
            'script' => $script,
            'forceApiFallback' => $this->getBool('forceApiFallback', $salesChannelId),
        ];
    }

    /**
     * @return array{success: bool, source: string, status: string, script: string|null, forceApiFallback: bool}
     */
    private function keepStoredLoader(string $script, string $source, string $status, ?string $salesChannelId): array
    {
        $this->systemConfigService->setMultiple([
            self::CONFIG_PREFIX . 'customLoaderSource' => $source,
            self::CONFIG_PREFIX . 'customLoaderStatus' => $status,
        ], $salesChannelId);

        $this->invalidateConfigCache($salesChannelId);

        return [
            'success' => true,
            'source' => $source,
            'status' => $status,
            'script' => $script !== '' ? $script : null,
            'forceApiFallback' => $this->getBool('forceApiFallback', $salesChannelId),
        ];
    }

    /**
     * @return array{success: bool, source: null, status: string, script: null}
     */
    private function clearStoredLoader(string $status, ?string $salesChannelId): array
    {
        $this->systemConfigService->setMultiple([
            self::CONFIG_PREFIX . 'customLoaderScript' => null,
            self::CONFIG_PREFIX . 'customLoaderSource' => null,
            self::CONFIG_PREFIX . 'customLoaderStatus' => $status,
            self::CONFIG_PREFIX . 'customLoaderSignature' => null,
        ], $salesChannelId);

        $this->invalidateConfigCache($salesChannelId);

        return [
            'success' => false,
            'source' => null,
            'status' => $status,
            'script' => null,
            'forceApiFallback' => $this->getBool('forceApiFallback', $salesChannelId),
        ];
    }

    private function getBool(string $key, ?string $salesChannelId = null): bool
    {
        return $this->systemConfigService->getBool(self::CONFIG_PREFIX . $key, $salesChannelId);
    }

    private function getString(string $key, ?string $salesChannelId = null): string
    {
        return trim((string) $this->systemConfigService->getString(self::CONFIG_PREFIX . $key, $salesChannelId));
    }

    private function invalidateConfigCache(?string $salesChannelId): void
    {
        $tags = [self::SYSTEM_CONFIG_CACHE_TAG_PREFIX . ($salesChannelId ?? '')];

        if ($salesChannelId === null) {
            try {
                foreach ($this->connection->fetchFirstColumn('SELECT id FROM sales_channel') as $id) {
                    if (is_string($id) && $id !== '') {
                        $tags[] = self::SYSTEM_CONFIG_CACHE_TAG_PREFIX . Uuid::fromBytesToHex($id);
                    }
                }
            } catch (\Throwable $e) {
                $this->logger->warning('Unable to collect sales channel config cache tags: ' . $e->getMessage());
            }
        }

        $this->cacheInvalidator->invalidate($tags, true);
    }
}
