# Claim Rules Migration

Source of truth studied: `ivancww/medicalclaims/main/script.js`.

The first migration extracts the exact currently implemented calculator mechanics into a DOM-independent engine so the new Medical UI does not inherit legacy architecture.

Migrated rules include Wise full/cap/cash/per-visit behaviour, Wise deductible subtraction, Flexi caps/daily caps/tiered daily cap/70% coinsurance, surgery dynamic caps, SMM 85% shortfall with HK$120,000 cap, and the existing surgery limit table.

Important: the three Wise network/room/follow-up conditions visible in legacy tooltip text are documented product constraints but are not fully encoded as calculation branches in the legacy calculator. They must therefore be normalized into Official `Claim_Rules` and verified against authoritative product data before we claim complete Ready production parity. We do not invent those missing branches.

Regression fixtures are in `tests/claim-engine-regression.js`. They verify representative outputs of the extracted legacy mechanics.