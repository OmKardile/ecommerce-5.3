#!/bin/bash
set +e
B=http://localhost:3000
CJ=/tmp/qa-cust.jar; AJ=/tmp/qa-admin.jar
rm -f $CJ $AJ
PHONE="9$((100000000 + RANDOM * 4096 + RANDOM))"

echo "== 1. customer OTP login ($PHONE) =="
MARK=$(wc -l < /home/z/my-project/dev.log)
curl -s -X POST $B/api/auth/otp/request -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}" >/dev/null
sleep 3
OTP=$(tail -n +$MARK /home/z/my-project/dev.log | grep -hE 'OTP: [0-9]{6}' | tail -1 | grep -oE 'OTP: [0-9]{6}' | awk '{print $2}')
echo "otp=$OTP"
V=$(curl -s -c $CJ -X POST $B/api/auth/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$OTP\"}")
echo "verify: $V"

echo "== 2. add to cart (fiber converter, in-stock) =="
curl -s -b $CJ -c $CJ -X POST $B/api/cart/item -H 'Content-Type: application/json' -d '{"skuId":"cmuihaejh006alt0jjijz7tqc","quantity":1}' | head -c 80; echo ""

echo "== 3. create COD order =="
ORDER=$(curl -s -b $CJ -w '\nHTTP:%{http_code}' -X POST $B/api/orders -H 'Content-Type: application/json' -d "{
  \"paymentMethod\":\"COD\",
  \"idempotencyKey\":\"rma-e2e-$RANDOM$RANDOM\",
  \"delivery\":{\"recipientName\":\"RMA Tester\",\"phone\":\"$PHONE\",\"addressLine1\":\"12 Ring Road, Adajan\",\"city\":\"Surat\",\"state\":\"Gujarat\",\"pincode\":\"395009\"}
}")
echo "$ORDER" | head -c 500; echo ""
BODY=$(echo "$ORDER" | head -1)
ONUM=$(echo "$BODY" | grep -oE '"orderNumber":"[^"]+"' | head -1 | cut -d'"' -f4)
OID=$(echo "$BODY" | grep -oE '"orderId":"[a-z0-9]+"' | head -1 | cut -d'"' -f4)
echo "orderNumber=$ONUM orderId=$OID"

echo "== 4. admin login =="
curl -s -c $AJ -X POST $B/api/admin/auth/login -H 'Content-Type: application/json' -d '{"email":"superadmin@patelnetworks.in","password":"patel@admin2026"}' | head -c 60; echo ""

echo "== 5. create shipment =="
SHIP=$(curl -s -b $AJ -X POST $B/api/admin/orders/shipment -H 'Content-Type: application/json' -d "{\"orderId\":\"$OID\",\"provider\":\"SHIPROCKET\"}")
echo "$SHIP" | head -c 240; echo ""
AWB=$(echo "$SHIP" | grep -oE '"awb":"[^"]+"' | head -1 | cut -d'"' -f4)
echo "awb=$AWB"

echo "== 5b. advance CONFIRMED -> PROCESSING -> PACKED =="
curl -s -b $AJ -X POST $B/api/admin/orders/transition -H 'Content-Type: application/json' -d "{\"orderId\":\"$OID\",\"status\":\"PROCESSING\"}" | head -c 80; echo ""
curl -s -b $AJ -X POST $B/api/admin/orders/transition -H 'Content-Type: application/json' -d "{\"orderId\":\"$OID\",\"status\":\"PACKED\"}" | head -c 80; echo ""

echo "== 6. carrier webhook =="
curl -s -X POST $B/api/webhooks/shipping -H 'Content-Type: application/json' -d "{\"awb\":\"$AWB\",\"status\":\"PICKED_UP\",\"location\":\"Surat Hub\"}" | head -c 90; echo ""
curl -s -X POST $B/api/webhooks/shipping -H 'Content-Type: application/json' -d "{\"awb\":\"$AWB\",\"status\":\"DELIVERED\",\"location\":\"Surat\"}" | head -c 90; echo ""

echo "== 7. customer requests return =="
curl -s -b $CJ -X POST "$B/api/orders/$ONUM/returns" -H 'Content-Type: application/json' -d '{"reason":"DOA — converter does not link, dead on arrival"}' | head -c 200; echo ""

echo "== 8a. admin approves =="
RID=$(curl -s -b $AJ "$B/api/admin/returns?status=REQUESTED" | grep -oE '"id":"[a-z0-9]+"' | head -1 | cut -d'"' -f4)
echo "returnId=$RID"
curl -s -b $AJ -X PATCH "$B/api/admin/returns?id=$RID" -H 'Content-Type: application/json' -d '{"action":"APPROVE"}' | head -c 90; echo ""

echo "== 8b. inward WITHOUT evidence must fail =="
curl -s -b $AJ -X PATCH "$B/api/admin/returns?id=$RID" -H 'Content-Type: application/json' -d '{"action":"MARK_RESTOCKED"}' | head -c 150; echo ""

echo "== 8c. bad docket must fail =="
curl -s -b $AJ -X PATCH "$B/api/admin/returns?id=$RID" -H 'Content-Type: application/json' -d '{"action":"MARK_RESTOCKED","inwardCourier":"Delhivery","inwardTracking":"ab"}' | head -c 150; echo ""

echo "== 8d. valid inward =="
curl -s -b $AJ -X PATCH "$B/api/admin/returns?id=$RID" -H 'Content-Type: application/json' -d '{"action":"MARK_RESTOCKED","inwardCourier":"Delhivery","inwardTracking":"DL-RTN-990312","inwardNote":"Sealed box, accessories present"}' | head -c 120; echo ""

echo "== 8e. refund =="
curl -s -b $AJ -X PATCH "$B/api/admin/returns?id=$RID" -H 'Content-Type: application/json' -d '{"action":"MARK_REFUNDED"}' | head -c 120; echo ""

echo "== 9. persisted evidence =="
curl -s -b $AJ "$B/api/admin/returns?status=REFUNDED" | python3 -c "
import json,sys
d=json.load(sys.stdin)
rows=[x for x in d['data']['returns'] if x['id']=='$RID']
print(json.dumps({k:rows[0][k] for k in ('status','inwardCourier','inwardTracking','inwardNote')} if rows else {'miss':True}, indent=1))"
echo "DONE"
