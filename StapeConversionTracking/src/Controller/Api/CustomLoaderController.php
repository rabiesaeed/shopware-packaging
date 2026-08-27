<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Controller\Api;

use Shopware\Core\Framework\Context;
use Stape\ConversionTracking\Service\CustomLoaderService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(defaults: ['_routeScope' => ['api']])]
class CustomLoaderController extends AbstractController
{
    public function __construct(
        private readonly CustomLoaderService $customLoaderService
    ) {
    }

    #[Route(path: '/api/stape/custom-loader/refresh', name: 'api.stape.custom_loader.refresh', methods: ['POST'])]
    public function refresh(Request $request, Context $context): JsonResponse
    {
        $result = $this->customLoaderService->generateAndStoreCustomLoader(
            $request->get('salesChannelId'),
            true
        );

        return new JsonResponse($result, $result['success'] ? 200 : 400);
    }

    #[Route(path: '/api/stape/custom-loader/fallback-mode', name: 'api.stape.custom_loader.fallback_mode', methods: ['POST'])]
    public function fallbackMode(Request $request, Context $context): JsonResponse
    {
        $payload = [];
        if ($request->getContent() !== '') {
            try {
                $payload = $request->toArray();
            } catch (\Throwable) {
                $payload = [];
            }
        }

        $enabled = filter_var($payload['enabled'] ?? $request->get('enabled'), \FILTER_VALIDATE_BOOLEAN);

        $result = $this->customLoaderService->setForceApiFallback(
            $enabled,
            $payload['salesChannelId'] ?? $request->get('salesChannelId')
        );

        return new JsonResponse($result, $result['success'] ? 200 : 400);
    }

    #[Route(path: '/api/stape/custom-loader/remove', name: 'api.stape.custom_loader.remove', methods: ['POST'])]
    public function remove(Request $request, Context $context): JsonResponse
    {
        $payload = [];
        if ($request->getContent() !== '') {
            try {
                $payload = $request->toArray();
            } catch (\Throwable) {
                $payload = [];
            }
        }

        $result = $this->customLoaderService->removeStoredCustomLoader(
            $payload['salesChannelId'] ?? $request->get('salesChannelId')
        );

        return new JsonResponse($result);
    }
}
