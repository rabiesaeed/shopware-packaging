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
}
