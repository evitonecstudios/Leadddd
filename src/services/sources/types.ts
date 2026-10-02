export interface RawLead {
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  companyName: string;
  category?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  rawData: any;
}

export interface LeadSource {
  search(criteria: any): Promise<RawLead[]>;
  validateConfiguration(): Promise<{ valid: boolean; error?: string }>;
  getSourceName(): string;
  getCapabilities(): string[];
}
