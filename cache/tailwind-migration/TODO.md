# Tailwind Migration TODO

## Done

- [x] Inspect the last two commits and capture the current Tailwind bridge scope.
- [x] Create the migration tracker folder under `cache/tailwind-migration/`.

## In progress

- [ ] Inventory remaining MUI imports and rank the highest-traffic screens first.

## Next

- [ ] Migrate shared UI primitives from MUI to Tailwind.
- [ ] Convert landing and send surfaces to Tailwind-only styling.
- [ ] Replace icon wrappers and utility bridges that exist only for MUI compatibility.
- [ ] Remove MUI dependencies and the `lib/mui-tailwind` bridge after the last call site is gone.
