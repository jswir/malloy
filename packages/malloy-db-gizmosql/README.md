# @malloydata/db-gizmosql

**Experimental** GizmoSQL connection for [Malloy](https://github.com/malloydata/malloy).

This package provides a connection to [GizmoSQL](https://github.com/gizmodata/gizmosql) servers via the [Arrow Flight SQL](https://arrow.apache.org/docs/format/FlightSql.html) protocol.

## Status

This package is **experimental**. The API may change without notice.

## Installation

```bash
npm install @malloydata/db-gizmosql
```

## Usage

```typescript
import { GizmoSQLConnection } from '@malloydata/db-gizmosql';
import { ConnectionRuntime, FixedConnectionMap } from '@malloydata/malloy';

// Connect to GizmoSQL
const connection = new GizmoSQLConnection({
  name: 'gizmosql',
  host: 'localhost',
  port: 31337,
  username: 'user',
  password: 'pass',
});

// Use with Malloy runtime
const connections = FixedConnectionMap.fromArray([connection]);
const runtime = new ConnectionRuntime(connections);
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | string | Yes | Connection name for Malloy |
| `host` | string | Yes | GizmoSQL server hostname |
| `port` | number | Yes | GizmoSQL server port |
| `username` | string | Yes | Authentication username (use empty string for unauthenticated servers) |
| `password` | string | Yes | Authentication password (use empty string for unauthenticated servers) |
| `useTLS` | boolean | No | Use TLS encryption (default: true) |
| `defaultDatabase` | string | No | Default database/catalog to use |

## Why GizmoSQL-specific?

This package is specifically designed for GizmoSQL, which uses DuckDB as its SQL engine. While GizmoSQL uses the Arrow Flight SQL protocol (which is also used by Dremio, InfluxDB, and others), those servers use different SQL dialects with different type systems.

If you need to connect to other Flight SQL servers, please open an issue and we can explore adding support.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

MIT
