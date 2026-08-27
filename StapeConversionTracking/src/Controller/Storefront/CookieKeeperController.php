<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Controller\Storefront;

use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Core\System\SystemConfig\SystemConfigService;
use Shopware\Storefront\Controller\StorefrontController;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(defaults: ['_routeScope' => ['storefront']])]
class CookieKeeperController extends StorefrontController
{
    private const CONFIG_PREFIX = 'StapeConversionTracking.config.';
    private const COOKIE_NAME = '_sbp';
    private const COOKIE_LIFETIME_DAYS = 730;

    public function __construct(
        private readonly SystemConfigService $systemConfigService
    ) {
    }

    #[Route(
        path: '/stape/cookie-keeper/enable',
        name: 'frontend.stape.cookie_keeper.enable',
        defaults: ['XmlHttpRequest' => true, '_csrf_protected' => false],
        methods: ['POST']
    )]
    public function enable(Request $request, SalesChannelContext $salesChannelContext): JsonResponse
    {
        $salesChannelId = $salesChannelContext->getSalesChannelId();

        if (!$this->isCookieKeeperConfigured($salesChannelId)) {
            return new JsonResponse(['success' => false, 'message' => 'Cookie Keeper is not configured.'], 400);
        }

        $existingValue = (string) $request->cookies->get(self::COOKIE_NAME, '');
        if ($existingValue === '') {
            return new JsonResponse(['success' => false, 'message' => 'Cookie Keeper consent is missing.'], 403);
        }

        $value = $this->isPlaceholderValue($existingValue) ? $this->createUserIdentifier() : $existingValue;

        $response = new JsonResponse(['success' => true, 'value' => $value]);
        $response->headers->setCookie(new Cookie(
            self::COOKIE_NAME,
            $value,
            time() + (self::COOKIE_LIFETIME_DAYS * 86400),
            '/',
            $this->getCookieDomain($request->getHost()),
            $request->isSecure(),
            false,
            false,
            Cookie::SAMESITE_LAX
        ));

        return $response;
    }

    #[Route(
        path: '/stape/cookie-keeper/disable',
        name: 'frontend.stape.cookie_keeper.disable',
        defaults: ['XmlHttpRequest' => true, '_csrf_protected' => false],
        methods: ['POST']
    )]
    public function disable(Request $request): JsonResponse
    {
        $response = new JsonResponse(['success' => true]);
        $domain = $this->getCookieDomain($request->getHost());

        $this->expireCookie($response, null, $request->isSecure());

        if ($domain !== null) {
            $this->expireCookie($response, $domain, $request->isSecure());
        }

        return $response;
    }

    private function isCookieKeeperConfigured(?string $salesChannelId): bool
    {
        return $this->getBool('snippetActive', $salesChannelId)
            && $this->getString('snippetId', $salesChannelId) !== ''
            && $this->getBool('customDomainActive', $salesChannelId)
            && $this->getString('customDomain', $salesChannelId) !== ''
            && $this->getBool('customLoaderActive', $salesChannelId)
            && $this->getString('customLoader', $salesChannelId) !== ''
            && $this->getBool('cookieKeeper', $salesChannelId);
    }

    private function isPlaceholderValue(string $value): bool
    {
        return $value === '' || $value === '1' || $value === 'true';
    }

    private function createUserIdentifier(): string
    {
        return bin2hex(random_bytes(16));
    }

    private function expireCookie(JsonResponse $response, ?string $domain, bool $secure): void
    {
        $response->headers->setCookie(new Cookie(
            self::COOKIE_NAME,
            '',
            1,
            '/',
            $domain,
            $secure,
            false,
            false,
            Cookie::SAMESITE_LAX
        ));
    }

    private function getCookieDomain(string $host): ?string
    {
        $host = preg_replace('/:\d+$/', '', $host) ?? $host;

        if ($host === 'localhost' || filter_var($host, \FILTER_VALIDATE_IP)) {
            return null;
        }

        $parts = explode('.', $host);
        if (count($parts) <= 2) {
            return '.' . $host;
        }

        $tld = end($parts);
        $secondLevelDomain = $parts[count($parts) - 2];

        if (strlen((string) $tld) === 2 && strlen($secondLevelDomain) <= 3 && count($parts) >= 3) {
            return '.' . implode('.', array_slice($parts, -3));
        }

        return '.' . implode('.', array_slice($parts, -2));
    }

    private function getBool(string $key, ?string $salesChannelId): bool
    {
        return $this->systemConfigService->getBool(self::CONFIG_PREFIX . $key, $salesChannelId);
    }

    private function getString(string $key, ?string $salesChannelId): string
    {
        return trim((string) $this->systemConfigService->getString(self::CONFIG_PREFIX . $key, $salesChannelId));
    }
}
