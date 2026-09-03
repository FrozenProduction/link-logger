#!/bin/bash
# Integration test script for Link Logger — run locally to verify before deployment

set -e

API_URL="${API_URL:-http://localhost:8000}"
echo "=== Link Logger Integration Test Suite ==="
echo "API URL: $API_URL"
echo ""

# 1. Health check
echo "1. Health check..."
HEALTH=$(curl -s "$API_URL/api/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "   ✓ Health OK: $HEALTH"
else
    echo "   ✗ Health FAILED: $HEALTH"
    exit 1
fi
echo ""

# 2. Create link
echo "2. Creating short link..."
LINK=$(curl -s -X POST "$API_URL/api/links" \
    -H "Content-Type: application/json" \
    -d '{"original_url":"https://example.com/integration-test","custom_code":"test123"}')
if echo "$LINK" | grep -q '"short_code":"test123"'; then
    echo "   ✓ Link created: $LINK"
else
    echo "   ✗ Create link FAILED: $LINK"
    exit 1
fi
echo ""

# 3. List links
echo "3. Listing links..."
LIST=$(curl -s "$API_URL/api/links")
echo "   Links: $LIST"
echo ""

# 4. Link details
echo "4. Link details for #1..."
DETAIL=$(curl -s "$API_URL/api/links/1")
echo "   Detail: $DETAIL"
echo ""

# 5. Redirect test (headers only)
echo "5. Redirect test (HTTP headers only)..."
REDIRECT=$(curl -s -o /dev/null -w "HTTP %{http_code} → %{redirect_url}\n" "$API_URL/test123")
echo "   Result: $REDIRECT"
echo ""

# 6. Analytics after redirect
echo "6. Analytics after redirect..."
ANALYTICS=$(curl -s "$API_URL/api/links/1")
CLICK_COUNT=$(echo "$ANALYTICS" | grep -o '"clicks":[0-9]*' | cut -d: -f2)
echo "   Clicks on link #1: $CLICK_COUNT (expected: >= 1)"
if [ "$CLICK_COUNT" -ge 1 ] 2>/dev/null; then
    echo "   ✓ Analytics working"
else
    echo "   ✗ Analytics FAILED"
    exit 1
fi
echo ""

echo "=== All tests passed ==="
