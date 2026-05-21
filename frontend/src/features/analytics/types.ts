export interface BookMetrics {
  book_id: number;
  play_count: number;
  complete_count: number;
  favorite_count: number;
  share_count: number;
  completion_rate: number;
}

export interface OperationDashboard {
  play_count: number;
  complete_count: number;
  favorite_count: number;
  share_count: number;
  creation_count: number;
  subscription_count: number;
  report_count: number;
  moderation_pending_count: number;
  top_books: BookMetrics[];
}
