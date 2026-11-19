export type Platform = "telegram" | "instagram" | "youtube";

export type TimeRangeKind = "last_week" | "last_month" | "all" | "custom";

export interface TimeRange {
  kind: TimeRangeKind;
  start?: string;
  end?: string;
}

export interface CollectedPost {
  externalId: string;
  publishedAt: string;
  formatType: string;
  caption: string;
  url: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  forwards?: number | null;
  raw?: Record<string, unknown>;
}

export interface ConversationSlots {
  platform?: Platform;
  identifier?: string;
  timeRange?: TimeRange;
  brandName?: string;
  brandKeywords?: string[];
  scanChannels?: string[];
  exportFormat?: "xlsx" | "csv" | "pdf" | "txt";
  awaiting?: string;
}

export interface UserSession {
  slots: ConversationSlots;
  lastReport?: ReportPayload;
}

export interface ReportPayload {
  summaryText: string;
  summary: Record<string, unknown>;
  posts: CollectedPost[];
  sourceLabel: string;
}