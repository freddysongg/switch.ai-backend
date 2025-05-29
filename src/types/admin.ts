import { AnalyticsEvent as DbAnalyticsEvent, RateLimit } from './db.js';

export interface RateLimitListFilters {
  userId?: string;
  endpoint?: string;
  page?: number;
  limit?: number;
  sortBy?: keyof RateLimit;
  sortOrder?: 'asc' | 'desc';
}

export interface AnalyticsEventListFilters {
  userId?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: keyof DbAnalyticsEvent | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
