# Vault Secret Analysis

Kylrix enforces a zero-knowledge architecture: Turso never stores plaintext credentials. The database schema stores AES-GCM ciphertext in `encrypted_data` with `iv`, packing non-secret fields into `metadata`. There are intentionally no plaintext password or custom-field columns.

The error occurred because a raw SQL string interpolation failed when special characters in passwords shattered the unparameterized query syntax.

**Migration needed?** No schema migration needed; `vault_items` matches Turso. Always use parameterized queries.
