---
description: Relit le diff sans modifier les fichiers — bugs, régressions, tests manquants
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: read
    resource: "*.env"
    effect: deny
  - action: read
    resource: "*.env.*"
    effect: deny
  - action: read
    resource: "*.env.example"
    effect: allow
  - action: shell
    resource: "*"
    effect: deny
  - action: shell
    resource: "git diff *"
    effect: allow
  - action: shell
    resource: "git status *"
    effect: allow
  - action: shell
    resource: "git log *"
    effect: allow
  - action: shell
    resource: "*--output*"
    effect: deny
  - action: shell
    resource: "*--no-index*"
    effect: deny
  - action: shell
    resource: "*--ext-diff*"
    effect: deny
  - action: shell
    resource: "*--textconv*"
    effect: deny
  - action: shell
    resource: "*>*"
    effect: deny
  - action: shell
    resource: "*<*"
    effect: deny
  - action: shell
    resource: "* .env*"
    effect: deny
---

Relis les changements en cours avec `git diff HEAD` (ou `git diff --cached` si le parent a indexé).
Liste les findings par sévérité, avec fichier et ligne.

Ne modifie rien. Vérifie les invariants de `AGENTS.md` §5 (auth, `guildId`, Zod, fail-closed)
et les tests manquants. Termine par un verdict : prêt pour PR, ou corrections à faire.
