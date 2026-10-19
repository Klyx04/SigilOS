---
name: sentry-triage
description: Utiliser quand on parle d'une erreur Sentry, d'un 500 en production, d'une régression ou d'une alerte. Impose la mesure avant la cause : issue, occurrences, stack, release, trace, corrélation guilde, puis test de non-régression.
---
# Tri Sentry

1. `search_issues` (ou `search_errors`) sur le symptôme + période + environnement.
2. `get_sentry_resource` sur l'issue : stack, release, firstSeen/lastSeen, tags.
3. `search_traces` pour la requête lente ou l'erreur corrélée.
4. Formuler une **cause racine mesurée**, jamais une hypothèse.
5. Reproduire en local ou écrire un test qui échoue.
6. Corriger au bon étage, test vert, PR.
7. Si l'issue est un faux positif : la documenter et la fermer avec justification.

Ne jamais publier de token, snowflake ou e-mail dans le rapport.