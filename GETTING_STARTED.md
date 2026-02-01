# SnoreMD - Getting Started Guide

This guide provides two paths depending on your goal:

| Goal | Path | Prerequisites |
|------|------|---------------|
| **Test & Evaluate** | Use deployed Web UI + API | Node.js 20+, npm (for local frontend) |
| **Deploy Your Own** | Full AWS setup | AWS CLI, SAM CLI, AWS Account, Docker |

---

## Placeholder Values Quick Reference

The configuration files contain placeholders that need real values. Here's how to fill them:

### Already Deployed API (Use This!)

| Placeholder | Value |
|-------------|-------|
| `VITE_API_URL` | `https://gksonzdd9g.execute-api.us-east-1.amazonaws.com/dev` |

**For testing/evaluation**, just use the deployed API URL above - no AWS setup needed!

### All Placeholders Reference

| Placeholder | Format | How to Get |
|-------------|--------|------------|
| `<API_URL>` or `VITE_API_URL` | `https://<API_ID>.execute-api.<REGION>.amazonaws.com/<STAGE>` | CloudFormation outputs or API Gateway console |
| `<YOUR_USER_POOL_ID>` | `us-east-1_AbCdEfGh` | Cognito > User Pools > Pool ID |
| `<YOUR_CLIENT_ID>` | `1abc2def3ghi...` | Cognito > User Pools > App Integration > App Clients |
| `<YOUR_CLIENT_SECRET>` | Long alphanumeric string | **AWS CLI only** (see command below) |
| `<YOUR_ACCOUNT_ID>` | `123456789012` | AWS Console top-right or `aws sts get-caller-identity` |
| `<YOUR-REGION>` | `us-east-1`, `ca-central-1` | Your AWS deployment region |

### Get Cognito Client Secret (Required for Local Dev)

The client secret is **not shown in AWS Console** - use this CLI command:

```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --client-id <YOUR_CLIENT_ID> \
  --query "UserPoolClient.ClientSecret" \
  --output text
```

### Configuration Files Summary

| File | Purpose | Key Placeholders |
|------|---------|------------------|
| `.env` | Frontend API URL | `VITE_API_URL` |
| `.env` | Backend local dev | Cognito credentials |
| `sam-env.json` | SAM local Lambda env | Cognito credentials per function |

---

## Option A: Quick Testing (Recommended for Assessors)

**No AWS CLI, SAM CLI, or AWS account required** - the application is already deployed and ready to use.

### What's Already Deployed

| Component   | Status   | Details |
|-------------|----------|---------|
| **Web UI**  | Deployed | React frontend (run locally, connects to deployed API) |
| **API**     | Deployed | REST API on AWS Lambda + API Gateway |
| **Database**| Deployed | DynamoDB with 600+ test notes |
| **Storage** | Deployed | S3 for file attachments |
| **Auth**    | Deployed | Cognito User Pool with 9 test users |

### Prerequisites (Testing Only)

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20+ | Run frontend locally |
| **npm** | 10+ | Package management |
| **Git** | Any | Clone repository |

### Quick Start - Web UI (Easiest)

```bash
# 1. Clone the repository
git clone https://github.com/devchuckcamp/clinic-web-ui.git

# 2. Run the frontend (connects to deployed API)
cd clinic-web-ui
npm install
npm run dev
```

Open http://localhost:3001 and login with test credentials:

| Username | Password | Clinic |
|----------|----------|--------|
| **dr-smith** | SecurePass123! | Metro Sleep LA |
| **dr-wilson** | SecurePass123! | Advanced Sleep Chicago |
| **dr-chen** | SecurePass123! | Sleep Wellness NYC |

**What You Can Test:**
- Login/logout flow
- Browse patients (clinic-scoped)
- Create, view, edit, delete notes
- Filter notes by tag, date range
- Upload/download attachments
- Pagination (Load More)
- Multi-tenant isolation (switch users to see different clinics)

### Quick Start - Swagger UI (API Testing)

```bash
# Clone the docs repository
git clone https://github.com/devchuckcamp/open-docs-api.git
cd open-docs-api/swagger
npm install
npm start
```

Open http://localhost:3030 for interactive API documentation with "Try it out" functionality.

### Quick Start - Quick & Direct API Testing (curl)

```bash
# API Base URL (already deployed)
API_URL="https://gksonzdd9g.execute-api.us-east-1.amazonaws.com/dev"

# Get a token
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"dr-smith","password":"SecurePass123!"}'

# Use the idToken from response
TOKEN="<paste idToken here>"

# List notes
curl "$API_URL/patients/pat-20001/notes" \
  -H "Authorization: Bearer $TOKEN"

# Refresh token (when access token expires)
curl -X POST "$API_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"username":"dr-smith","refreshToken":"<paste refreshToken here>"}'
```

---

## Getting AWS Resource Values

After deploying the stack, you'll need these values for local development and configuration.

### Value Reference

| Placeholder | Format Example | Description |
|-------------|----------------|-------------|
| `<API_ID>` | `abc123def4` | API Gateway HTTP API identifier |
| `<YOUR_USER_POOL_ID>` | `us-east-1_AbCdEfGhI` | Cognito User Pool ID (region + underscore + ID) |
| `<YOUR_CLIENT_ID>` | `1abc2def3ghi4jkl5mno6pqr` | Cognito App Client ID |
| `<YOUR_CLIENT_SECRET>` | `abcdef123456...` | Cognito App Client Secret (long string) |

### Configuring AWS CLI with SSO

If your organization uses AWS IAM Identity Center (SSO), configure your CLI profile first:

```bash
# Configure SSO profile (interactive - opens browser for authentication)
aws configure sso
```

You'll be prompted for:
| Prompt | Example Value |
|--------|---------------|
| SSO session name | `my-sso` |
| SSO start URL | `https://your-org.awsapps.com/start` |
| SSO region | `us-east-1` |
| SSO registration scopes | (press Enter for default) |

After browser authentication, select your account and role, then:
| Prompt | Example Value |
|--------|---------------|
| CLI default client Region | `us-east-1` |
| CLI default output format | `json` |
| CLI profile name | `snoremd-dev` |

**Login to SSO (when session expires):**
```bash
# Login with your SSO profile
aws sso login --profile snoremd-dev

# Set as default profile for current terminal session
export AWS_PROFILE=snoremd-dev        # Linux/Mac
set AWS_PROFILE=snoremd-dev           # Windows CMD
$env:AWS_PROFILE = "snoremd-dev"      # Windows PowerShell
```

**Verify authentication:**
```bash
aws sts get-caller-identity --profile snoremd-dev
```

### Using AWS CLI

Once authenticated (via SSO or access keys), retrieve resource values:

```bash
# Add --profile snoremd-dev to all commands if using SSO profile

# 1. Get API Gateway ID
aws apigatewayv2 get-apis --query "Items[?Name=='snoremd-app'].ApiId" --output text

# 2. Get Cognito User Pool ID
aws cognito-idp list-user-pools --max-results 20 --query "UserPools[?Name=='snoremd-users'].Id" --output text

# 3. Get Cognito Client ID (replace <USER_POOL_ID> with value from step 2)
aws cognito-idp list-user-pool-clients --user-pool-id <USER_POOL_ID> --query "UserPoolClients[0].ClientId" --output text

# 4. Get Cognito Client Secret (replace both placeholders)
aws cognito-idp describe-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-id <CLIENT_ID> \
  --query "UserPoolClient.ClientSecret" \
  --output text
```

**Tip:** If using SSO, either set `AWS_PROFILE` environment variable or add `--profile snoremd-dev` to each command.

### Using AWS Console

| Value | Where to Find |
|-------|---------------|
| **API_ID** | API Gateway → APIs → `snoremd-app` → Copy the API ID from the URL or details |
| **USER_POOL_ID** | Cognito → User Pools → Select your pool → Copy "User pool ID" |
| **CLIENT_ID** | Cognito → User Pools → App integration → App clients → Copy "Client ID" |
| **CLIENT_SECRET** | Cognito → User Pools → App integration → App clients → Click client → Show client secret |

### Using CloudFormation Outputs

If deployed via SAM, outputs are available in CloudFormation:

```bash
# Get all stack outputs
aws cloudformation describe-stacks --stack-name snoremd-app --query "Stacks[0].Outputs"

# Get specific output (API Endpoint)
aws cloudformation describe-stacks --stack-name snoremd-app \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
```

---

## Option B: Local Development Setup

Run the API locally with SAM CLI and DynamoDB Local.

### Prerequisites (Local Development)

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 20+ | https://nodejs.org/ |
| **npm** | 10+ | Comes with Node.js |
| **AWS CLI** | 2.x | https://aws.amazon.com/cli/ |
| **SAM CLI** | 1.x | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| **Docker** | Latest | https://www.docker.com/get-started |
| **Git** | Any | https://git-scm.com/ |

### Step 1: Clone and Install

```bash
git clone <repository-url>
cd snoremd-api
npm install
```

### Step 2: Start DynamoDB Local

DynamoDB Local runs **completely independently** - no AWS account required.

```bash
# Start DynamoDB Local container
npm run dev:docker

# Verify it's running
docker ps | grep dynamodb

# Create table and import test data (681 items)
npm run dev:docker:init
```

**DynamoDB Local Commands:**

| Command | Description |
|---------|-------------|
| `npm run dev:docker` | Start DynamoDB Local container |
| `npm run dev:docker:stop` | Stop DynamoDB Local container |
| `npm run dev:docker:init` | Create table + import data from `dynamodb-export.json` |

**What gets imported:**
- 3 clinics with metadata
- 30 patients (10 per clinic)
- 600+ clinical notes with various tags and dates

**To reset the database:**
```bash
npm run dev:docker:stop
npm run dev:docker
npm run dev:docker:init
```

### Step 3: Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` with your Cognito credentials (required for `/auth/login`):

```bash
# Get your Cognito Client Secret
aws cognito-idp describe-user-pool-client \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --client-id <YOUR_CLIENT_ID> \
  --query "UserPoolClient.ClientSecret" \
  --output text
```

Update `.env`:
```
COGNITO_USER_POOL_ID=<YOUR_USER_POOL_ID>
COGNITO_CLIENT_ID=<YOUR_CLIENT_ID>
COGNITO_CLIENT_SECRET=<paste-secret-here>
```

### Step 4: Create SAM Environment File

Create `sam-env.json` in the project root with environment variables for each Lambda function:

```json
{
  "CreateNoteFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "ListNotesFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "ListPatientsFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "GetClinicFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "GetNoteFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "UpdateNoteFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "DeleteNoteFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "PresignUploadFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "PresignDownloadFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "ATTACHMENTS_BUCKET": "snoremd-attachments-dev",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "LoginFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "COGNITO_USER_POOL_ID": "<YOUR_USER_POOL_ID>",
    "COGNITO_CLIENT_ID": "<YOUR_CLIENT_ID>",
    "COGNITO_CLIENT_SECRET": "<YOUR_CLIENT_SECRET>",
    "AWS_REGION": "<YOUR-REGION>"
  },
  "RefreshTokenFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
    "TABLE_NAME": "SnoreMDNotes-dev",
    "COGNITO_USER_POOL_ID": "<YOUR_USER_POOL_ID>",
    "COGNITO_CLIENT_ID": "<YOUR_CLIENT_ID>",
    "COGNITO_CLIENT_SECRET": "<YOUR_CLIENT_SECRET>",
    "AWS_REGION": "<YOUR-REGION>"
  }
}
```

### Step 5: Build and Start

```bash
# Build SAM application
npm run sam:build

# Start local API
npm run dev
```

The API will be available at **http://localhost:3000**.

### Step 6: Test the API

```bash
# Login with Cognito credentials
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"dr-smith","password":"SecurePass123!"}'
```

### Troubleshooting Local Development

| Issue | Solution |
|-------|----------|
| `sam-env.json not found` | Create the file in project root (see Step 4) |
| `COGNITO_CLIENT_SECRET is empty` | Get secret via AWS CLI and update sam-env.json |
| `DynamoDB connection refused` | Ensure Docker is running and DynamoDB Local started |
| `Port 3000 in use` | Stop other processes or change SAM port |

---

## Option C: Full AWS Deployment (Deploy Your Own)

If you want to deploy your own instance of SnoreMD to AWS.

### Prerequisites (Full Setup)

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 20+ | https://nodejs.org/ |
| **npm** | 10+ | Comes with Node.js |
| **AWS CLI** | 2.x | https://aws.amazon.com/cli/ |
| **SAM CLI** | 1.x | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| **Docker** | Latest | https://www.docker.com/get-started (for local DynamoDB) |
| **Git** | Any | https://git-scm.com/ |

### AWS Account Requirements

You need an AWS account with permissions to create:
- Lambda functions
- API Gateway (HTTP API)
- DynamoDB tables
- S3 buckets
- IAM roles
- Cognito User Pools
- KMS keys
- CloudWatch log groups

### Setup Steps

#### 1. Configure AWS CLI

```bash
# Configure with your credentials
aws configure

# Verify access
aws sts get-caller-identity
```

#### 2. Create Cognito User Pool

Create a Cognito User Pool with:
- Custom attribute: `custom:clinicId`
- App client with USER_PASSWORD_AUTH flow enabled
- Groups for roles (optional)

Note the User Pool ARN for deployment.

#### 3. Clone and Install Dependencies

```bash
git clone <repository-url>
cd snoremd/
npm install
```

#### 4. Deploy with SAM (Guided)

```bash
cd infra

# Build the application
sam build

# First-time deployment (interactive)
sam deploy --guided
```

**Guided Deployment Prompts:**

The `--guided` flag walks you through configuration. Here's what each prompt means:

| Prompt | Recommended Value | Description |
|--------|-------------------|-------------|
| Stack Name | `snoremd-app` | CloudFormation stack name |
| AWS Region | `us-east-1` | Deployment region |
| Parameter Environment | `dev` | Environment name (dev/staging/prod) |
| Parameter CognitoUserPoolArn | `arn:aws:cognito-idp:...` | Full ARN of your Cognito User Pool |
| Parameter CognitoUserPoolId | `us-east-1_AbCdEfGhI` | User Pool ID (from Cognito) |
| Parameter CognitoClientId | `1abc2def3ghi...` | App Client ID (from Cognito) |
| Parameter CognitoClientSecret | `abcdef123...` | App Client Secret (from Cognito) |
| Confirm changes before deploy | `Y` | Review changes before applying |
| Allow SAM CLI IAM role creation | `Y` | Required for Lambda execution roles |
| Disable rollback | `N` | Keep `N` for production safety |
| Save arguments to samconfig.toml | `Y` | Saves config for future `sam deploy` |

**Example Session:**

```
Setting default arguments for 'sam deploy'
=========================================
Stack Name [sam-app]: snoremd-app
AWS Region [us-east-1]: us-east-1
Parameter Environment [dev]: dev
Parameter CognitoUserPoolArn []: arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_AbCdEfGhI
Parameter CognitoUserPoolId []: us-east-1_AbCdEfGhI
Parameter CognitoClientId []: 1abc2def3ghi4jkl5mno6pqr
Parameter CognitoClientSecret []: your-client-secret-here
Confirm changes before deploy [y/N]: y
Allow SAM CLI IAM role creation [Y/n]: Y
Disable rollback [y/N]: N
Save arguments to configuration file [Y/n]: Y
SAM configuration file [samconfig.toml]: samconfig.toml
SAM configuration environment [default]: default
```

**After Deployment:**

SAM outputs important values:

```
CloudFormation outputs from deployed stack
------------------------------------------
Key                 ApiEndpoint
Description         HTTP API endpoint URL
Value               https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>

Key                 NotesTableName
Description         DynamoDB table name
Value               SnoreMDNotes-dev

Key                 AttachmentsBucketName
Description         S3 bucket for attachments
Value               snoremd-attachments-123456789012-dev
```

**Subsequent Deployments:**

After the first guided deployment, configuration is saved to `samconfig.toml`. Just run:

```bash
cd infra
sam build
sam deploy
```

#### 5. Create Test Users in Cognito

Create users with `custom:clinicId` attribute set to their clinic identifier.

#### 6. Import Test Data (Optional)

```bash
# Import sample data
node scripts/dynamodb-import.js dynamodb-export.json
```

#### 7. Run Frontend Against Your Stack

```bash
git clone https://github.com/devchuckcamp/clinic-web-ui.git

cd ../clinic-web-ui

# Option A: Use already deployed API (recommended for testing)
echo "VITE_API_URL=https://gksonzdd9g.execute-api.us-east-1.amazonaws.com/dev" > .env

# Option B: Use your own deployed API
echo "VITE_API_URL=https://<YOUR-API-ID>.execute-api.<YOUR-REGION>.amazonaws.com/<YOUR-STAGE>" > .env

npm install
npm run dev
```

### Subsequent Deployments

```bash
cd /infra
sam build
sam deploy
```

**Tenant Isolation:** Each user can only access patients from their own clinic.

---

## API Reference

**Deployed Base URL:** `https://gksonzdd9g.execute-api.us-east-1.amazonaws.com/dev`

**Your Own Deployment:** `https://<API_ID>.execute-api.<REGION>.amazonaws.com/<STAGE>`

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | None | Get JWT tokens |
| POST | `/auth/refresh` | None | Exchange refresh token for new tokens |

### Notes API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/patients/{patientId}/notes` | JWT | List notes (paginated) |
| POST | `/patients/{patientId}/notes` | JWT | Create a note |
| GET | `/patients/{patientId}/notes/{noteId}` | JWT | Get single note |
| PUT | `/patients/{patientId}/notes/{noteId}` | JWT | Update note |
| DELETE | `/patients/{patientId}/notes/{noteId}` | JWT | Soft delete note |

### Attachments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/patients/{patientId}/notes/{noteId}/attachments/presign` | JWT | Get S3 upload URL |
| GET | `/patients/{patientId}/notes/{noteId}/attachments/{attachmentId}/download` | JWT | Get S3 download URL |

### Other

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/clinic` | JWT | Get current clinic info |
| GET | `/patients` | JWT | List patients for clinic |

### Query Parameters (List Notes)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `limit` | Items per page (default: 10, max: 100) | `?limit=20` |
| `cursor` | Pagination cursor | `?cursor=eyJQSy...` |
| `tag` | Filter by tag | `?tag=follow-up` |
| `from` | Study date start | `?from=2024-01-01` |
| `to` | Study date end | `?to=2024-12-31` |

---

## AWS Console Access (Read-Only)

To inspect the deployed architecture:

| | |
|-|-|
| **URL** | https://YOUR_ACCOUNT_ID.signin.aws.amazon.com/console |
| **Username** | `snoremdassessor` |
| **Password** | `YOUR_PASSWORD` |
| **Region** | ca-central-1 (Canada Central) |

### What You Can View

| Service | Navigate To |
|---------|-------------|
| **Lambda** | Lambda > Functions > Search "snoremd" |
| **DynamoDB** | DynamoDB > Tables > `SnoreMDNotes-dev` |
| **API Gateway** | API Gateway > APIs > `snoremd-app` |
| **S3** | S3 > `snoremd-attachments-YOUR_ACCOUNT_ID-dev` |
| **CloudWatch** | CloudWatch > Log groups > `/aws/lambda/snoremd-*` |

---

## Running Tests

### Backend Unit Tests

```bash
npm install
npm test
```

### Frontend Tests

```bash
cd clinic-web-ui
npm install
npm test
```

---

## Key Implementation Highlights

### Security Features

| Feature | Implementation |
|---------|---------------|
| **Authentication** | AWS Cognito JWT tokens |
| **Tenant Isolation** | clinicId in partition key + JWT claims |
| **Encryption** | KMS for DynamoDB and S3 |
| **Rate Limiting** | API Gateway throttling (100 burst/50 rate default) |
| **Soft Deletes** | deletedAt timestamp, never hard delete |

### API Features

| Feature | Implementation |
|---------|---------------|
| **Pagination** | Cursor-based (DynamoDB LastEvaluatedKey) |
| **Filtering** | Tag, date range server-side filters |
| **Optimistic Concurrency** | Version field with conditional writes |
| **File Uploads** | Presigned S3 URLs (never through Lambda) |

### Rate Limits

| Endpoint | Burst | Rate |
|----------|-------|------|
| Default | 100 | 50/sec |
| Login | 10 | 5/sec |
| Create Note | 50 | 25/sec |
| Presign Upload | 20 | 10/sec |

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│ API Gateway │────▶│   Lambda    │
│   Frontend  │     │  (HTTP API) │     │  Functions  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                    ┌──────┴──────┐             │
                    │   Cognito   │             ▼
                    │  (JWT Auth) │      ┌─────────────┐
                    └─────────────┘      │  DynamoDB   │
                                         │(Single-Table)│
                                         └─────────────┘
                                                │
                                         ┌──────┴──────┐
                                         │     S3      │
                                         │(Attachments)│
                                         └─────────────┘
                                                │
                                         ┌──────┴──────┐
                                         │     KMS     │
                                         │ (Encryption)│
                                         └─────────────┘
```

---

## Summary

| Goal | Action |
|------|--------|
| **Test via Web UI** | Clone [clinic-web-ui](https://github.com/devchuckcamp/clinic-web-ui), `cd clinic-web-ui && npm install && npm start` → http://localhost:3001 |
| **Test via Swagger** | Clone [open-docs-api](https://github.com/devchuckcamp/open-docs-api), `cd open-docs-api && npm install && npm start` → http://localhost:3030 |
| **Test via curl** | Use API examples above |
| **Run tests** | `cd sam-serverless-api && npm test` or `cd clinic-web-ui && npm test` |
| **View AWS resources** | Login to Console with assessor credentials `GETTING_STARTED.md` |
| **Deploy your own** | Follow "Option B" with AWS CLI + SAM CLI |
