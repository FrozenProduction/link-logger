#!/bin/bash
# Integration test script for Link Logger — run locally to verify before deployment
#
# Every call carries an X-Owner-Token, the per-browser scope the API requires.
# The slot-filling checks only run against a local API: against the deployed
# demo they would leave ten junk rows behind for 30 days.

set -e

API_URL="${API_URL:-http://localhost:8000}"
# Unique per run: the suite can be re-run against a database that already has
# rows, and two runs cannot see each other's links.
STAMP=$(date +%H%M%S)
CODE="t${STAMP}"
TOKEN="suite-${STAMP}-a"
OTHER="suite-${STAMP}-b"
EVICT="suite-${STAMP}-e"

# JSON field from stdin, e.g. echo "$BODY" | jget id
jget() { python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }

echo "=== Link Logger Integration Test Suite ==="
echo "API URL: $API_URL"
echo "Owner token: $TOKEN"
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
    -H "X-Owner-Token: $TOKEN" \
    -d "{\"original_url\":\"https://example.com/integration-test\",\"custom_code\":\"$CODE\"}")
if echo "$LINK" | grep -q "\"short_code\":\"$CODE\""; then
    echo "   ✓ Link created: $LINK"
else
    echo "   ✗ Create link FAILED: $LINK"
    exit 1
fi
LINK_ID=$(echo "$LINK" | jget id)
echo "   (using link ID: $LINK_ID, expires $(echo "$LINK" | jget expires_at))"
echo ""

# 2b. The header is the only thing keeping lists apart — assert it is enforced.
echo "2b. Create without an owner token must be rejected..."
NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/links" \
    -H "Content-Type: application/json" \
    -d '{"original_url":"https://example.com/no-token"}')
if [ "$NO_TOKEN" = "400" ]; then
    echo "   ✓ Rejected with 400"
else
    echo "   ✗ Expected 400, got $NO_TOKEN"
    exit 1
fi
echo ""

# 3. List links
echo "3. Listing links..."
LIST=$(curl -s "$API_URL/api/links" -H "X-Owner-Token: $TOKEN")
echo "   Links: $LIST"
if echo "$LIST" | grep -q "\"short_code\":\"$CODE\""; then
    echo "   ✓ Own link listed"
else
    echo "   ✗ Own link missing from the list"
    exit 1
fi
echo ""

# 4. Link details
echo "4. Link details for #$LINK_ID..."
DETAIL=$(curl -s "$API_URL/api/links/$LINK_ID" -H "X-Owner-Token: $TOKEN")
echo "   Detail: $DETAIL"
echo ""

# 5. Redirect test (headers only)
echo "5. Redirect test (HTTP headers only)..."
REDIRECT=$(curl -s -o /dev/null -w "HTTP %{http_code} → %{redirect_url}" "$API_URL/$CODE")
echo "   Result: $REDIRECT"
if echo "$REDIRECT" | grep -q "HTTP 302"; then
    echo "   ✓ Redirect works"
else
    echo "   ✗ Redirect FAILED"
    exit 1
fi
echo ""

# 6. Analytics after redirect
echo "6. Analytics after redirect..."
ANALYTICS=$(curl -s "$API_URL/api/links/$LINK_ID" -H "X-Owner-Token: $TOKEN")
CLICK_COUNT=$(echo "$ANALYTICS" | grep -o '"clicks":[0-9]*' | head -1 | cut -d: -f2)
echo "   Clicks on link #$LINK_ID: $CLICK_COUNT (expected: >= 1)"
if [ "$CLICK_COUNT" -ge 1 ] 2>/dev/null; then
    echo "   ✓ Analytics working"
else
    echo "   ✗ Analytics FAILED"
    exit 1
fi
echo ""

if [[ "$API_URL" == *localhost* || "$API_URL" == *127.0.0.1* ]]; then
    # 7. Owner isolation
    echo "7. Another browser must not see or delete this link..."
    OTHER_LIST=$(curl -s "$API_URL/api/links" -H "X-Owner-Token: $OTHER")
    OTHER_DELETE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_URL/api/links/$LINK_ID" -H "X-Owner-Token: $OTHER")
    if [ "$OTHER_LIST" = "[]" ] && [ "$OTHER_DELETE" = "404" ]; then
        echo "   ✓ Isolated (list empty, delete 404)"
    else
        echo "   ✗ Isolation FAILED: list=$OTHER_LIST delete=$OTHER_DELETE"
        exit 1
    fi
    echo ""

    # 8. Slot eviction: 11 links in one browser keep the newest 10
    echo "8. Slot eviction (create 11, keep 10)..."
    for i in $(seq 0 9); do
        curl -s -o /dev/null -X POST "$API_URL/api/links" \
            -H "Content-Type: application/json" -H "X-Owner-Token: $EVICT" \
            -d "{\"original_url\":\"https://example.com/slot-$i\",\"custom_code\":\"slot${STAMP}${i}\"}"
    done
    ELEVENTH=$(curl -s -X POST "$API_URL/api/links" \
        -H "Content-Type: application/json" -H "X-Owner-Token: $EVICT" \
        -d "{\"original_url\":\"https://example.com/slot-10\",\"custom_code\":\"slot${STAMP}x\"}")
    EVICTED=$(echo "$ELEVENTH" | jget evicted_code)
    COUNT=$(curl -s "$API_URL/api/links" -H "X-Owner-Token: $EVICT" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
    GONE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/slot${STAMP}0")
    echo "   Evicted: $EVICTED | listed: $COUNT | evicted code now: HTTP $GONE"
    if [ "$EVICTED" = "slot${STAMP}0" ] && [ "$COUNT" = "10" ] && [ "$GONE" = "404" ]; then
        echo "   ✓ Eviction keeps exactly 10 and removes the oldest"
    else
        echo "   ✗ Eviction FAILED"
        exit 1
    fi
    echo ""
else
    echo "7-8. Eviction and isolation skipped (they leave rows; run them locally)"
    echo ""
fi

echo "=== All tests passed ==="
