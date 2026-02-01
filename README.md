# SnoreMD Assessment — Backend/API (Node.js + TypeScript on AWS Serverless)

This repository focuses on the **API + backend** for the Full Stack Engineer assessment, implemented using **Node.js (TypeScript)** and AWS serverless services.

> **New here?** See [GETTING_STARTED.md](./GETTING_STARTED.md) for quick setup instructions.

The solution is designed to be:
- **Cloud-native** (Lambda + API Gateway + DynamoDB + S3)
- **Secure by default** (Cognito JWT auth, least-privilege IAM, encryption)
- **Testable** (unit + lightweight integration tests)
- **Operationally sane** (structured logs, metrics, clear deployment steps)

---

## AWS Services Used

**Required (core)**
- **Amazon API Gateway (HTTP API)** — REST endpoints
- **AWS Lambda** — TypeScript handlers
- **Amazon DynamoDB** — notes metadata & access boundaries
- **Amazon S3** — file attachments (uploaded via pre-signed URLs)

**Security/ops (strongly recommended)**
- **Amazon Cognito User Pools** — authentication (JWT)
- **AWS KMS** — encryption keys (S3; optional DynamoDB)
- **Amazon CloudWatch** — logs/metrics/alarms

**Optional (nice-to-have, not required for MVP)**
- **AWS X-Ray** — tracing
- **AWS WAF** — edge protection on API Gateway
- **AWS Secrets Manager / SSM Parameter Store** — secrets/config
- **Amazon EventBridge / SQS** — async workflows (audit events, notifications)

---

## Target Features (Backend)

### Core API
- Create a patient note
- List patient notes (pagination + server-side filtering)
- Retrieve a single note (recommended)
- Update note (recommended; include optimistic concurrency)
- Soft delete note (recommended)

### Attachments
- Generate **pre-signed S3 PUT URLs**
- Store attachment metadata with the note
- Keep S3 **private** (no public objects)

### Auth & RBAC
- API protected by JWT via **Cognito** (API Gateway JWT authorizer)
- Enforce **clinic boundary** on every request (e.g., `clinicId` claim)
- Role-based permissions (e.g., `notes:read`, `notes:write` or Cognito groups)

---

## API Contract

> All paths are scoped by the authenticated user's `clinicId` claim from the JWT token.

### Authentication (No Auth Required)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Authenticate user, returns JWT tokens |
| `POST` | `/auth/refresh` | Exchange refresh token for new access/id tokens |

### Notes (JWT Required)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/{patientId}/notes` | Create a new note |
| `GET` | `/patients/{patientId}/notes` | List notes (supports pagination, filtering) |
| `GET` | `/patients/{patientId}/notes/{noteId}` | Get a single note |
| `PUT` | `/patients/{patientId}/notes/{noteId}` | Update a note |
| `DELETE` | `/patients/{patientId}/notes/{noteId}` | Soft delete a note |

### Attachments (JWT Required)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/{patientId}/notes/{noteId}/attachments/presign` | Get presigned S3 upload URL |

### Query Parameters for List Notes
- `limit` - Number of items per page (default: 20)
- `cursor` - Pagination cursor (base64-encoded)
- `from` - Filter by study date start (ISO date)
- `to` - Filter by study date end (ISO date)
- `tag` - Filter by tag
- `q` - Search query

---

## Data Model (DynamoDB)

Single-table design scoped by clinic+patient, ordered by study date.

**Partition key (PK)**  
`CLINIC#{clinicId}#PATIENT#{patientId}`

**Sort key (SK)**  
`NOTE#{studyDateISO}#{noteId}`

**Attributes**
- `noteId` (UUID)
- `clinicId`, `patientId`
- `authorId` (from JWT `sub`)
- `content` (string)
- `tags` (string[])
- `studyDate` (ISO date)
- `attachment` (optional): `{ key, filename, contentType, size }`
- `createdAt`, `updatedAt` (ISO datetime)
- `version` (number) — for optimistic concurrency
- `deletedAt` (optional) — soft delete

**Pagination**
- Use DynamoDB `LastEvaluatedKey` → encode as `cursor` (base64 JSON)

**Filtering**
- `from/to` → leverage SK prefix range on `NOTE#{studyDateISO}`
- `tag/q` → FilterExpression (OK because PK is narrow per patient)
- For advanced search at scale, consider OpenSearch later (out of scope)

---

## Security Baseline

- **JWT auth** at the edge (API Gateway authorizer)
- **Clinic boundary checks** inside handlers (defense in depth)
- S3 bucket:
  - Block Public Access **enabled**
  - Enforce TLS-only access
  - Server-side encryption (SSE-KMS)
  - Limit object keys to a safe prefix per tenant: `clinic/{clinicId}/patient/{patientId}/...`
- DynamoDB:
  - Least-privilege IAM per function
  - (Optional) SSE-KMS
- Logging:
  - No PHI in logs
  - Include correlation IDs, request IDs, and high-level event outcomes

---

## Project Layout (Recommended)

```
/infra
  template.yaml              # AWS SAM template
/src
  /handlers                  # Lambda entrypoints (HTTP handlers)
  /services                  # domain services (notes, auth, presign)
  /data                      # dynamodb repository layer
  /lib                       # shared utils (logging, errors, validation)
  /types                     # shared TS types
/tests
  unit/                      # Unit tests
/docs
  TEST_USERS.md              # Test user credentials documentation
  credentials.json           # Credentials in JSON format
README.md
```

---

## Deployed Environment

The application is fully deployed on AWS.

| Resource | Value |
|----------|-------|
| **API Endpoint** | `https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>` |
| **DynamoDB Table** | `SnoreMDNotes-dev` |
| **S3 Bucket** | `snoremd-attachments-{ACCOUNT_ID}-{ENV}` |
| **Cognito User Pool** | `YOUR_USER_POOL_ID` |
| **Region** | `<YOUR-REGION>` |

### AWS Console Access

| | |
|-|-|
| **URL** | https://YOUR_ACCOUNT_ID.signin.aws.amazon.com/console |
| **Username** | `snoremdassessor` |
| **Password** | `SnoreMD@Assessor2024!` |

---

## Authentication

### Login Endpoint

The API includes a login endpoint that authenticates against Cognito and returns JWT tokens.

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "username": "dr-smith",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "data": {
    "idToken": "eyJ...",
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### Refresh Token Endpoint

Use the refresh token to obtain new access and ID tokens without re-authenticating.

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJ...",
  "username": "dr-smith"
}
```

**Response:**
```json
{
  "data": {
    "idToken": "eyJ...",
    "accessToken": "eyJ...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**Note:** The refresh token itself is not returned - continue using the original refresh token until it expires (typically 30 days). The username is required to compute the Cognito secret hash.

### Test User Credentials

> **Full credentials documentation:** See `docs/TEST_USERS.md` for detailed user information, or `docs/credentials.json` for programmatic access.

#### Quick Reference

| Clinic | Username | Password | Role |
|--------|----------|----------|------|
| clinic-metro-sleep-la | `dr-smith` | `SecurePass123!` | doctor |
| clinic-metro-sleep-la | `nurse-jones` | `SecurePass123!` | nurse |
| clinic-metro-sleep-la | `admin-brown` | `SecurePass123!` | admin |
| clinic-advanced-sleep-chi | `dr-wilson` | `SecurePass123!` | doctor |
| clinic-advanced-sleep-chi | `nurse-garcia` | `SecurePass123!` | nurse |
| clinic-advanced-sleep-chi | `admin-taylor` | `SecurePass123!` | admin |
| clinic-sleep-wellness-nyc | `dr-chen` | `SecurePass123!` | doctor |
| clinic-sleep-wellness-nyc | `nurse-patel` | `SecurePass123!` | nurse |
| clinic-sleep-wellness-nyc | `admin-martinez` | `SecurePass123!` | admin |

#### Available Roles

| Role | Description |
|------|-------------|
| `doctor` | Doctors with full clinical access |
| `nurse` | Nurses with clinical access |
| `admin` | Clinic administrators |
| `clinician` | Clinicians with read/write access to notes |

#### Tenant Isolation

Each user is scoped to their clinic via the `custom:clinicId` JWT claim:
- Users in `clinic-metro-sleep-la` can only access Metro Sleep LA data
- Users in `clinic-advanced-sleep-chi` can only access Advanced Sleep Chicago data
- Users in `clinic-sleep-wellness-nyc` can only access Sleep Wellness NYC data

### Using the Token

Use the **idToken** (not accessToken) for API requests, as it contains the required claims (`custom:clinicId`, `cognito:groups`):

```bash
# Login and extract token
TOKEN=$(curl -s -X POST "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"dr-smith","password":"SecurePass123!"}' | jq -r '.data.idToken')

# Make authenticated request
curl "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/patients/pat-20001/notes" \
  -H "Authorization: Bearer $TOKEN"
```

### JWT Claims

The idToken contains these claims used for authorization:
- `sub` - User ID (Cognito subject)
- `custom:clinicId` - Tenant ID for clinic boundary enforcement
- `cognito:groups` - User roles (e.g., `["clinician"]`)
- `cognito:username` - Username

### Token Strategy

#### Why ID Token?

This API uses the **ID token** (not access token) because:

| Token Type | Contains `custom:clinicId` | Contains `cognito:groups` |
|------------|---------------------------|---------------------------|
| ID Token (`token_use: id`) | ✅ Yes | ✅ Yes |
| Access Token (`token_use: access`) | ❌ No | ✅ Yes |

The `custom:clinicId` claim is essential for tenant isolation. Without it, the API cannot enforce clinic boundaries.

#### Production Recommendation

For production deployments, consider using **access tokens** with a **Pre Token Generation Lambda trigger** to inject `clinicId` into the access token. This follows OAuth 2.0 best practices where:
- Access tokens are used for API authorization
- ID tokens are used for authentication/identity

#### API Gateway Configuration

- **API Type**: HTTP API (`AWS::Serverless::HttpApi`)
- **Authorizer**: Cognito JWT Authorizer
- **Token Source**: `$request.header.Authorization`

#### Claim Extraction in Lambda

```typescript
// HTTP API (current implementation)
const claims = event.requestContext.authorizer?.jwt?.claims;
const clinicId = claims['custom:clinicId'];
const groups = claims['cognito:groups'];

// REST API (alternative pattern)
const claims = event.requestContext.authorizer?.claims;
```

---

## File Upload Workflow

### 1. Create a Note

```bash
curl -X POST "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/patients/pat-20001/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studyDate": "2026-01-30",
    "noteType": "clinical",
    "title": "Patient Visit Notes",
    "content": "Clinical observations..."
  }'
```

### 2. Get Presigned Upload URL

```bash
curl -X POST "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/patients/pat-20001/notes/{noteId}/attachments/presign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "document.pdf",
    "contentType": "application/pdf",
    "sizeBytes": 147287
  }'
```

Response:
```json
{
  "data": {
    "uploadUrl": "https://bucket.s3.amazonaws.com/...",
    "s3Key": "clinic/clinic-metro-sleep-la/patient/pat-20001/note/{noteId}/{attachmentId}/document.pdf",
    "expiresIn": 900
  }
}
```

### 3. Upload File to S3

```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary @document.pdf
```

### 4. Update Note with Attachment Metadata

```bash
curl -X PUT "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/patients/pat-20001/notes/{noteId}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "attachments": [{
      "id": "{attachmentId}",
      "fileName": "document.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 147287,
      "s3Key": "clinic/clinic-metro-sleep-la/patient/pat-20001/note/{noteId}/{attachmentId}/document.pdf",
      "uploadedAt": "2026-01-30T20:22:39.000Z"
    }]
  }'
```

---

## Testing Strategy

**Backend Unit Tests** (`npm test`):
- Validation schemas
- RBAC/claims enforcement
- Cursor encode/decode
- Handler logic
- Service layer logic

---

## Local Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| Docker | Latest | DynamoDB Local |
| AWS SAM CLI | 1.x | Local Lambda execution |
| AWS CLI | 2.x | AWS interactions |

### 1. Install Dependencies

```bash
npm install
```

### 2. Start DynamoDB Local

```bash
# Start DynamoDB Local container
npm run dev:docker

# Verify it's running
docker ps | grep dynamodb
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your Cognito credentials (for /auth/login)
# Or use mock /auth/token endpoint for local testing
```

### 4. Configure SAM Environment

Create `sam-env.json` in the project root:

```json
{
  "CreateNoteFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "LoginFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "COGNITO_USER_POOL_ID": "your-pool-id",
    "COGNITO_CLIENT_ID": "your-client-id",
    "COGNITO_CLIENT_SECRET": "your-client-secret",
    "AWS_REGION": "<YOUR-REGION>"
  }
}
```

**Note:** Add entries for all Lambda functions. See `sam-env.json.example` for full template.

### 5. Build and Run

```bash
# Build SAM application
npm run sam:build

# Start local API server
npm run dev
```

The API will be available at `http://localhost:3000`.

### 6. Test the API

```bash
# Login with Cognito credentials (requires credentials in sam-env.json)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dr-smith","password":"SecurePass123!"}'
```

### Getting Cognito Client Secret

The client secret is required for the `/auth/login` endpoint to work locally:

```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id your-client-id \
  --query "UserPoolClient.ClientSecret" \
  --output text
```

---

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm test` | Run unit tests |
| `npm run build` | Compile TypeScript |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run sam:build` | Build SAM application |
| `npm run dev` | Start local API server (requires Docker + SAM) |
| `npm run dev:docker` | Start DynamoDB Local container |
| `npm run dev:docker:stop` | Stop DynamoDB Local container |
| `npm run dev:docker:init` | Create table + import test data (681 items) |

---

## Assumptions & Constraints

- Notes are strictly scoped to a **clinicId** tenant boundary.
- Attachments are stored privately in S3; only access via pre-signed URLs.
- Search is limited to patient-level partitions (no global free-text indexing in MVP).
- PHI/PII handling: **avoid logging sensitive content**; keep payload sizes bounded.

---

## S3 Object Key Structure

Attachments are stored with tenant-scoped paths:
```
clinic/{clinicId}/patient/{patientId}/note/{noteId}/{attachmentId}/{filename}
```

---

## Troubleshooting

### Common Issues

1. **"Missing authentication token"** - Ensure you're using the `idToken` (not `accessToken`) and including the `Bearer` prefix.

2. **"FORBIDDEN"** - Check that the user has the required Cognito group membership and `custom:clinicId` attribute.

3. **"Rate limit exceeded"** - Wait for the `Retry-After` period indicated in the response header.

---

## Documentation

| Document | Description |
|----------|-------------|
| `GETTING_STARTED.md` | Quick setup guide for testing and local development |
| `docs/TEST_USERS.md` | Test user credentials with login examples, Roles and Permissions |
| `docs/credentials.json` | User credentials in JSON format |
| `.env.example` | Environment variable template with setup instructions |
| `sam-env.json.example` | SAM local environment template |
| [open-docs-api](https://github.com/devchuckcamp/open-docs-api) | Interactive API documentation (Swagger UI) |
