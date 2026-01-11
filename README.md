# Mail Tracker - Chrome Extension

Extension Chrome pour tracker l'ouverture des emails envoyés depuis Gmail.

## Fonctionnalités

- Injection automatique d'un pixel de tracking lors de l'envoi d'emails
- Affichage de ticks (✓ / ✓✓) dans l'interface Gmail
  - ✓ = Email envoyé et tracké
  - ✓✓ = Email ouvert par le destinataire
- Synchronisation avec le backend pour le tracking en temps réel

## Installation

### 1. Installation en mode développeur

1. Ouvrir Chrome et aller sur `chrome://extensions/`
2. Activer le "Mode développeur" (en haut à droite)
3. Cliquer sur "Charger l'extension non empaquetée"
4. Sélectionner le dossier `add-on/`

### 2. Configuration

1. Cliquer sur l'icône de l'extension dans la barre d'outils
2. Configurer l'URL de l'API (par défaut: `http://localhost:3000`)
3. Cliquer sur "Save Settings"

## Utilisation

1. Ouvrir Gmail (https://mail.google.com)
2. Composer un nouvel email
3. Écrire et envoyer normalement
4. L'extension injecte automatiquement le pixel de tracking
5. Les ticks apparaissent dans votre boîte d'envoi :
   - ✓ = Email envoyé
   - ✓✓ = Email ouvert

## Architecture

```
add-on/
├── manifest.json           # Configuration extension (Manifest V3)
├── popup.html              # Interface popup
├── scripts/
│   ├── config.js          # Configuration API
│   ├── popup.js           # Logique popup
│   ├── background.js      # Service worker (communication API)
│   └── content.js         # Script injecté dans Gmail
└── styles/
    └── content.css        # Styles pour l'UI Gmail
```

## Permissions requises

- `storage` - Pour stocker les emails trackés et la configuration
- `activeTab` - Pour accéder à Gmail
- `https://mail.google.com/*` - Pour injecter le script dans Gmail
- `http://localhost:3000/*` - Pour communiquer avec l'API locale

## Développement

L'extension utilise :
- **Manifest V3** (dernière version)
- **Service Worker** pour le background
- **Content Script** pour modifier Gmail
- **Chrome Storage API** pour la persistance

## Limitations connues

- Fonctionne uniquement avec Gmail (pas Outlook, Yahoo, etc.)
- Les images doivent être activées chez le destinataire
- Les proxy mail (Apple Mail Privacy) peuvent donner des faux positifs
