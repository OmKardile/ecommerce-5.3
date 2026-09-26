#!/bin/bash
B=http://localhost:3000; CJ=/tmp/dbg.jar; rm -f $CJ
curl -s -X POST $B/api/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"919888001122"}' >/dev/null; sleep 2
OTP=$(grep -hE 'To: \+919888001122  +OTP: [0-9]{6}' /home/z/my-project/dev.log | tail -1 | grep -oE 'OTP: [0-9]{6}' | grep -oE '[0-9]{6}')
echo "otp=$OTP"
curl -s -c $CJ -X POST $B/api/auth/otp/verify -H 'Content-Type: application/json' -d "{\"phone\":\"919888001122\",\"code\":\"$OTP\"}" >/dev/null
echo "jar:"; cat $CJ | grep pn_ | awk '{print $6}'
echo "cart: $(curl -s -b $CJ $B/api/cart | head -c 60)"
echo "order: $(curl -s -b $CJ -X POST $B/api/orders -H 'Content-Type: application/json' -d '{"paymentMethod":"COD","idempotencyKey":"dbg-99881122","delivery":{"recipientName":"RMA Tester","phone":"919888001122","addressLine1":"12 Ring Road, Adajan","city":"Surat","state":"Gujarat","pincode":"395009"}}' | head -c 300)"
