<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Core\Content\Stape\Model\Ecommerce;

use Stape\ConversionTracking\Core\Content\Stape\Model\BasketItem\BasketItem;

final class Ecommerce
{
    public function __construct
    (
        private readonly ?string $transactionId,
        private readonly ?float $value,
        private readonly ?float  $tax,
        private readonly ?float  $shipping,
        private readonly ?string $coupon,
        private readonly ?float $discountAmount,
        private readonly ?string $currency,
        private readonly ?array  $basketItems,
    )
    {
    }

    public function toArray(): array
    {
        return array_filter([
            "transaction_id" => $this->transactionId ?: "",
            "value" => $this->value ?: 0.00,
            "tax" => round($this->tax ?: 0.00),
            "shipping" => $this->shipping ?: 0.00,
            "coupon" => $this->coupon ?: "",
            "discount_amount" => $this->discountAmount ?: 0.00,
            "currency" => $this->currency ?: "",
            "items" => $this->basketItems ?: []
        ]);
    }
}

