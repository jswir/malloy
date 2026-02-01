# @malloydata/db-flightsql

**Experimental** Arrow Flight SQL connection for [Malloy](https://github.com/malloydata/malloy).

This package provides a connection to any database that implements the [Arrow Flight SQL](https://arrow.apache.org/docs/format/FlightSql.html) protocol, including:

- [GizmoSQL](https://github.com/gizmodata/gizmosql)
- [Dremio](https://www.dremio.com/)
- [InfluxDB](https://www.influxdata.com/)
- Other Flight SQL-compatible servers

## Status

This package is **experimental**. The API may change without notice.

## Installation

```bash
npm install @malloydata/db-flightsql
```

## Usage

```typescript
import { FlightSQLConnection } from '@malloydata/db-flightsql';
import { ConnectionRuntime, FixedConnectionMap } from '@malloydata/malloy';

// Connect to GizmoSQL
const gizmoConnection = new FlightSQLConnection({
  name: 'gizmosql',
  host: 'localhost',
  port: 31337,
  username: 'user',
  password: 'pass',
  dialect: 'duckdb', // GizmoSQL uses DuckDB backend
});

// Connect to Dremio
const dremioConnection = new FlightSQLConnection({
  name: 'dremio',
  host: 'dremio.example.com',
  port: 32010,
  username: 'user',
  password: 'pass',
  useTLS: true,
  dialect: 'standard_sql',
});

// Use with Malloy runtime
const connections = FixedConnectionMap.fromArray([gizmoConnection]);
const runtime = new ConnectionRuntime(connections);
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | string | Yes | Connection name for Malloy |
| `host` | string | Yes | Flight SQL server hostname |
| `port` | number | Yes | Flight SQL server port |
| `username` | string | No | Authentication username |
| `password` | string | No | Authentication password |
| `useTLS` | boolean | No | Use TLS encryption (default: false) |
| `dialect` | string | Yes | SQL dialect: 'duckdb', 'postgres', or 'standard_sql' |

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

MIT
