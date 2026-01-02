
# Ikon Agent Contract Upload (Client + Back Office)

This repo contains:

- **frontend/** – Next.js 13 + React 18 + AWS Amplify **UI v2**
  - Client portal:
    - Login with Cognito
    - Upload contracts to S3 using a **presigned URL**
    - View **own** contracts
  - Back office:
    - Separate login page (`/backoffice`)
    - Only users in Cognito group (default `backoffice`) can see **all** contracts

- **backend/** – Node.js Lambdas:
  - `presign` – returns S3 presigned PUT URL
  - `listUserContracts` – lists contracts for the current `sub`
  - `listAllContracts` – lists **all** contracts, restricted to `backoffice` group

- **sam/** – AWS SAM template to deploy:
  - API Gateway + Cognito authorizer
  - S3 bucket
  - 3 Lambda functions

- **amplify/** – Amplify Hosting build config (optional)

## Prereqs

- Node.js 20.x
- npm 10.x
- AWS CLI configured
- AWS SAM CLI
- An existing **Cognito User Pool** with:
  - App client (no secret)
  - A group for back office, e.g. `backoffice`

## 1. Install backend dependencies

```bash
cd backend/presign
npm install
cd ..\listAllContracts\
npm install
npm ci
cd ../listUserContracts
npm install
npm ci
```

## 2. Deploy backend via SAM

```bash
cd ..\..\sam\ or cd .\sam\
sam build
sam validate or sam validate --template-file template.yaml
sam validate --config-env dev
sam deploy --config-env dev
sam deploy --guided --config-env dev (for loading values from samconfig.toml)

sam deploy --guided   (if you are deploying 1st time without samconfig.toml)
sam deploy --capabilities CAPABILITY_NAMED_IAM \
  --execution-role-arn arn:aws:iam::383076433643:role/ikon-real-estate-contract-execution


```

When prompted enter:

- Stack name: `ikon-real-estate-contract-backend-auth`
- Region: `us-east-1` (or your region)
- Parameter `CognitoUserPoolArn`: arn:aws:cognito-idp:us-east-1:383076433643:userpool/us-east-1_z1SpTud18 (paste the **User Pool ARN** from the Cognito console)
- Parameter BackofficeGroupName [backoffice]: backoffice
- Allow SAM to create IAM roles: `Y`
- Disable rollback [y/N]: n
- Save arguments to samconfig.toml: `Y`
- SAM configuration file [samconfig.toml]: samconfig.toml
- SAM configuration environment [default]: dev

After deployment, note the outputs:

- `ApiUrl` – e.g. `https://diyy6evqk6.execute-api.us-east-1.amazonaws.com/Prod`
- `BucketName` – e.g. `ikon-contracts-383076433643`


## 3. Configure Cognito for back office

1. In your User Pool, create a group:

   - Name: `backoffice`

2. Add back-office users to this group.

3. When they log in via Amplify Authenticator, their ID token will contain:

   - `cognito:groups: ["backoffice"]`

Backend and frontend both check this group.

## 4. Configure frontend

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:

- `NEXT_PUBLIC_AWS_REGION` = your region (e.g. `us-east-1`)
- `NEXT_PUBLIC_USER_POOL_ID` = Cognito user pool ID
- `NEXT_PUBLIC_USER_POOL_CLIENT_ID` = app client ID
- `NEXT_PUBLIC_IDENTITY_POOL_ID` = identity pool id (optional)
- `NEXT_PUBLIC_API_URL` = ApiUrl from SAM (no trailing slash)
- `NEXT_PUBLIC_S3_BUCKET` = BucketName from SAM
- `NEXT_PUBLIC_BACKOFFICE_GROUP` = `backoffice`

## 5. Run frontend locally

```bash

npm install axios cheerio
cd frontend
node src/scripts/scrapeRoster.js
npm install
npm run dev
```

Open:

- Client portal: http://localhost:3000
  - Upload contracts: `/upload`
  - View own contracts: `/dashboard`
- Back office: http://localhost:3000/backoffice
  - Only users in the `backoffice` group can see **all** contracts.

## 6. Deploy frontend with Amplify Hosting (optional)

1. Zip or push the repo to GitHub.
2. In AWS Amplify Console:
   - Connect your GitHub repo.
   - Select the `frontend` folder as the root.
   - Amplify will use `amplify/amplify.yml` to build.

Or deploy manually:

```bash
cd frontend
npm run build
# then deploy .next/ via your hosting of choice
```

## 7. Security notes

- S3 keys use `contracts/{sub}/{timestamp}_{filename}`:
  - Client users can only list their own prefix.
  - Back office Lambda enforces group membership server-side.
- API Gateway is protected by Cognito authorizer; Lambdas read claims from the JWT.
Always review and tighten IAM policies and bucket settings before production.


# IKON Contract OS (Address + Stages + Commission)

This repo is a **drop-in upgrade** for your existing "contract upload + dashboards" work:
- VA/MD/DC address search (street number + street name only)
- Upload unlocked only after address selected
- Server-enforced S3 naming: `"123 Main St Contract.pdf"`
- Shared contract status across Agent + Admin dashboards
- Contract stages:
  1) EMD Collected
  2) Home Inspection Completed
  3) Financial & Appraisal Contingency Removed
  4) Closed
  5) Commission Disbursement (with **Special Notes**, ALTA upload required)

## Architecture
- Frontend: Next.js (pages router) + Tailwind
- Backend: API Gateway + Lambda + DynamoDB + S3 (SAM template included)

> If you already have an API deployed, you can copy the **frontend components/pages** and the **backend lambdas** you need.

---

## Quick start (Frontend)
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Quick start (Backend - SAM)
```bash
cd backend\sam
sam build
sam deploy --guided --capabilities CAPABILITY_NAMED_IAM
```

### Environment variables
Frontend `.env.local`:
- `NEXT_PUBLIC_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/Prod`
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=...` (optional)
- `NEXT_PUBLIC_ADDRESS_PROVIDER=mock|google` (default `mock`)

Backend env (SAM parameters):
- `BUCKET_NAME`
- `CONTRACTS_TABLE`

---

## Address provider
This repo ships with a **mock address search** so you can run immediately.
To switch to Google Places:
1. Set `NEXT_PUBLIC_ADDRESS_PROVIDER=google`
2. Set `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=...`
3. Use the built-in REST endpoint in `pages/api/address/google.ts`

---

## Permissions model
- Agents: create contracts, upload files, update stage checklist fields
- Admins: everything + commission disbursement submission and stage overrides

The backend enforces these rules server-side.

---

## Folder naming in S3
Keys are generated like:
`<AgentFolder>/<StreetNumber> <StreetName> Contract.<ext>`

Example:
`Raj-Patel/123 Main St Contract.pdf`

# force layer rebuilt
terraform taint aws_lambda_layer_version.app_shared

terraform init
terraform validate
terraform plan
terraform apply --auto-approve

aws sts get-caller-identity
aws lambda get-function-configuration --function-name checkEmail --region us-east-1 | Select-String "Timeout|MemorySize"

terraform import aws_sqs_queue.reminder_email https://sqs.us-east-1.amazonaws.com/383076433643/ikon-reminder-email

aws lambda get-function --function-name reminderCheck | Select-String FunctionArn

terraform state list | Select-String aws_lambda_function

terraform state rm aws_apigatewayv2_api.http

terraform import aws_apigatewayv2_api.http 5we5r55vg6

terraform state show aws_apigatewayv2_api.http | Select-String id

aws apigatewayv2 delete-api --api-id 5cajkcfhc2

terraform state show aws_cloudwatch_log_group.apigw_access

aws scheduler get-schedule --name ikon-reminder-daily

# How to Manually invoke the lambda

aws lambda invoke --function-name reminderCheck out.json

# How to deploy single lambda
terraform apply -target='aws_lambda_function.fn["reminderCheck"]'

terraform apply -target='aws_lambda_function.fn["reminderEmailSender"]'

# how to do es linting
npm install -D @babel/eslint-parser

npm install -D husky lint-staged

npx husky add .husky/pre-commit "npx lint-staged"

npm run prepare          # should be silent
npx lint-staged          # should run eslint
npx eslint src           # should parse JSX correctly
npx lint-staged
git commit -m "test husky + eslint"
