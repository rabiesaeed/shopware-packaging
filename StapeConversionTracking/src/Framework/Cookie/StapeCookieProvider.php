<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Framework\Cookie;

use Shopware\Storefront\Framework\Cookie\CookieProviderInterface;

class StapeCookieProvider implements CookieProviderInterface
{
    private const COOKIE_NAME = '_sbp';
    private const MARKETING_GROUP = 'cookie.groupMarketing';

    public function __construct(
        private readonly CookieProviderInterface $decorated
    ) {
    }

    public function getCookieGroups(): array
    {
        $cookieGroups = $this->decorated->getCookieGroups();

        foreach ($cookieGroups as &$cookieGroup) {
            if (($cookieGroup['snippet_name'] ?? null) !== self::MARKETING_GROUP) {
                continue;
            }

            $cookieGroup['entries'] = $this->addCookieKeeperEntry($cookieGroup['entries'] ?? []);

            return $cookieGroups;
        }
        unset($cookieGroup);

        $cookieGroups[] = [
            'snippet_name' => self::MARKETING_GROUP,
            'snippet_description' => 'cookie.groupMarketingDescription',
            'entries' => $this->addCookieKeeperEntry([]),
        ];

        return $cookieGroups;
    }

    private function addCookieKeeperEntry(array $entries): array
    {
        foreach ($entries as $entry) {
            if (($entry['cookie'] ?? null) === self::COOKIE_NAME) {
                return $entries;
            }
        }

        $entries[] = [
            'snippet_name' => 'stape-server-gtm.cookies.session',
            'cookie' => self::COOKIE_NAME,
            'value' => '1',
            'expiration' => '730',
        ];

        return $entries;
    }
}
