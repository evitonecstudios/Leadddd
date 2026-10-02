# LeadForge Discovery Pipeline Overhaul (Revised)

This plan outlines the industrial-grade overhaul of the LeadForge discovery engine. It transitions the system from a single-query search tool to a multi-phase, high-fidelity pipeline: Discovery → Normalization → Deduplication → Website Discovery → Identity Validation → Enrichment → Audit.

## User Review & Critical Decisions

> [!IMPORTANT]
> The system is designed as a **$0 MVP**. It will function at full capacity using **OSM + Internal Crawler** even if external providers are disabled.

*   **Verified Search Providers**:
    *   **OSM (Primary)**: Business discovery via Overpass API with grid-partitioning.
    *   **Google Search (Optional Adapter)**: 100/day free. Requires API key. (Unverified/Optional).
    *   **Firecrawl (Optional Adapter)**: 1,000/mo free. Requires API key. (Unverified/Optional).
*   **Deterministic Validation**: Website verification will be based on hard evidence (Name/Address/Phone matching) rather than LLM guesswork.
*   **Resumable Pipelines**: Jobs will persist phase and cell state, allowing recovery from network failures or rate limits without losing progress.

## 1. Overview & Core Concept

*   **What It Does**: Systematically crawls geographic grids to find every real business in a category, then follows a "breadth-first discovery, depth-first enrichment" strategy to establish official websites and extract verified contact info.
*   **Target Audience**: B2B sales professionals requiring large, accurate datasets (100–1000 leads) without "AI hallucination" or fake data.
*   **Key Value**: Every data point is "Evidence-Locked" to a specific source URL and timestamp.

## 2. User Experience & Visual Design

*   **Key User Flows**:
    1.  **Grid Discovery**: User starts a campaign. The UI shows "Partitioning Geneva into 42 cells...".
    2.  **Live Monitoring**: Dashboard provides a "Telemetry" view with real counters:
        *   Discovered / Unique / Website Candidates / Verified / Phones / Emails.
    3.  **Discovery Board**: Prospect list with "Source Transparency" columns showing where each field came from.
*   **Visual Identity**:
    *   Industrial Dashboard: Monospace counters, tabular numerals, and subtle status indicators.
    *   Zero-Pill Metadata: Statuses and sources rendered as clean text with typographic separators.

## 3. Key Product Decisions & Trade-Offs

*   **Decision 1: OSM Grid Partitioning**
    *   *Approach*: Mathematical BBOX subdivision into NxN cells.
    *   *Why*: Ensures full coverage of large cities while respecting Overpass result limits.
*   **Decision 2: Internal Enrichment Crawler**
    *   *Approach*: Controlled crawl (Max 8 pages: Home, Contact, About, Legal).
    *   *Why*: Maximizes contact find-rate at $0 cost without using unofficial scrapers.
*   **Decision 3: Identity-First Validation**
    *   *Approach*: Score candidate URLs by string similarity (Name) and cross-reference (Phone/Address).
    *   *Why*: Prevents assigning a competitor's or aggregator's website to a lead.

## 4. Technical Architecture & Data Strategy

```unicode
┌──────────────────────────────────────────────────────────────┐
│                    LeadForge Discovery Engine                │
├──────────────────────────────────────────────────────────────┤
│ 1. DISCOVERY PHASE (OSM Provider)                            │
│    - BBOX Subdivision -> Cells -> Overpass Queries           │
├──────────────────────────────────────────────────────────────┤
│ 2. RECONCILIATION PHASE                                      │
│    - Global Deduplication (Normalized Domain + Phone)        │
├──────────────────────────────────────────────────────────────┤
│ 3. ENRICHMENT PHASE (Search Provider + Crawler)              │
│    - Website Search -> URL Scoring -> Identity Verification  │
│    - Bot Crawl (Cheerio) -> Phone/Email/WhatsApp Extraction  │
├──────────────────────────────────────────────────────────────┤
│ 4. EVIDENCE & PERSISTENCE                                    │
│    - Write to 'field_evidence' (Source, URL, Method, Conf)   │
└──────────────────────────────────────────────────────────────┘
```

### New Domain Logic
*   **`GridPartitionService`**: Calculates geographic cells for any city/country.
*   **`SearchProvider` Abstraction**: Interface for `search(companyName, city)`.
*   **`IdentityService`**: Scores URL relevance using Levenshtein distance and pattern matching.
*   **`EnrichmentBot`**: Axios/Cheerio service for scanning domains for public contacts.

### Resumable Job State
*   `currentPhase`: DISCOVERY | ENRICHMENT | AUDIT
*   `currentCell`: Cell index currently being processed.
*   `completedCells`: Array of finished cell IDs.

## 5. Execution Strategy

1.  **Step 1: Grid & OSM**: Implement partitioning and multi-cell discovery in `OSMSource`.
2.  **Step 2: Abstraction**: Create `SearchProvider` interface and stubs for Google/Firecrawl.
3.  **Step 3: Internal Crawler**: Build the `EnrichmentBot` for $0 website contact extraction.
4.  **Step 4: Validation Engine**: Implement deterministic identity scoring for websites.
5.  **Step 5: Resumable Jobs**: Overhaul `JobService` to persist detailed phase/cell state.
6.  **Step 6: UI Telemetry**: Update dashboard to show real-time, evidence-backed progress.
7.  **Step 7: Quality Filters**: Add sidebar filters for "Sales Ready" and "Evidence Strength".
