#!/usr/bin/env bash
# Responsive sweep: horizontal-overflow detector across routes at 3 widths.
# Usage: bash scripts/responsive-sweep.sh
set -u
ROUTES=(
  "/" "/about" "/blog" "/blog/hd-analog-vs-ip-cameras" "/brands" "/brands/cp-plus"
  "/cart" "/compare" "/contact" "/faq" "/kit-builder" "/privacy-policy"
  "/return-policy" "/shipping-policy" "/terms" "/track" "/search"
  "/products" "/products?category=cctv-surveillance" "/products?sort=price-asc&q=camera"
  "/products/cp-plus-ir-bullet-camera" "/account/login" "/order-success" "/showcase" "/index-help.html"
)
VIEWPORTS=("320 690" "375 812" "768 1024" "1280 800")
for vp in "${VIEWPORTS[@]}"; do
  w="${vp%% *}"; h="${vp##* }"
  agent-browser set viewport "$w" "$h" >/dev/null 2>&1
  echo "=== viewport ${w}x${h} ==="
  for r in "${ROUTES[@]}"; do
    agent-browser open "http://localhost:3000${r}" >/dev/null 2>&1
    sleep 1.1
    out=$(agent-browser eval "(() => { const d = document.documentElement; const over = d.scrollWidth - d.clientWidth; if (over <= 1) return 'ok'; let worst = null, maxW = 0; for (const el of document.querySelectorAll('body *')) { const sw = el.scrollWidth; if (sw > maxW && sw > d.clientWidth) { maxW = sw; worst = el.tagName + '.' + String(el.className).split(' ').slice(0,4).join('.'); } } return 'OVERFLOW+' + over + ' worst:' + worst; })()" 2>/dev/null | tail -1)
    echo "${r} → ${out}"
  done
done
