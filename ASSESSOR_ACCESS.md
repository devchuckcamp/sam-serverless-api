# SnoreMD Assessment - Quick Access Guide

**Everything is deployed and ready to test.** No AWS setup required.

---

## Fastest Way to Test: Web UI

```bash
# Clone and run the frontend (connects to deployed API)
git clone https://github.com/devchuckcamp/clinic-web-ui.git
cd clinic-web-ui
npm install
npm run dev
```

Open http://localhost:3001 and login with your configured test users.

| Username | Password | Clinic ID | Clinic Name |
|----------|----------|-----------|-------------|
| **dr-smith** | SecurePass123! | clinic-metro-sleep-la | Metro Sleep LA (patients: pat-20001 to pat-20010) |
| **dr-wilson** | SecurePass123! | clinic-advanced-sleep-chi | Advanced Sleep Chicago (patients: pat-30001 to pat-30010) |
| **dr-chen** | SecurePass123! | clinic-sleep-wellness-nyc | Sleep Wellness NYC (patients: pat-10001 to pat-10010) |

**Test These Features:**
- [Done] Login/logout
- [Done] View patients list (filtered by clinic)
- [Done] Create a new note
- [Done] Edit an existing note
- [Done] Delete a note (soft delete)
- [Done] Filter notes by tag
- [Done] Filter notes by date range
- [Done] Pagination ("Load More")
- [Done] Upload an attachment
- [Done] Download an attachment
- [Done] Switch users to verify tenant isolation

---

## Alternative: Swagger UI (API Testing)

```bash
git clone https://github.com/devchuckcamp/open-docs-api.git
cd open-docs-api
npm install
npm start
```

Open http://localhost:3030 for interactive API documentation.

---

## Alternative: curl/Postman

```bash
# 1. Login
curl -X POST "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"dr-smith","password":"SecurePass123!"}'

# 2. Copy idToken from response
TOKEN="eyJ..."

# 3. List notes
curl "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/patients/pat-20001/notes" \
  -H "Authorization: Bearer $TOKEN"

# 4. Create note
curl -X POST "https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/patients/pat-20001/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Note","content":"Content here","studyDate":"2024-01-15","tags":["test"]}'
```

---

## AWS Console Access

To inspect the architecture, Lambda code, DynamoDB schema, use your own AWS account credentials.

**Key Resources:**
- Lambda: Search "snoremd" in Lambda console
- DynamoDB: Table `SnoreMDNotes-{ENV}`
- API Gateway: `snoremd-app` HttpApi
- S3: `snoremd-attachments-{ACCOUNT_ID}-{ENV}`

---

## Run Tests

```bash
# Backend tests
cd sam-serverless-api && npm install && npm test

# Frontend tests
cd clinic-web-ui && npm install && npm test
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Get JWT tokens |
| POST | `/auth/refresh` | Refresh JWT tokens |
| GET | `/patients` | List clinic patients |
| GET | `/patients/{id}/notes` | List notes (paginated) |
| POST | `/patients/{id}/notes` | Create note |
| GET | `/patients/{id}/notes/{noteId}` | Get note |
| PUT | `/patients/{id}/notes/{noteId}` | Update note |
| DELETE | `/patients/{id}/notes/{noteId}` | Delete note |
| POST | `.../attachments/presign` | Get upload URL |
| GET | `.../attachments/{id}/download` | Get download URL |

**Base URL:** `https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>`

---

## Key Features Implemented

| Feature | Status |
|---------|--------|
| CRUD operations | Done |
| Cursor pagination | Done |
| Tag filtering | Done |
| Date range filtering | Done |
| File attachments (S3 presigned) | Done |
| JWT authentication (Cognito) | Done |
| Multi-tenant isolation | Done |
| Optimistic concurrency | Done |
| Soft deletes | Done |
| KMS encryption | Done |
| API rate limiting | Done |

---

## Full Documentation

See `GETTING_STARTED.md` for:
- System overview
- Setup instructions
- Complete API reference
- Architecture overview
- Full setup instructions (if deploying your own)


