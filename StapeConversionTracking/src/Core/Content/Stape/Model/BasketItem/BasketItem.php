<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Core\Content\Stape\Model\BasketItem;

final class BasketItem
{
    public function __construct
    (
        private readonly string $itemName,
        private readonly string $itemId,
        private readonly float  $price,
        private readonly int    $quantity,
    )
    {
    }

    public function toArray(): array
    {
        return
            array_filter([
                "item_name" => $this->itemName ?: "",
                "item_id" => $this->itemId ?: "",
                "price" => $this->price ?: "",
                "quantity" => $this->quantity ?: ""
            ]);
    }
}