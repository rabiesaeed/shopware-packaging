<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Service\Util;

use Shopware\Core\System\SystemConfig\SystemConfigService;

class ConfigExtractor
{
    public const STAPE_SERVER_CONVERSION_TRACKING_PLUGIN_PREFIX = 'StapeConversionTracking.config.';
    public const STAPE_PURHASE_EVENT = 'purchase_stape_webhook';
    public const STAPE_REFUND_EVENT = 'refund_stape_webhook';


    public function __construct
    (
        private readonly SystemConfigService $systemConfigService
    )
    {
    }

    public function extractWebhookUrl(): string
    {
        return (string) $this->systemConfigService->getString(self::STAPE_SERVER_CONVERSION_TRACKING_PLUGIN_PREFIX . 'serverContainerUrl');
    }

    public function isWebhookSectionActive(): bool
    {
        return $this->systemConfigService->getBool(self::STAPE_SERVER_CONVERSION_TRACKING_PLUGIN_PREFIX . 'sendWebhooks') ?? false;

    }

    public function isRefundWebhookActive(): bool
    {
        return $this->systemConfigService->getBool(self::STAPE_SERVER_CONVERSION_TRACKING_PLUGIN_PREFIX . 'refundWebhook') ?? false;
    }

    public function isPurchaseWebhookActive(): bool
    {
        return $this->systemConfigService->getBool(self::STAPE_SERVER_CONVERSION_TRACKING_PLUGIN_PREFIX . 'purchaseWebhook') ?? false;
    }
}
