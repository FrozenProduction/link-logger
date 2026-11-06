#!/bin/bash
# Integration test script for Link Logger — run locally to verify before deployment

set -e

API_URL="${API_URL:-http://localhost:8000}"
# Unique per run so the suite can be re-run against a database that already has
# rows in it (it used to fail with "Custom code already exists" the second time).
CODE="t$(date +%H%M%S)"
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
    -d "{\"original_url\":\"https://example.com/integration-test\",\"custom_code\":\"$CODE\"}")
if echo "$LINK" | grep -q "\"short_code\":\"$CODE\""; then
    echo "   ✓ Link created: $LINK"
else
    echo "   ✗ Create link FAILED: $LINK"
    exit 1
fi

# Extract the link ID from the create response so the rest of the suite
# works correctly even if the DB already contains other rows.
LINK_ID=$(echo "$LINK" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['id'])")
echo "   (using link ID: $LINK_ID)"
echo ""

# 3. List links
echo "3. Listing links..."
LIST=$(curl -s "$API_URL/api/links")
echo "   Links: $LIST"
echo ""

# 4. Link details
echo "4. Link details for #$LINK_ID..."
DETAIL=$(curl -s "$API_URL/api/links/$LINK_ID")
echo "   Detail: $DETAIL"
echo ""

# 5. Redirect test (headers only)
echo "5. Redirect test (HTTP headers only)..."
REDIRECT=$(curl -s -o /dev/null -w "HTTP %{http_code} → %{redirect_url}\n" "$API_URL/$CODE")
echo "   Result: $REDIRECT"
echo ""

# 6. Analytics after redirect
echo "6. Analytics after redirect..."
ANALYTICS=$(curl -s "$API_URL/api/links/$LINK_ID")
CLICK_COUNT=$(echo "$ANALYTICS" | grep -o '"clicks":[0-9]*' | cut -d: -f2)
echo "   Clicks on link #$LINK_ID: $CLICK_COUNT (expected: >= 1)"
if [ "$CLICK_COUNT" -ge 1 ] 2>/dev/null; then
    echo "   ✓ Analytics working"
else
    echo "   ✗ Analytics FAILED"
    exit 1
fi
echo ""

echo "=== All tests passed ==="
