# Identité visuelle — Préfecture de Police LGP

## Direction

Portail de services communautaires du Grand Paname. Le site doit évoquer la clarté, la fiabilité et l'accès direct aux démarches. La refonte conserve le logo, les textes, les fonctions, la Marianne existante et le code bleu/blanc/rouge.

Le langage visuel s'inspire des surfaces nettes, des filets fins et de la hiérarchie typographique de l'étude IBM Carbon fournie par le plugin Awesome DESIGN.md. C'est une référence de méthode, pas une reprise de l'identité IBM. Le résultat reste propre au site LGP et à son univers français.

## Tokens

| Rôle | Valeur |
| --- | --- |
| Bleu institutionnel | `#000091` |
| Bleu foncé | `#00006d` |
| Rouge tricolore | `#e1000f` |
| Texte principal | `#161616` |
| Texte secondaire | `#525b66` |
| Fond secondaire | `#f3f5f9` |
| Bordure | `#d8dee8` |
| Rayon standard | `4px` |
| Échelle d'espacement | multiples de `4px` |

Le thème sombre réutilise les mêmes rôles sémantiques avec des surfaces et couleurs de texte adaptées.

## Règles d'interface

- Utiliser Marianne si elle est disponible, puis Public Sans et les polices système.
- Réserver le bleu aux liens, actions principales et repères de navigation. Le rouge marque les accents tricolores et quelques états.
- Construire la hiérarchie avec la taille, le poids, l'espace et les filets. Éviter les dégradés décoratifs, les ombres fortes et les grands ensembles de cartes uniformes.
- Garder des surfaces blanches, des fonds gris très légers et des bordures lisibles.
- Faire ressortir les actions au clavier avec un contour bleu franc.
- Préserver les contrastes, le thème sombre et l'ordre responsive mobile d'abord.
- Respecter `prefers-reduced-motion` et garder les transitions courtes.
- Utiliser en priorité les photographies et le logo déjà présents dans `assets/img`.

## Application

`assets/css/site-refresh.css` harmonise les pages publiques et le panneau admin sans ajouter de bibliothèque. Les styles existants et les parcours restent en place, ce qui facilite le retour arrière grâce à la branche de sauvegarde GitHub.

