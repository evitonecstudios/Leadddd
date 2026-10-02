import { LeadSource, RawLead } from './types.ts';

export interface CSVMappedData {
  rows: any[];
  mapping: Record<string, string>;
}

export class CSVSource implements LeadSource {
  async search(criteria: CSVMappedData): Promise<RawLead[]> {
    const { rows, mapping } = criteria;
    
    return rows.map((row, index) => {
      const rawLead: RawLead = {
        source: 'csv_import',
        sourceId: `csv-${Date.now()}-${index}`,
        companyName: row[mapping.companyName] || 'UNKNOWN',
        category: row[mapping.category],
        country: row[mapping.country],
        region: row[mapping.region],
        city: row[mapping.city],
        address: row[mapping.address],
        phone: row[mapping.phone],
        email: row[mapping.email],
        website: row[mapping.website],
        latitude: row[mapping.latitude] ? parseFloat(row[mapping.latitude]) : undefined,
        longitude: row[mapping.longitude] ? parseFloat(row[mapping.longitude]) : undefined,
        rawData: row,
      };
      return rawLead;
    });
  }

  async validateConfiguration(): Promise<{ valid: boolean }> {
    return { valid: true };
  }

  getSourceName(): string {
    return 'CSV Import';
  }

  getCapabilities(): string[] {
    return ['company_name', 'phone', 'email', 'website', 'address', 'category', 'location'];
  }
}
