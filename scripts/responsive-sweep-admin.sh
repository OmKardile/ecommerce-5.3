#!/usr/bin/env bash
# Admin responsive sweep (requires admin session in the agent-browser).
set -u
ROUTES=(
  "/admin" "/admin/orders" "/admin/returns" "/admin/products" "/admin/categories"
  "/admin/brands" "/admin/inventory" "/admin/customers" "/admin/inquiries"
  "/admin/reviews" "/admin/reports" "/admin/banners" "/admin/blog" "/admin/coupons" "/admin/settings"
)
VIEWPORTS=("375 812" "768 1024")
for vp in "${VIEWPORTS[@]}"; do
  w="${vp%% *}"; h="${vp##* }"
  agent-browser set viewport "$w" "$h" >/dev/null 2>&1
  echo "=== viewport ${w}x${h} ==="
  for r in "${ROUTES[@]}"; do
    agent-browser open "http://localhost:3000${r}" >/dev/null 2>&1
    sleep 1.2
    out=$(agent-browser eval "(() => { const d = document.documentElement; const over = d.scrollWidth - d.clientWidth; if (over <= 1) return 'ok'; let worst = null, maxW = 0; for (const el of document.querySelectorAll('body *')) { const sw = el.scrollWidth; if (sw > maxW && sw > d.clientWidth) { maxW = sw; worst = el.tagName + '.' + String(el.className).split(' ').slice(0,3).join('.'); } } return 'OVERFLOW+' + over + 'px worst:' + worst; })()" 2>/dev/null | tail -1)
    echo "${r} → ${out}"
  done
done
