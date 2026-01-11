# Extension Icons

L'extension nécessite 3 tailles d'icônes :
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

## Génération rapide des icônes

### Option 1 : Utiliser un générateur en ligne
1. Aller sur https://www.favicon-generator.org/
2. Upload une image (suggestion : icône d'enveloppe avec un checkmark)
3. Télécharger les tailles 16x16, 48x48, 128x128

### Option 2 : Créer avec ImageMagick
```bash
# Créer une icône simple avec texte
convert -size 128x128 xc:white \
  -gravity center \
  -pointsize 80 \
  -fill '#4CAF50' \
  -annotate +0+0 '✓' \
  icon128.png

# Redimensionner pour les autres tailles
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

### Option 3 : Placeholder temporaire
En attendant, vous pouvez utiliser des icônes placeholder :
- Copier n'importe quelle image PNG et la renommer
- L'extension fonctionnera même avec des icônes non optimales

## Design suggéré

Pour un look professionnel, utilisez :
- Fond : Blanc ou transparent
- Symbole : Enveloppe avec double checkmark (✓✓)
- Couleur : Vert (#4CAF50) pour le checkmark
- Style : Flat design, minimaliste
