<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Core\Content\Stape\Model\Order;

final class Order
{
    public function __construct
    (
        private readonly string $event,
        private readonly array  $userData,
        private readonly array  $ecommerce,
        private readonly array  $cookies
    )
    {
    }

    public function toArray(): array
    {
        return
            [
                'event' => $this->event,
                'user_data' => $this->userData,
                'ecommerce' => $this->ecommerce,
                'cookies' => $this->cookies
            ];
    }
}