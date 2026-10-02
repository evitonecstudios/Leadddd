import { LeadSource } from './types.ts';
import { CSVSource } from './csvSource.ts';
import { OSMSource } from './osmSource.ts';

export class SourceRegistry {
  private static sources: Record<string, LeadSource> = {
    csv: new CSVSource(),
    osm: new OSMSource(),
  };

  static getSource(id: string): LeadSource {
    const source = this.sources[id];
    if (!source) throw new Error(`Source ${id} not found`);
    return source;
  }

  static getAllSources() {
    return Object.entries(this.sources).map(([id, source]) => ({
      id,
      name: source.getSourceName(),
      capabilities: source.getCapabilities(),
    }));
  }
}
