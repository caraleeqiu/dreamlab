#!/bin/bash
# Deploy AI Visual Tutor to Google Cloud Run
# Required for: Gemini Live Agent Challenge (automated deployment)

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
SERVICE_NAME="visual-tutor"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying AI Visual Tutor to Cloud Run"
echo "   Project: ${PROJECT_ID}"
echo "   Region: ${REGION}"
echo "   Service: ${SERVICE_NAME}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Check if logged in
if ! gcloud auth print-identity-token &> /dev/null; then
    echo "❌ Not logged in to gcloud. Run: gcloud auth login"
    exit 1
fi

# Set project
gcloud config set project ${PROJECT_ID}

# Build and push image
echo "📦 Building Docker image..."
gcloud builds submit --tag ${IMAGE_NAME}

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --set-env-vars "NODE_ENV=production" \
    --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
    --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
    --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
    --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" \
    --set-env-vars "KLING_ACCESS_KEY=${KLING_ACCESS_KEY}" \
    --set-env-vars "KLING_SECRET_KEY=${KLING_SECRET_KEY}" \
    --set-env-vars "R2_ACCOUNT_ID=${R2_ACCOUNT_ID}" \
    --set-env-vars "R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}" \
    --set-env-vars "R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}" \
    --set-env-vars "R2_BUCKET_NAME=${R2_BUCKET_NAME}" \
    --set-env-vars "R2_PUBLIC_URL=${R2_PUBLIC_URL}" \
    --set-env-vars "GCS_BUCKET_NAME=${GCS_BUCKET_NAME}"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "Next steps:"
echo "  1. Update NEXT_PUBLIC_APP_URL in Cloud Run to: ${SERVICE_URL}"
echo "  2. Configure Kling webhook callback URL"
echo "  3. Test the application"
