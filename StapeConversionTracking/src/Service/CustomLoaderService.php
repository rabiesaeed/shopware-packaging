<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Service;

use GuzzleHttp\Client;
use Psr\Log\LoggerInterface;
use Shopware\Core\System\SystemConfig\SystemConfigService;

class CustomLoaderService
{
    private const STAPE_API_BASE = 'https://api.app.stape.io/api/v2/container';
    private const CONFIG_PREFIX = 'StapeConversionTracking.config.';
    private const SOURCE_API = 'api';
    private const SOURCE_FALLBACK = 'fallback';

    public function __construct(
        private readonly SystemConfigService $systemConfigService,
        private readonly LoggerInterface $logger
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

        $apiScript = $this->fetchCustomLoaderScriptFromApi($settings['containerId'], $settings['apiKey'], $settings['payload']);

        if ($apiScript !== null) {
            return $this->storeLoader($apiScript, self::SOURCE_API, 'Loader generated via Stape API.', $salesChannelId, $signature);
        }

        return $this->keepStoredLoader(
            $storedScript,
            self::SOURCE_FALLBACK,
            'Stape API failed; existing custom loader from database kept unchanged.',
            $salesChannelId
        );
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
            $headers = ['Content-Type' => 'application/json'];
            if ($apiKey !== null) {
                $headers['Authorization'] = 'Bearer ' . $apiKey;
            }

            $response = (new Client(['timeout' => 12]))->post(
                self::STAPE_API_BASE . '/' . $containerId . '/custom-loader',
                [
                    'headers' => $headers,
                    'json' => $payload,
                ]
            );

            if ($response->getStatusCode() !== 200) {
                return null;
            }

            $data = json_decode((string) $response->getBody(), true);
            $script = $data['body']['jsCode']
                ?? $data['body']['code']
                ?? $data['jsCode']
                ?? $data['code']
                ?? null;

            return is_string($script) && trim($script) !== '' ? $script : null;
        } catch (\Throwable $e) {
            $this->logger->warning('Stape custom loader API failed: ' . $e->getMessage());
            return null;
        }
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

        return [
            'success' => true,
            'source' => $source,
            'status' => $status,
            'script' => $script,
        ];
    }

    /**
     * @return array{success: bool, source: string, status: string, script: string|null}
     */
    private function keepStoredLoader(string $script, string $source, string $status, ?string $salesChannelId): array
    {
        $this->systemConfigService->setMultiple([
            self::CONFIG_PREFIX . 'customLoaderSource' => $source,
            self::CONFIG_PREFIX . 'customLoaderStatus' => $status,
        ], $salesChannelId);

        return [
            'success' => true,
            'source' => $source,
            'status' => $status,
            'script' => $script !== '' ? $script : null,
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

        return [
            'success' => false,
            'source' => null,
            'status' => $status,
            'script' => null,
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
}
