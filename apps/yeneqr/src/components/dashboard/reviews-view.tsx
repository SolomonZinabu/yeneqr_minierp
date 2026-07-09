'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import {
  Star,
  MessageSquare,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Send,
  StarOff,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface ReviewCustomer {
  id: string;
  name: string | null;
  phone: string | null;
}

interface ReviewOrder {
  id: string;
  orderNumber: string | null;
}

interface ReviewData {
  id: string;
  orderId: string;
  customerId: string;
  restaurantId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  ownerReply: string | null;
  ownerReplyCreatedAt: string | null;
  customer: ReviewCustomer;
  order: ReviewOrder;
}

interface ReviewsSummary {
  averageRating: number;
  totalReviews: number;
}

interface ReviewsResponse {
  data: ReviewData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: ReviewsSummary;
}

interface ReplyState {
  [reviewId: string]: string;
}

// ============================================================
// Star Display Component
// ============================================================

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const iconSize = size === 'lg' ? 'h-6 w-6' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${iconSize} ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-muted text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

// ============================================================
// Rating Distribution Bar
// ============================================================

function RatingDistribution({ reviews, totalReviews }: { reviews: ReviewData[]; totalReviews: number }) {
  // Count reviews per star rating
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return { star, count, percentage };
  });

  return (
    <div className="space-y-1.5">
      {distribution.map(({ star, count, percentage }) => (
        <div key={star} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-3 text-right">{star}</span>
          <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function ReviewsView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  // Data state
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewData[]>([]);
  const [summary, setSummary] = useState<ReviewsSummary>({ averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const fetchReviewsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchAllReviewsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[ReviewsView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setReviews([]);
    setAllReviews([]);
    fetchReviewsRef.current?.();
    fetchAllReviewsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Filter & sort state
  const [filterRating, setFilterRating] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');

  // Reply dialog state
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReviewData | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replies, setReplies] = useState<ReplyState>({});

  // ============================================================
  // Fetch reviews
  // ============================================================

  const fetchReviews = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);

      // Build params for filtered/paginated request
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      };

      if (branchId) params.branchId = branchId;
      if (filterRating !== 'all') {
        params.minRating = filterRating;
        params.maxRating = filterRating;
      }

      const res = await api.get<ReviewsResponse>(
        `/api/restaurants/${restaurantId}/reviews`,
        params,
      );

      setReviews(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      setSummary(res.summary || { averageRating: 0, totalReviews: 0 });
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId, pagination.page, pagination.limit, filterRating]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchReviewsRef.current = fetchReviews; }, [fetchReviews]);

  // Fetch all reviews for distribution (no pagination, no rating filter)
  const fetchAllReviews = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { limit: '1000' };
      if (branchId) params.branchId = branchId;
      const res = await api.get<ReviewsResponse>(
        `/api/restaurants/${restaurantId}/reviews`,
        params,
      );
      setAllReviews(res.data || []);
    } catch {
      // Silently handle
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchAllReviewsRef.current = fetchAllReviews; }, [fetchAllReviews]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, selectedBranchId, branchChangeVersion]);

  useEffect(() => {
    fetchAllReviews();
  }, [fetchAllReviews, selectedBranchId, branchChangeVersion]);

  // Reset loading state when branch changes
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setLoading(true);
    }
  }, [selectedBranchId]);

  // ============================================================
  // Sort reviews client-side
  // ============================================================

  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'rating_desc':
        return b.rating - a.rating;
      case 'rating_asc':
        return a.rating - b.rating;
      case 'date_desc':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // ============================================================
  // Handlers
  // ============================================================

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleOpenReply = (review: ReviewData) => {
    setReplyingTo(review);
    setReplyText(replies[review.id] || '');
    setReplyDialogOpen(true);
  };

  const handleSubmitReply = async () => {
    if (!replyingTo) return;
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    try {
      setReplySubmitting(true);
      // Phase 2.22: Save reply via the reviews API
      await api.patch(`/api/restaurants/${restaurantId}/reviews/${replyingTo.id}`, { ownerReply: replyText.trim() });
      setReplies((prev) => ({ ...prev, [replyingTo.id]: replyText.trim() }));
      toast.success('Reply saved successfully');
      setReplyDialogOpen(false);
      setReplyingTo(null);
      setReplyText('');
    } catch {
      toast.error('Failed to save reply');
    } finally {
      setReplySubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ============================================================
  // Loading State
  // ============================================================

  if (loading && reviews.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading reviews...</span>
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* ── Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Average Rating Card */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 shrink-0">
              <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '—'}
                </span>
                <span className="text-xs text-muted-foreground">/ 5</span>
              </div>
              <StarRating rating={Math.round(summary.averageRating)} size="sm" />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Based on {summary.totalReviews} review{summary.totalReviews !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Reviews Card */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 shrink-0">
              <MessageSquare className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <span className="text-2xl font-bold">{summary.totalReviews}</span>
              <p className="text-[11px] text-muted-foreground">
                Total review{summary.totalReviews !== 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {reviews.filter((r) => r.comment).length} with comments
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution Card */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-2">Rating Distribution</p>
            <RatingDistribution reviews={allReviews} totalReviews={summary.totalReviews} />
          </CardContent>
        </Card>
      </div>

      {/* ── Filters & Sort ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Rating Filter */}
          <Select value={filterRating} onValueChange={(v) => { setFilterRating(v); setPagination((prev) => ({ ...prev, page: 1 })); }}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="All Ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 5 Stars
                </div>
              </SelectItem>
              <SelectItem value="4">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4 Stars
                </div>
              </SelectItem>
              <SelectItem value="3">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 3 Stars
                </div>
              </SelectItem>
              <SelectItem value="2">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 2 Stars
                </div>
              </SelectItem>
              <SelectItem value="1">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 1 Star
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="rating_desc">Highest Rating</SelectItem>
              <SelectItem value="rating_asc">Lowest Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filterRating !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setFilterRating('all'); setPagination((prev) => ({ ...prev, page: 1 })); }}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* ── Reviews List ─────────────────────────────────────── */}
      {sortedReviews.length > 0 ? (
        <div className="space-y-3">
          {sortedReviews.map((review) => {
            const hasReply = !!replies[review.id] || !!review.ownerReply;
            const replyText = replies[review.id] || review.ownerReply;
            const customerName = review.customer?.name || review.customer?.phone || 'Anonymous';
            const orderNumber = review.order?.orderNumber || review.orderId.slice(-8);

            return (
              <Card key={review.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0 text-sm font-semibold text-primary">
                      {customerName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header: Name + Rating + Date */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="text-sm font-medium">{customerName}</span>
                        <StarRating rating={review.rating} size="sm" />
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(review.createdAt)} · {formatTime(review.createdAt)}
                        </span>
                      </div>

                      {/* Order Number */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Order #{orderNumber}
                        </Badge>
                        <Badge
                          className={`text-[10px] border-0 px-1.5 py-0 ${
                            review.rating >= 4
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : review.rating === 3
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {review.rating}/5
                        </Badge>
                      </div>

                      {/* Comment */}
                      {review.comment && (
                        <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
                          &ldquo;{review.comment}&rdquo;
                        </p>
                      )}

                      {/* Reply indicator */}
                      {hasReply && (
                        <div className="mt-2 rounded-lg bg-muted/50 border border-muted p-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground mb-1">Your Reply</p>
                          <p className="text-sm text-foreground/80">{replyText}</p>
                        </div>
                      )}
                    </div>

                    {/* Reply Button */}
                    <Button
                      variant={hasReply ? 'outline' : 'default'}
                      size="sm"
                      className="h-7 text-xs shrink-0 gap-1.5"
                      onClick={() => handleOpenReply(review)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {hasReply ? 'Edit Reply' : 'Reply'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* ── Pagination ─────────────────────────────────────── */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} reviews
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show first, last, and pages around current page
                    return p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prevVal = arr[idx - 1];
                    const showEllipsis = prevVal !== undefined && p - prevVal > 1;
                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                        <Button
                          variant={p === pagination.page ? 'default' : 'outline'}
                          size="icon"
                          className="h-8 w-8 text-xs"
                          onClick={() => handlePageChange(p)}
                        >
                          {p}
                        </Button>
                      </span>
                    );
                  })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : summary.totalReviews === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StarOff className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No reviews yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reviews from your customers will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No reviews match your filter</p>
            <Button
              variant="outline"
              className="mt-4"
              size="sm"
              onClick={() => { setFilterRating('all'); setPagination((prev) => ({ ...prev, page: 1 })); }}
            >
              Clear Filter
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Reply Dialog ─────────────────────────────────────── */}
      <Dialog open={replyDialogOpen} onOpenChange={(open) => { setReplyDialogOpen(open); if (!open) { setReplyingTo(null); setReplyText(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Reply to Review
            </DialogTitle>
          </DialogHeader>

          {replyingTo && (
            <div className="space-y-3">
              {/* Review preview */}
              <div className="rounded-lg bg-muted/50 border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {replyingTo.customer?.name || replyingTo.customer?.phone || 'Anonymous'}
                  </span>
                  <StarRating rating={replyingTo.rating} size="sm" />
                </div>
                {replyingTo.comment && (
                  <p className="text-sm text-muted-foreground">&ldquo;{replyingTo.comment}&rdquo;</p>
                )}
              </div>

              {/* Reply textarea */}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="reply-textarea">
                  Your Reply
                </label>
                <Textarea
                  id="reply-textarea"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your reply to this review..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  Your reply will be saved as a note for your reference.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplyDialogOpen(false); setReplyingTo(null); setReplyText(''); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReply} disabled={replySubmitting}>
              {replySubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Save Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
