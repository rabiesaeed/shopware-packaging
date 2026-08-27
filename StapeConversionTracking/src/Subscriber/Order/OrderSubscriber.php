<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Subscriber\Order;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Shopware\Core\Checkout\Cart\LineItem\LineItem;
use Shopware\Core\Checkout\Order\Aggregate\OrderAddress\OrderAddressEntity;
use Shopware\Core\Checkout\Order\Aggregate\OrderCustomer\OrderCustomerEntity;
use Shopware\Core\Checkout\Order\Aggregate\OrderTransaction\OrderTransactionDefinition;
use Shopware\Core\Checkout\Order\Aggregate\OrderTransaction\OrderTransactionStates;
use Shopware\Core\Checkout\Order\OrderEntity;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\EqualsFilter;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Core\System\StateMachine\Event\StateMachineTransitionEvent;
use Shopware\Storefront\Page\Checkout\Finish\CheckoutFinishPageLoadedEvent;
use Stape\ConversionTracking\Core\Content\Stape\Model\BasketItem\BasketItem;
use Stape\ConversionTracking\Core\Content\Stape\Model\Cookie\Cookie;
use Stape\ConversionTracking\Core\Content\Stape\Model\Customer\Customer;
use Stape\ConversionTracking\Core\Content\Stape\Model\Ecommerce\Ecommerce;
use Stape\ConversionTracking\Core\Content\Stape\Model\Order\Order;
use Stape\ConversionTracking\Service\Util\ConfigExtractor;
use Stape\ConversionTracking\StapeConversionTracking;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Serializer\Encoder\JsonEncoder;

class OrderSubscriber implements EventSubscriberInterface
{
    public function __construct
    (
        private readonly ConfigExtractor  $configExtractor,
        private readonly EntityRepository $orderRepository,
        private readonly RequestStack     $requestStack
    )
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            CheckoutFinishPageLoadedEvent::class => 'onCheckoutFinishEvent',
            StateMachineTransitionEvent::class => 'onStateTransition'
        ];
    }

    public function onStateTransition(StateMachineTransitionEvent $event): void
    {
        if (
            $this->configExtractor->isRefundWebhookActive() === false ||
            $event->getEntityName() !== OrderTransactionDefinition::ENTITY_NAME ||
            $this->configExtractor->isWebhookSectionActive() === false
        ) {
            return;
        }

        $toState = $event->getToPlace()->getTechnicalName();

        if ($toState !== OrderTransactionStates::STATE_REFUNDED) {
            return;
        }

        $transactionId = $event->getEntityId();
        $orderEntity = $this->getOrder($transactionId, $event->getContext());

        if (!$orderEntity) {
            return;
        }

        $webhookUrl = $this->configExtractor->extractWebhookUrl();
        if (!$webhookUrl) {
            return;
        }
        $stapeRefundEventData = $this->buildStapeOrderRequest
        (
            order: $orderEntity,
            event: ConfigExtractor::STAPE_REFUND_EVENT
        );

        $this->sendStapeRequest(
            webhookUrl: $webhookUrl,
            stapeData: $stapeRefundEventData?->toArray()
        );
    }

    public function onCheckoutFinishEvent(CheckoutFinishPageLoadedEvent $event): void
    {
        $order = $event->getPage()->getOrder();

        $orderCustomFields = $order->getCustomFields() ?? [];
        if (array_key_exists('stape_processed', $orderCustomFields) && $orderCustomFields['stape_processed'] === true) {
            return;
        }
        if ($this->configExtractor->isPurchaseWebhookActive() === false || $this->configExtractor->isWebhookSectionActive() === false) {
            return;
        }

        $webhookUrl = $this->configExtractor->extractWebhookUrl();
        if (!$webhookUrl) {
            return;
        }
        $salesChannelContext = $event->getSalesChannelContext();
        $stapePurchaseEventData = $this->buildStapeOrderRequest
        (
            order: $order,
            salesChannelContext: $salesChannelContext,
            event: ConfigExtractor::STAPE_PURHASE_EVENT
        );

        $this->sendStapeRequest(
            webhookUrl: $webhookUrl,
            stapeData: $stapePurchaseEventData?->toArray()
        );

        $this->orderRepository->upsert([
            [
                'id' => $order->getId(),
                'customFields' => [
                    'stape_processed' => true
                ]
            ]
        ], $salesChannelContext->getContext());
    }

    private function buildStapeOrderRequest(OrderEntity $order, ?SalesChannelContext $salesChannelContext = null, string $event = ""): ?Order
    {
        $cookies = $this->requestStack->getCurrentRequest()?->cookies->all() ?? [];
        $stapeCookies = array_intersect_key($cookies, (new Cookie())->toArray());

        return new Order(
            event: $event,
            userData: $this->buildUserData($order->getOrderCustomer(), $order->getBillingAddress()),
            ecommerce: $this->buildEcommerceData($order, $salesChannelContext),
            cookies: array_filter($stapeCookies)
        );
    }

    private function buildUserData(?OrderCustomerEntity $orderCustomer, ?OrderAddressEntity $orderAddress): array
    {
        $userDto = new Customer
        (
            email: $orderCustomer?->getEmail(),
            firstName: $orderCustomer?->getFirstName(),
            lastName: $orderCustomer?->getLastName(),
            phone: $orderAddress?->getPhoneNumber(),
            country: $orderAddress?->getCountry()?->getName(),
            region: $orderAddress?->getCountryState()?->getName() ?? "",
            street: $orderAddress?->getStreet(),
            city: $orderAddress?->getCity(),
            zip: $orderAddress?->getZipCode(),
            customerId: $orderCustomer?->getCustomerNumber()
        );

        return $userDto->toArray();
    }

    private function buildEcommerceData(OrderEntity $order, ?SalesChannelContext $salesChannelContext = null): array
    {
        $orderTotalWithoutDiscounts = 0.00;
        $mergedDiscounts = [];

        $basketItems = [];
        foreach ($order->getLineItems() as $orderLineItem) {

            if ($orderLineItem->getType() === LineItem::PROMOTION_LINE_ITEM_TYPE) {
                $mergedDiscounts[] = (array_key_exists('code', $orderLineItem->getPayload()) && $orderLineItem->getPayload()['code'] !== "") ? $orderLineItem->getPayload()['code'] : $orderLineItem->getLabel();
                continue;
            }
            $lineItemPayload = $orderLineItem->getPayload();

            $basketItem = new BasketItem
            (
                itemName: $orderLineItem?->getLabel(),
                itemId: $lineItemPayload['productNumber'] ?? $orderLineItem?->getProductId(),
                price: $orderLineItem?->getTotalPrice(),
                quantity: $orderLineItem?->getQuantity()
            );

            $basketItems[] = $basketItem->toArray();
            $orderTotalWithoutDiscounts += $orderLineItem?->getTotalPrice();
        }

        $ecommerceDto = new Ecommerce
        (
            transactionId: $order->getOrderNumber(),
            value: $order->getAmountTotal(),
            tax: $order->getAmountTotal() - $order->getAmountNet(),
            shipping: $order->getShippingTotal(),
            coupon: implode(",", $mergedDiscounts),
            discountAmount: $orderTotalWithoutDiscounts - $order->getAmountTotal(),
            currency: $salesChannelContext?->getCurrency()?->getIsoCode() ?? $order->getCurrency()?->getIsoCode(),
            basketItems: $basketItems
        );

        return $ecommerceDto->toArray();

    }

    private function getOrder(string $orderTransactionId, Context $context): ?OrderEntity
    {
        $criteria = new Criteria();
        $criteria->addFilter(
            new EqualsFilter('transactions.id', $orderTransactionId)
        );
        $criteria->addAssociations([
            'orderCustomer',
            'orderCustomer.salutation',
            'lineItems',
            'deliveries.shippingMethod',
            'deliveries.shippingOrderAddress.country',
            'deliveries.shippingOrderAddress.countryState',
            'deliveries.stateMachineState',
            'currency',
            'addresses.country',
            'billingAddress.country',
            'billingAddress.countryState'
        ]);

        return $this->orderRepository->search($criteria, $context)->first();
    }

    private function sendStapeRequest(string $webhookUrl, array $stapeData): void
    {
        try {
            $client = new Client();

            $client->request(
                Request::METHOD_POST,
                $webhookUrl,
                [
                    'headers' => [
                        'content-type' => 'application/json',
                        'Accept' => 'application/json',
                        'x-stape-app-version' => StapeConversionTracking::APP_VERSION,
                    ],
                    'auth' => [

                    ],
                    'body' => (new JsonEncoder())->encode($stapeData, JsonEncoder::FORMAT)
                ]
            );
        } catch (GuzzleException $e) {

        }
    }
}
