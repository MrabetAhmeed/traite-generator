# 🏦 Traite Generator — Lettre de Change

Système de génération de lettres de change (traites) pour la République Tunisienne.

## Installation

```bash
npm install
```

## Démarrage

```bash
npm start
```

Puis ouvrez **http://localhost:3000** dans votre navigateur.

## Utilisation

1. Remplissez le formulaire avec les informations de la traite
2. Cliquez **Aperçu** pour vérifier les valeurs qui seront imprimées
3. Cliquez **Générer la Traite PDF** pour télécharger le PDF
4. Imprimez le PDF sur le papier de traite officiel

## Champs

| Champ | Format | Zones |
|-------|--------|-------|
| Date d'échéance | JJ/MM/AAAA | ×2 |
| Date d'édition | JJ/MM/AAAA | ×2 |
| Ville | texte libre → MAJUSCULES | ×2 |
| RIB | 20 chiffres | ×2 |
| Montant | 2500,500 (dinars,millimes) | ×2 |
| Montant en lettres | généré automatiquement | ×1 |
| À l'ordre de | texte libre → MAJUSCULES | ×1 |
| Payeur | texte libre → MAJUSCULES | ×1 |
| Banque | texte libre → MAJUSCULES | ×1 |

## Format d'affichage

- **Montant** : `## 2 500,500 ##`
- **Montant en lettres** : `## DEUX MILLE CINQ CENTS DINARS CINQ CENTS MILLIMES ##`
- **Textes** : convertis automatiquement en MAJUSCULES

## Structure du projet

```
traite-generator/
├── server.js              # Serveur Express + génération PDF
├── public/
│   └── index.html         # Interface utilisateur
├── template/
│   └── traite_template.pdf  # Template vierge de la traite
├── package.json
└── README.md
```

## Technique

- **Backend** : Node.js + Express
- **Génération PDF** : pdf-lib (overlay de texte sur template)
- **Police** : Helvetica Bold (claire pour impression)
- **Coordonnées** : extraites par analyse colorimétrique du zone mapping PDF

## Calibration des zones

Les coordonnées de chaque champ ont été extraites automatiquement depuis le fichier
`zone_mapping.pdf` en analysant les rectangles colorés :

| Couleur | Champ |
|---------|-------|
| 🔴 `#FF0000` | Date d'échéance |
| 🔵 `#0066FF` | Ville |
| 🟢 `#00AA00` | Date d'édition |
| 🟡 `#FFD400` | RIB |
| 🟠 `#FF7A00` | Montant |
| 🟣 `#8A2BE2` | Montant en lettres |
| 🩷 `#FF4DA6` | À l'ordre de |
| ⬜ `#666666` | Payeur |
| 🩵 `#00C8C8` | Banque |
