<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Core\Content\Stape\Model\Customer;

final class Customer
{
    public function __construct
    (
        private readonly ?string $email,
        private readonly ?string $firstName,
        private readonly ?string $lastName,
        private readonly ?string $phone,
        private readonly ?string $country,
        private readonly ?string $region,
        private readonly ?string $street,
        private readonly ?string $city,
        private readonly ?string $zip,
        private readonly ?string $customerId
    )
    {
    }

    public function toArray(): array
    {
        return array_filter([
            "email" => $this->email ?: "",
            "first_name" => $this->firstName ?: "",
            "last_name" => $this->lastName ?: "",
            "phone" => $this->phone ?: "",
            "country" => $this->country ?: "",
            "region" => $this->region ?: "",
            "street" => $this->street ?: "",
            "city" => $this->city ?: "",
            "zip" => $this->zip ?: "",
            "customer_id" => $this->customerId ?: "",
        ]);
    }
}