# 1.0.8
- Fixed local custom-loader fallback rendering when the Stape API is unavailable.

# 1.0.7
- Restored Shopware compatibility range to `>=6.6.8.0 <6.8.0`
- Made Cookie Keeper registration compatible with both legacy Shopware cookie providers and the newer `6.7.3+` cookie collection flow
- Improved administration component registration compatibility across Shopware `6.6` and `6.7`

# 1.0.6
- Fixed add-to-cart tracking compatibility with third-party plugins that customize Shopware's `AddToCart` plugin, including SHOPSY Klaviyo Integration
- Replaced the Stape `AddToCart` override with a separate observer plugin so Stape only listens for successful add-to-cart events without changing cart behavior

# 1.0.5
- Updated Shopware compatibility range to `>=6.7.3.0 <6.8.0`
- Switched the loader to load via the Stape API, while keeping the existing loader as a fallback
- Fixed Cookie Keeper handling
- Added the `x-stape-app-version` header to webhook requests

# 1.0.4
- Fixed Storefront compatibility with third-party plugins that extend the Shopware `base_body` block, including SHOPSY Klaviyo Integration
- Replaced the custom `base_body` reconstruction with a minimal `base_body_script` extension to preserve plugin-provided body content

# 1.0.3
- Fixing issue with loading Stape GTM script after accepting cookies without page reload
- Fixing Shopware cookie consent update handling via global cookie emitter
- Fixing data layer template execution issue when using document.currentScript

# 1.0.2
- Fixing issue with compatibility with different plugin on market

# 1.0.1
- Fixing template inheritance issue and calling parent context in blocks in twig files

# 1.0.0
- Integration with Server-Side tracking platform
