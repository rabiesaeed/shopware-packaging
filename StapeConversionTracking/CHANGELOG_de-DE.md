# 1.0.8
- Lokales Custom-Loader-Fallback korrigiert, wenn die Stape API nicht erreichbar ist

# 1.0.7
- Shopware-Kompatibilitaetsbereich auf `>=6.6.8.0 <6.8.0` zurueckgesetzt
- Cookie-Keeper-Registrierung mit Legacy-Cookie-Providern und dem neueren Cookie-Collection-Flow ab `6.7.3` kompatibel gemacht
- Kompatibilitaet der Administration-Komponentenregistrierung zwischen Shopware `6.6` und `6.7` verbessert

# 1.0.6
- Kompatibilitaet des Add-to-Cart-Trackings mit Drittanbieter-Plugins korrigiert, die das Shopware-Plugin `AddToCart` anpassen, einschliesslich SHOPSY Klaviyo Integration
- Stape-Override fuer `AddToCart` durch ein separates Observer-Plugin ersetzt, damit Stape nur erfolgreiche Add-to-Cart-Ereignisse beobachtet und das Warenkorbverhalten nicht veraendert

# 1.0.5
- Shopware-Kompatibilitätsbereich auf `>=6.7.3.0 <6.8.0` aktualisiert
- Loader auf das Laden über die Stape API umgestellt, der bestehende Loader bleibt als Fallback erhalten
- Cookie-Keeper-Verarbeitung korrigiert
- Header `x-stape-app-version` zu Webhook-Anfragen hinzugefügt

# 1.0.4
- Behebung der Storefront-Kompatibilität mit Drittanbieter-Plugins, die den Shopware-Block `base_body` erweitern, einschließlich SHOPSY Klaviyo Integration
- Ersetzung der benutzerdefinierten `base_body`-Rekonstruktion durch eine minimale Erweiterung von `base_body_script`, damit von Plugins bereitgestellte Body-Inhalte erhalten bleiben

# 1.0.3
- Behebung eines Problems beim Laden des Stape GTM-Skripts nach dem Akzeptieren von Cookies ohne Neuladen der Seite
- Behebung der Shopware-Cookie-Consent-Verarbeitung über den globalen Cookie-Emitter
- Behebung eines Problems bei der Ausführung von Data-Layer-Templates bei Verwendung von document.currentScript

# 1.0.2
- Behebung eines Kompatibilitätsproblems mit verschiedenen Plugins auf dem Markt

# 1.0.1
- Behebung eines Problems mit der Template-Vererbung und dem Aufruf des übergeordneten Kontexts in Blöcken in Twig-Dateien

# 1.0.0
- Integration mit einer serverseitigen Tracking-Plattform
