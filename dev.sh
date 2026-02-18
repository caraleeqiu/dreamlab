#!/bin/bash
# Dreamlab 本地开发启动脚本
# 从 macOS Keychain 读取所有 secret，不落盘明文

_kc() { security find-generic-password -a dreamlab -s "$1" -w 2>/dev/null; }

export KLING_ACCESS_KEY=$(_kc KLING_ACCESS_KEY)
export KLING_SECRET_KEY=$(_kc KLING_SECRET_KEY)
export GEMINI_API_KEY=$(_kc GEMINI_API_KEY)
export CF_ACCOUNT_ID=$(_kc CF_ACCOUNT_ID)
export R2_ACCESS_KEY_ID=$(_kc R2_ACCESS_KEY_ID)
export R2_SECRET_ACCESS_KEY=$(_kc R2_SECRET_ACCESS_KEY)
export R2_ENDPOINT="https://$(_kc CF_ACCOUNT_ID).r2.cloudflarestorage.com"
export SUPABASE_SERVICE_ROLE_KEY=$(_kc SUPABASE_SERVICE_ROLE_KEY)
export STRIPE_SECRET_KEY=$(_kc STRIPE_SECRET_KEY)
export STRIPE_WEBHOOK_SECRET=$(_kc STRIPE_WEBHOOK_SECRET)

unset -f _kc

npm run dev
