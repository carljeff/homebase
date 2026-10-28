# Local validation

1. Install with the Sites dependency helper.
2. Run `npm run db:generate` only after schema changes.
3. Build with the Sites build helper to produce `dist/server/wrangler.json`.
4. Apply pending local migrations with:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_plain_sally_floyd.sql
```

Do not replay an applied migration. Local preview data is separate from production. Managed preview may not provide Sites authentication; do not disable production authentication to work around preview limitations. Test deployed sign-in and access policy before private data entry.

`node --experimental-strip-types --test tests/domain.test.ts`
`npx tsc --noEmit`

The production deployment applies schema migrations. No seed data is in migrations; fictional demos are added through authenticated app operations.
