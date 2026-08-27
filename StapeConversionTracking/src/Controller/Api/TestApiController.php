<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Controller\Api;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Stape\ConversionTracking\StapeConversionTracking;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Shopware\Core\Framework\Context;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(defaults: ['_routeScope' => ['api']])]
class TestApiController extends AbstractController
{
    public const STAPE_REFUND_WEBHOOK = "refund_stape_webhook";

    #[Route(path: '/api/stape/webhook-test', name: 'stape.webhook.test.api', methods: ['POST'])]
    public function load(Context $context, Request $request): JsonResponse
    {
        $stapeData = $request->get('data', []);
        $client = new Client();

        if (!\is_array($stapeData) || empty($stapeData['url'])) {
            return new JsonResponse(['success' => false]);
        }

        try {
            $purchaseResponse = $client->post($stapeData['url'], [
                'headers' => [
                    'x-stape-app-version' => StapeConversionTracking::APP_VERSION,
                ],
                'json' => $stapeData,
            ]);

            $stapeData['event'] = self::STAPE_REFUND_WEBHOOK;

            $refundResponse = $client->post($stapeData['url'], [
                'headers' => [
                    'x-stape-app-version' => StapeConversionTracking::APP_VERSION,
                ],
                'json' => $stapeData,
            ]);

            if ($purchaseResponse->getStatusCode() === 200 && $refundResponse->getStatusCode() === 200) {
                return new JsonResponse(['success' => true]);
            }
        } catch (GuzzleException $e) {
            return new JsonResponse(['success' => false]);
        }
        return new JsonResponse(['credentialsValid' => true]);
    }
}
