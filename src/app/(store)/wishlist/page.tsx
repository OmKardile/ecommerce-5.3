// Bare /wishlist is not a route (the wishlist lives at /account/wishlist,
// session-gated) — redirect muscle-memory URLs so nobody hits a 404.

import { redirect } from 'next/navigation';

export default function WishlistRedirect() {
  redirect('/account/wishlist');
}
