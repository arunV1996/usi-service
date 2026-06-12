# USI Payout Microservice

Secure **TypeScript** / Node.js / Express microservice that brokers all calls
between our internal systems and the **USI Money (RemitONE) Agent Partner
API**. Internal services hit this microservice; the microservice translates,
signs, audits and proxies the call upstream.

This repository ships the code, security controls, and operational tooling
required for a production deployment that is suitable for **penetration
testing and SOC audit** at million-user scale.

---

## 1. Folder layout

```
src/
├── app.ts               Express app wiring (helmet, cors, hpp, compression)
├── server.ts            Single-process bootstrap + graceful shutdown
├── cluster.ts           Multi-worker bootstrap (saturates all CPU cores)
├── config/
│   ├── index.ts         Loads & merges secrets/env into a typed config
│   └── secretManager.ts AWS Secrets Manager + KMS helpers (env fallback)
├── controllers/         Thin HTTP handlers, one per USI domain group
├── routes/              Express routers + express-validator schemas
├── services/usi/        3rd-party HTTP client and per-group wrappers
├── middleware/          auth, requestLogger, rateLimit, validate, errorHandler
├── helpers/             logger, redact, crypto, auditStore
└── types/               Shared types + Express Request augmentation

dist/                    Compiled JS output (created by `npm run build`)
tsconfig.json            Strict TS config, target ES2022, CommonJS
```

Every USI WebService method documented in
*USI Money - Send - Agent Partner API v3.1* has a corresponding controller
and route — see `src/routes/index.js`.

---

## 2. Secret management

All sensitive configuration (3rd-party base URL, USI username/password/PIN,
data-integrity hash key, JWT signing secret, internal API keys, audit
encryption key) is read through `src/config/secretManager.js`.

Resolution order per key:

1. AWS Secrets Manager (`SECRETS_MANAGER_ENABLED=true`,
   `SECRETS_MANAGER_SECRET_ID=<json-secret-id>`)
2. Environment variable / `.env` file (fallback)

Optional envelope-encryption: any value prefixed with `kms:` is treated as a
base-64 KMS ciphertext blob and decrypted via the configured KMS key
(`KMS_KEY_ID`). Useful for storing one or two encrypted values directly in env
without enabling Secrets Manager.

Secrets are loaded once at startup, then cached in process memory only — never
written to disk or logs. In production, missing required keys cause startup to
fail (fail-closed).

---

## 3. Security controls

| Control | Implementation |
|---|---|
| Authentication | **4-factor strong auth** in production (see §3.1) — `src/middleware/auth.ts`. `/v1/audit/*` uses a lighter api-key-only check (`src/middleware/auditAuth.ts`). |
| Idempotency | `Idempotency-Key` required for payout endpoints, 24 h Redis cache — `src/middleware/idempotency.ts` |
| Authorization scope | Internal-network only; deploy in private subnet behind ALB + WAF |
| TLS to upstream | `rejectUnauthorized: true`, `minVersion: TLSv1.2` (`httpClient.js`) |
| Security headers | `helmet` with HSTS, no-referrer, COEP defaults |
| Input validation | `express-validator` on every mutating route |
| HTTP parameter pollution | `hpp` middleware |
| Rate limiting | `express-rate-limit`, optional Redis-backed for multi-host |
| CORS | Disabled (`origin: false`) — service-to-service only |
| Body size limits | 256 KB JSON / form |
| Request hashing | SHA-256 `data_integrity_hash` per USI spec, optional |
| Sensitive log redaction | `helpers/redact.js` removes passwords, PINs, account numbers, IBANs, IFSC, SWIFT, IDs, scans, **base URLs** |
| Audit-log encryption | AES-256-GCM at rest using `AUDIT_ENCRYPTION_KEY` from Secrets Manager |
| Audit-log file perms | `0600`, parent dir `0750`, owned by container `app` user |
| Process hardening | Runs as non-root in container; `x-powered-by` disabled; `etag` disabled |
| Error responses | Internal stack traces never returned; only `correlation_id` |
| Graceful shutdown | SIGTERM/SIGINT handled; 30 s grace period |

### 3.1 Strong authentication (production)

Every `/v1/*` request **except `/v1/audit/*`** must carry **four** independent
factors. All four are verified before any business logic runs. Failure of any
single factor returns `401 UNAUTHORIZED` with a generic message (diagnostic
detail is logged server-side only).

> **Exception — `/v1/audit/*`:** The read-only external-call inspection
> endpoints accept just `x-api-key` (timing-safe match against any
> `INTERNAL_CLIENTS[].apiKey`). No signature, no nonce, no secret-header.
> This lets operators inspect upstream call records with a simple curl while
> the rest of the API keeps the full 4-factor flow. See
> `src/middleware/auditAuth.ts`.

| # | Factor | Header | Source |
|---|---|---|---|
| 1 | API key (client identity) | `x-api-key` | per-client, from `INTERNAL_CLIENTS` |
| 2 | Shared secret header (name + value) | configurable, e.g. `x-app-secret-token` | per-client; **both** the header name and value live in Secrets Manager |
| 3 | HMAC-SHA256 signature | `x-signature`, `x-timestamp`, `x-nonce` | computed by caller with per-client `signingSecret` |
| 4 | Idempotency-Key (payout endpoints only) | `Idempotency-Key` | caller-generated UUID; 24 h cache in Redis |

Clients are defined in the `INTERNAL_CLIENTS` secret as a JSON array:

```json
[
  {
    "clientId":          "ledger-service",
    "apiKey":            "ak_live_...",
    "secretHeaderName":  "x-app-secret-token",
    "secretHeaderValue": "sv_live_...",
    "signingSecret":     "hmac_signing_key_...",
    "scopes":            ["payout", "read"]
  }
]
```

#### Signature canonicalisation

```
HMAC_SHA256(
  signingSecret,
  METHOD + "\n" +
  PATH + "\n" +
  SORTED_QUERY + "\n" +
  SHA256_HEX(BODY) + "\n" +
  TIMESTAMP_MS + "\n" +
  NONCE
)
```

- `METHOD` upper-cased, `PATH` is the URL path without query.
- `SORTED_QUERY` is the raw query string with `k=v` pairs sorted lexically.
- `BODY` is the raw request body bytes (empty string for GET).
- `TIMESTAMP_MS` must be within ±`SIGNATURE_SKEW_SEC` (default 300 s) of server time.
- `NONCE` is unique per request; reuse within `NONCE_TTL_SEC` (default 900 s) returns 401.

Replay protection uses a SET-NX in Redis (`nonce:<clientId>:<nonce>`).

#### Idempotency for payout endpoints

`POST /v1/transactions` (createTransaction) and `POST /v1/transactions/confirm`
(confirmTransaction) require an `Idempotency-Key` header (8–128 chars of
`[A-Za-z0-9._-]`). Behaviour:

| Scenario | Response |
|---|---|
| First call with key + body B | Processed normally; 2xx/4xx response cached for `IDEMPOTENCY_TTL_SEC` (default 24 h) |
| Repeat with key + body B before first finishes | `409 IDEMPOTENCY_IN_PROGRESS` |
| Repeat with key + body B after first finishes | Cached response replayed verbatim, `x-idempotent-replay: true` header added |
| Repeat with key but body C (different fingerprint) | `422 IDEMPOTENCY_CONFLICT` |
| First call returned 5xx | **Not cached**; lock released so the client may retry |

Keys are namespaced per `clientId` so two clients cannot interfere with each
other's keys (`idem:<clientId>:<key>`).

#### Sample call

```bash
TS=$(date +%s%3N)
NONCE=$(uuidgen)
BODY='{"remitter_id":1,"beneficiary_id":1, ...}'
BODY_HASH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
CANON="POST\n/v1/transactions/\n\n$BODY_HASH\n$TS\n$NONCE"
SIG=$(printf '%b' "$CANON" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" -hex | awk '{print $2}')

curl -X POST https://api/v1/transactions/ \
  -H "x-api-key: $API_KEY" \
  -H "x-app-secret-token: $SECRET_VALUE" \
  -H "x-timestamp: $TS" \
  -H "x-nonce: $NONCE" \
  -H "x-signature: $SIG" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  --data "$BODY"
```

### What is logged vs what is not

Every incoming request is logged with: correlation id, method, path, status,
duration, client id, IP, user agent, redacted body & params.

The following are **never** written to logs (redacted to `[REDACTED]` /
`[REDACTED:URL]`):

- `username`, `password`, `pin`, `data_integrity_hash`, `authorization`,
  `cookie`, `x-api-key`, `token`, `secret`
- `account_number`, `iban`, SWIFT/IFSC/BIC codes, card numbers
- `id_details`, `id_scan*`, `kyc_video`, `national_id_number`,
  `dob`, `mobile`, `telephone`, `email`, `collection_pin`
- Any field whose key name matches `url`, `endpoint`, `host`, `domain`, or
  `base_url` — including the upstream USI base URL

### External call audit log

Every outbound call to USI is recorded by `helpers/auditStore.js` to
`AUDIT_LOG_DIR/external-YYYY-MM-DD.ndjson`. Bodies are encrypted at rest using
AES-256-GCM (`AUDIT_ENCRYPTION_KEY` is mandatory in production for this).

Inspect via the audit API:

```
GET /v1/audit/external-calls?operation=transaction.createTransaction&from=2026-05-10T00:00:00Z
GET /v1/audit/external-calls/<audit_id>          # decrypts and returns full request/response
```

These endpoints require the same auth as the rest of the service. The
underlying files live on a volume that is **not** exposed to the host
(restrictive permissions) and should be shipped to a SIEM (CloudWatch,
OpenSearch, Splunk) via Fluent Bit / Vector with the same encryption key
escrowed.

---

## 4. Running locally

```bash
cp .env.example .env       # fill in USI test creds
npm ci
npm run dev                # tsx watch, hot reload
```

Smoke test:

```bash
curl -H "x-api-key: $INTERNAL_API_KEY" http://localhost:8080/healthz
```

Useful scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Hot-reload (tsx) — runs `src/server.ts` directly, no build needed |
| `npm run build` | Compile TypeScript → `dist/` (uses `tsconfig.json`) |
| `npm run typecheck` | Type check only, no emit |
| `npm start` | Run **production** entry: `node dist/server.js` (runs `build` first if `dist/` missing) |
| `npm run start:cluster` | Production multi-worker: `node dist/cluster.js` |
| `npm run clean` | Remove `dist/` and incremental build info |

---

## 5. Production deployment

### Bare-metal / VM

```bash
npm ci --omit=dev=false       # need devDeps to compile
npm run build                 # produces dist/
npm prune --omit=dev          # drop devDeps before shipping
NODE_ENV=production \
SECRETS_MANAGER_ENABLED=true \
SECRETS_MANAGER_SECRET_ID=usi-payout-service/prod \
AWS_REGION=ap-south-1 \
  node dist/cluster.js
```

### Docker

```bash
docker build -t usi-payout-service:latest .
docker run -d --name usi-payout \
  --read-only --tmpfs /tmp \
  -e NODE_ENV=production \
  -e SECRETS_MANAGER_ENABLED=true \
  -e SECRETS_MANAGER_SECRET_ID=usi-payout-service/prod \
  -e AWS_REGION=ap-south-1 \
  -v usi-payout-logs:/var/log/usi-payout \
  -p 8080:8080 \
  usi-payout-service:latest
```

The image's multi-stage build compiles TypeScript in the build stage and ships
only `dist/` + production `node_modules` in the runtime stage.

The `cluster.js` entrypoint (compiled from `cluster.ts`) forks one Node worker
per CPU core. For multi-host horizontal scale, run behind ALB/NLB with
auto-scaling and supply `REDIS_URL` so rate limiting is enforced
cluster-wide.

### Capacity guidance for 1M users

- Each worker can sustain ~3–5k req/s for proxy workloads when upstream is
  healthy.
- Use Redis-backed rate limiting (`REDIS_URL`) to share state across pods.
- Keep `USI_MAX_SOCKETS=200` per process (default) and tune upward if your
  upstream contract allows higher concurrency.
- Front the service with an ALB; target group health check on `/healthz`.
- Run in **at least** two AZs with min 3 tasks per AZ.
- Stream logs to CloudWatch Logs with KMS-CMK encryption and 90-day retention
  in addition to the on-disk encrypted audit file.

---

## 6. Endpoint catalogue

All endpoints are mounted under `/v1` and require auth.

| Domain | Method & Path | USI Method |
|---|---|---|
| Agent | `POST /v1/agent/details` | getAgentDetails |
| Agent | `POST /v1/agent/credit` | getCurrentCredit |
| Country | `POST /v1/countries/destinations` | getDestinationCountries |
| Rates | `POST /v1/rates` | getRates |
| Remitter | `POST /v1/remitters` | createRemitter |
| Remitter | `POST /v1/remitters/search` | searchRemitter |
| Remitter | `PUT /v1/remitters/:remitter_id` | updateRemitter |
| Remitter | `POST /v1/remitters/verify` | verifyRemitter |
| Beneficiary | `POST /v1/beneficiaries/account-types` | getBeneficiaryAccountTypes |
| Beneficiary | `POST /v1/beneficiaries` | createBeneficiary |
| Beneficiary | `POST /v1/beneficiaries/search` | searchBeneficiary |
| Beneficiary | `PUT /v1/beneficiaries/:beneficiary_id` | updateBeneficiary |
| Transaction | `POST /v1/transactions` | createTransaction |
| Transaction | `POST /v1/transactions/confirm` | confirmTransaction |
| Transaction | `GET /v1/transactions/status/:trans_ref` | getTransactionStatus |
| Transaction | `GET /v1/transactions/status/by-agent-ref/:agent_trans_ref` | getTransactionStatusByAgentTransRef |
| Transaction | `POST /v1/transactions/charges` | getCharges |
| Delivery | `POST /v1/delivery/banks` | getDeliveryBanks |
| Delivery | `POST /v1/delivery/branches` | getDeliveryBankBranches |
| Delivery | `POST /v1/delivery/collection-points` | getCollectionPoints |
| Mobile | `POST /v1/mobile/operators` | getMobileNetworkOperators |
| Mobile | `POST /v1/mobile/credit-types` | getMobileNetworkCreditTypes |
| Audit | `GET /v1/audit/external-calls` | (internal) |
| Audit | `GET /v1/audit/external-calls/:id` | (internal) |

### Standard internal response

```json
{
  "status": "SUCCESS",
  "data": { "...": "..." },
  "meta": {
    "correlation_id": "ab12...",
    "audit_id": "ee99...",
    "upstream_response_id": "1030111",
    "duration_ms": 412
  }
}
```

Errors:

```json
{
  "status": "FAIL",
  "error": {
    "code": "UPSTREAM_FAILURE | UPSTREAM_UNREACHABLE | VALIDATION_FAILED | UNAUTHORIZED | RATE_LIMITED | INTERNAL_ERROR",
    "message": "...",
    "details": [...],
    "correlation_id": "...",
    "audit_id": "..."
  }
}
```

---

## 7. SOC / pen-test checklist

- [x] No secrets in source — Secrets Manager + KMS
- [x] All requests logged with correlation id, sensitive fields redacted
- [x] All outbound 3rd-party calls audit-logged with encrypted bodies
- [x] Audit logs retrievable only via authenticated internal API
- [x] Every HTTP route validated at the boundary
- [x] Strict TLS, modern security headers, parameter-pollution protection
- [x] Rate-limited per client (Redis-backed in prod)
- [x] Container runs as non-root, read-only FS, dropped capabilities
- [x] Graceful shutdown for zero-loss deploys
- [x] Clusterable for vertical scale; horizontally scalable behind ALB
- [x] Dependencies pinned; `npm audit` script provided

---

## 8. Notes

The repository PDF (`USI Money - Send - Agent Partner API.pdf`) is the
upstream specification this service implements. It is `gitignore`d so it does
not ship with builds.
