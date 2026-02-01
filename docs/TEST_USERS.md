# SnoreMD Test User Credentials

> **WARNING**: These credentials are for development/testing purposes only. Do not use in production.

## Cognito User Pool

- **User Pool ID**: `YOUR_USER_POOL_ID`
- **App Client ID**: `YOUR_CLIENT_ID`
- **Region**: `<YOUR-REGION>`

## Available Roles

| Role | Description |
|------|-------------|
| `doctor` | Doctors with full clinical access |
| `nurse` | Nurses with clinical access |
| `admin` | Clinic administrators |
| `clinician` | Clinicians with read/write access to notes |

---

## Metro Sleep LA (`clinic-metro-sleep-la`)

### Dr. Smith (Doctor)
- **Username**: `dr-smith`
- **Password**: `SecurePass123!`
- **Email**: `dr.smith@metro-sleep-la.test`
- **Roles**: `doctor`, `clinician`

### Nurse Jones (Nurse)
- **Username**: `nurse-jones`
- **Password**: `SecurePass123!`
- **Email**: `nurse.jones@metro-sleep-la.test`
- **Roles**: `nurse`

### Admin Brown (Administrator)
- **Username**: `admin-brown`
- **Password**: `SecurePass123!`
- **Email**: `admin.brown@metro-sleep-la.test`
- **Roles**: `admin`

---

## Advanced Sleep Chicago (`clinic-advanced-sleep-chi`)

### Dr. Wilson (Doctor)
- **Username**: `dr-wilson`
- **Password**: `SecurePass123!`
- **Email**: `dr.wilson@advanced-sleep-chi.test`
- **Roles**: `doctor`

### Nurse Garcia (Nurse)
- **Username**: `nurse-garcia`
- **Password**: `SecurePass123!`
- **Email**: `nurse.garcia@advanced-sleep-chi.test`
- **Roles**: `nurse`

### Admin Taylor (Administrator)
- **Username**: `admin-taylor`
- **Password**: `SecurePass123!`
- **Email**: `admin.taylor@advanced-sleep-chi.test`
- **Roles**: `admin`

---

## Sleep Wellness NYC (`clinic-sleep-wellness-nyc`)

### Dr. Chen (Doctor)
- **Username**: `dr-chen`
- **Password**: `SecurePass123!`
- **Email**: `dr.chen@sleep-wellness-nyc.test`
- **Roles**: `doctor`

### Nurse Patel (Nurse)
- **Username**: `nurse-patel`
- **Password**: `SecurePass123!`
- **Email**: `nurse.patel@sleep-wellness-nyc.test`
- **Roles**: `nurse`

### Admin Martinez (Administrator)
- **Username**: `admin-martinez`
- **Password**: `SecurePass123!`
- **Email**: `admin.martinez@sleep-wellness-nyc.test`
- **Roles**: `admin`

---

## Quick Reference Table

| Clinic | Username | Password | Role |
|--------|----------|----------|------|
| clinic-metro-sleep-la | dr-smith | SecurePass123! | doctor |
| clinic-metro-sleep-la | nurse-jones | SecurePass123! | nurse |
| clinic-metro-sleep-la | admin-brown | SecurePass123! | admin |
| clinic-advanced-sleep-chi | dr-wilson | SecurePass123! | doctor |
| clinic-advanced-sleep-chi | nurse-garcia | SecurePass123! | nurse |
| clinic-advanced-sleep-chi | admin-taylor | SecurePass123! | admin |
| clinic-sleep-wellness-nyc | dr-chen | SecurePass123! | doctor |
| clinic-sleep-wellness-nyc | nurse-patel | SecurePass123! | nurse |
| clinic-sleep-wellness-nyc | admin-martinez | SecurePass123! | admin |


 Corrected Permissions by Role
  ┌───────────────────┬──────────────────────────────────────┬────────┬───────┬───────┐
  │      Action       │               Endpoint               │ doctor │ nurse │ admin │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Authentication    │                                      │        │       │       │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Login             │ POST /auth/login                     │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Refresh Token     │ POST /auth/refresh                   │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Clinic & Patients │                                      │        │       │       │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ View Clinic Info  │ GET /clinic                          │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ List Patients     │ GET /patients                        │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Notes - Read      │                                      │        │       │       │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ List Notes        │ GET /patients/{id}/notes             │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Get Single Note   │ GET /patients/{id}/notes/{noteId}    │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Notes - Write     │                                      │        │       │       │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Create Note       │ POST /patients/{id}/notes            │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Update Note       │ PUT /patients/{id}/notes/{noteId}    │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Delete Note       │ DELETE /patients/{id}/notes/{noteId} │   ❌   │  ❌   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Attachments       │                                      │        │       │       │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Upload (Presign)  │ POST .../attachments/presign         │   ✅   │  ✅   │  ✅   │
  ├───────────────────┼──────────────────────────────────────┼────────┼───────┼───────┤
  │ Download          │ GET .../attachments/{id}/download    │   ✅   │  ✅   │  ✅   │
  └───────────────────┴──────────────────────────────────────┴────────┴───────┴───────┘
  Role Scope Summary (Corrected)
  ┌──────────────┬──────────────────────────────────────────────────────────┬────────────────────────────────────┐
  │     Role     │                      Scopes Granted                      │            Description             │
  ├──────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ doctor       │ notes:read, notes:write, attachments:write               │ Full clinical access except delete │
  ├──────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ nurse        │ notes:read, notes:write, attachments:write               │ Same as doctor                     │
  ├──────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ admin        │ notes:read, notes:write, attachments:write, notes:delete │ Full access including delete       │
  ├──────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ clinician    │ notes:read, notes:write, attachments:write               │ Same as doctor/nurse               │
  ├──────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────┤
  │ receptionist │ notes:read                                               │ Read-only access                   │
  └──────────────┴──────────────────────────────────────────────────────────┴────────────────────────────────────
---

## Login Examples

### Using cURL

#### Replace `<YOUR-API-ID>` with your actual API Gateway ID, or use http://localhost:3000 for local development.
```bash
# Login as dr-smith (Metro Sleep LA)
curl -X POST https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "dr-smith", "password": "SecurePass123!"}'

# Login as nurse-garcia (Advanced Sleep Chicago)
curl -X POST https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "nurse-garcia", "password": "SecurePass123!"}'

# Login as admin-martinez (Sleep Wellness NYC)
curl -X POST https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin-martinez", "password": "SecurePass123!"}'
```

### Refresh Token

When your tokens expire, use the refresh token to get new ones without re-authenticating:

```bash
# Refresh tokens (use the refreshToken from login response)
curl -X POST https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your-refresh-token>", "username": "dr-smith"}'
```

**Note:** The username is required because Cognito needs it to compute the secret hash.

### Using Web UI

1. Navigate to http://localhost:3001
2. Enter username and password from the table above
3. Click "Sign In"

---

## Tenant Isolation

Each user is scoped to their clinic via the `custom:clinicId` attribute:

- Users in `clinic-metro-sleep-la` can only access Metro Sleep LA data
- Users in `clinic-advanced-sleep-chi` can only access Advanced Sleep Chicago data
- Users in `clinic-sleep-wellness-nyc` can only access Sleep Wellness NYC data

This is enforced at multiple levels:
1. JWT token contains `custom:clinicId` claim
2. API Gateway validates JWT
3. Lambda handlers extract and enforce clinic boundary
4. DynamoDB queries scoped by `CLINIC#{clinicId}#PATIENT#{patientId}`
5. S3 keys prefixed with `clinic/{clinicId}/patient/{patientId}/`
