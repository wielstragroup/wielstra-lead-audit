export interface Lead {
  id: string;
  name: string;
  type: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  lat?: number;
  lon?: number;
  tags: Record<string, string>;
}

export interface AuditCheck {
  id: string;
  label: string;
  passed: boolean;
  info?: string;
}

export interface AuditResult {
  leadId: string;
  url: string;
  finalUrl: string;
  loadTimeMs: number;
  checks: AuditCheck[];
  error?: string;
}

export interface SearchParams {
  center: string;
  radiusKm: number;
  category?: string;
}

export interface SearchResult {
  leads: Lead[];
  centerLat: number;
  centerLon: number;
  error?: string;
}
