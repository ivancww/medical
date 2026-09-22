# AVA Medical — Agent Rules

This repository is an AVA Independent App. Before modifying it, coding agents must read and enforce the current authoritative sources in `ivancww/avaplatform` in this order:

1. Root `AGENTS.md`
2. `docs/MOTHER-RULES.md`
3. `design-system/DESIGN-SYSTEM.md` and relevant canonical implementation
4. This repository's `docs/PRODUCT-RULES.md` and current app code/data

AVA Platform remains the Mother Platform + Overall Work Platform. This repository remains independent; do not copy or merge its source into AVA Platform.

Shared architecture, design, responsive behaviour, navigation, PWA/data integration patterns and experience modes follow the current Mother Rules and canonical Design System. App-specific Medical workflow, calculations, data mapping and product rules belong here.

Do not use another Independent App as architectural or visual authority. `medicalclaims` and CRM may only be studied for explicitly authorized app-specific calculation/data/AI integration references.

Respect fixed functional pages, Official vs User data ownership, local-first behaviour, and the AVA experience principle: Easy for Agent → Natural Conversation → Instant Visualization → Easy for Customer.

Use the smallest coherent change. Test changed scope and regressions. Never report an unexecuted test as PASS. Do not merge a pull request unless explicitly instructed.
