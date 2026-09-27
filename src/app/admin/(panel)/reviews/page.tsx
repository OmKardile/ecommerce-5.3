// Admin > Reviews — customer review moderation queue.
// Approving a review makes it live on the PDP; deleting removes it outright.

import { ReviewsConsole } from '@/components/admin/reviews-console';

export const metadata = { title: 'Reviews · Patel Networks Admin' };

export default function AdminReviewsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-[28px] leading-tight">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Customer reviews wait here until you approve them — nothing reaches a product page unmoderated.
        </p>
      </header>
      <ReviewsConsole />
    </div>
  );
}
