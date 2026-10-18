#!/usr/bin/env python3
"""
LeadForge Scrapling Crawler
Powered by D4Vinci/Scrapling repository.
Performs stealth anti-bot web scraping, DOM extraction, and structured business data extraction.
"""

import sys
import os
import json
import re
from urllib.parse import urlparse, urljoin

# Add the local scrapling-repo directly to sys.path so it always uses the repo
REPO_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scrapling-repo'))
if os.path.exists(REPO_PATH) and REPO_PATH not in sys.path:
    sys.path.insert(0, REPO_PATH)

try:
    from scrapling import Fetcher, Selector
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Failed to import Scrapling: {str(e)}"
    }))
    sys.exit(1)


def is_parked_domain(html: str, url: str) -> bool:
    """Detects parked, expired, or for-sale domains (GoDaddy, Sedo, Dan, etc.)."""
    lower = html.lower()
    signals = [
        "domain for sale", "buy this domain", "nom de domaine à vendre", "ce domaine est en vente",
        "domain is parked", "this domain is parked", "godaddy", "sedo", "dan.com", "domainmarket",
        "afternic", "hugedomains", "parked on", "domain parking", "renew your domain",
        "the sponsored listings displayed above are served automatically", "domaine réservé",
        "under construction", "site en construction"
    ]
    matches = sum(1 for s in signals if s in lower)
    return matches >= 2 or ("buy this domain" in lower or "ce domaine est en vente" in lower)


def extract_contacts_and_metadata(page, base_url: str):
    html = page.body.decode('utf-8', errors='ignore') if isinstance(page.body, bytes) else str(page.body or '')
    final_url = str(page.url or base_url)
    
    # 1. Parked Domain Check
    if is_parked_domain(html, final_url):
        return {
            "status": page.status,
            "finalUrl": final_url,
            "isParked": True,
            "title": "Nom de domaine inactif / En vente",
            "phones": [],
            "emails": [],
            "socialLinks": {},
            "evidence": [],
            "metadata": {}
        }

    # 2. Extract Title and Meta Description
    title_el = page.css('title')
    title = title_el.get().strip() if title_el else ""
    title = re.sub(r'<[^>]+>', '', title).strip()

    meta_desc_el = page.css('meta[name="description"]::attr(content)')
    meta_desc = meta_desc_el.get() if meta_desc_el else ""

    # 3. Phone Numbers
    phone_pattern = re.compile(
        r'(?:(?:\+|00)[1-9]\d{0,2}[ -]?)?(?:(?:\(0\)[ -]?)?0?[1-9](?:[ -]?\d{2}){4}|(?:\+33|0)[1-9](?:[ -]?\d{2}){4}|\+41[ -]?[1-9]\d(?:[ -]?\d{3}){2}|\+32[ -]?[1-9](?:[ -]?\d{2}){3,4})'
    )
    raw_phones = phone_pattern.findall(html)
    phones = set()
    for p in raw_phones:
        cleaned = re.sub(r'[^\d+]', '', p)
        if len(cleaned) >= 8 and len(cleaned) <= 15:
            # Exclude obvious non-phone number patterns (dates, timestamps, zipcodes)
            if not re.match(r'^(?:19|20)\d{2}', cleaned) and not cleaned.startswith('0000'):
                phones.add(p.strip())

    # 4. WhatsApp Links
    whatsapp_number = None
    wa_links = page.css('a[href*="wa.me"], a[href*="whatsapp.com"]')
    for wa in wa_links:
        href = wa.attrib.get('href', '')
        wa_match = re.search(r'(?:wa\.me/|phone=)(\+?\d{8,15})', href)
        if wa_match:
            whatsapp_number = wa_match.group(1).replace('+', '')
            break

    # 5. Emails
    email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    raw_emails = email_pattern.findall(html)
    emails = set()
    ignored_domains = ('sentry', 'wixpress', 'example.com', 'noreply', 'no-reply', 'privacy', 'schema.org')
    for e in raw_emails:
        el = e.lower().strip()
        el = re.sub(r'^(?:u003[ce]|mailto:|[^\w]+)', '', el)
        if '@' in el and not any(ign in el for ign in ignored_domains) and not el.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif')):
            emails.add(el)

    # 6. Social Media Profiles
    social_links = {}
    links = page.css('a::attr(href)')
    for link in links:
        href = str(link.get() or '').strip()
        if not href or href.startswith('#') or href.startswith('javascript:'):
            continue
        
        full_href = urljoin(final_url, href)
        lower_href = full_href.lower()

        if 'facebook.com/' in lower_href and not any(x in lower_href for x in ['sharer', 'intent', 'dialog', 'plugins']):
            if 'facebook' not in social_links:
                social_links['facebook'] = full_href
        elif 'instagram.com/' in lower_href and not any(x in lower_href for x in ['explore', 'p/', 'stories']):
            if 'instagram' not in social_links:
                social_links['instagram'] = full_href
        elif 'linkedin.com/company/' in lower_href or 'linkedin.com/in/' in lower_href:
            if 'linkedin' not in social_links:
                social_links['linkedin'] = full_href
        elif ('twitter.com/' in lower_href or 'x.com/' in lower_href) and not any(x in lower_href for x in ['intent', 'share']):
            if 'twitter' not in social_links:
                social_links['twitter'] = full_href

    # 7. Legal Mentions (SIRET / SIREN / VAT / Manager)
    siret = None
    siren = None
    manager = None

    siret_match = re.search(r'(?:SIRET|Siret)[^\d]*(\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{5})', html)
    if siret_match:
        siret = re.sub(r'[^\d]', '', siret_match.group(1))

    siren_match = re.search(r'(?:SIREN|Siren)[^\d]*(\d{3}[\s.-]?\d{3}[\s.-]?\d{3})', html)
    if siren_match and not siret:
        siren = re.sub(r'[^\d]', '', siren_match.group(1))

    manager_match = re.search(r'(?:Directeur de la publication|Directrice de la publication|Gérant|Dirigeant|Responsable legal)[^\w:]*[:\s]+([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+){1,3})', html)
    if manager_match:
        candidate_mgr = manager_match.group(1).strip()
        if len(candidate_mgr) > 4 and len(candidate_mgr) < 40 and not any(w in candidate_mgr.lower() for w in ['mentions', 'cookies', 'droits', 'société']):
            manager = candidate_mgr

    # 8. Schema.org / JSON-LD Data
    json_ld_blocks = page.css('script[type="application/ld+json"]::text')
    structured_data = []
    for block in json_ld_blocks:
        try:
            content = block.get().strip()
            if content:
                structured_data.append(json.loads(content))
        except Exception:
            pass

    return {
        "status": page.status,
        "finalUrl": final_url,
        "isParked": False,
        "title": title,
        "metaDescription": meta_desc,
        "phones": list(phones)[:5],
        "whatsapp": whatsapp_number,
        "emails": list(emails)[:5],
        "socialLinks": social_links,
        "legal": {
            "siret": siret,
            "siren": siren,
            "manager": manager
        },
        "hasStructuredData": len(structured_data) > 0,
        "contentSize": len(html),
        "engine": "Scrapling-Stealth"
    }


def crawl_target(url: str):
    """Executes crawl with Scrapling Fetcher."""
    try:
        # Fetch homepage using Scrapling
        page = Fetcher.get(url, timeout=12, follow_redirects=True)
        data = extract_contacts_and_metadata(page, url)
        
        # If homepage found no contact info, attempt subpage discovery (contact / mentions legales)
        if not data.get('phones') and not data.get('emails') and not data.get('isParked'):
            contact_links = page.css('a[href*="contact"], a[href*="mentions"], a[href*="a-propos"]')
            for cl in contact_links[:2]:
                href = cl.attrib.get('href', '')
                sub_url = urljoin(data.get('finalUrl', url), href)
                try:
                    sub_page = Fetcher.get(sub_url, timeout=8, follow_redirects=True)
                    sub_data = extract_contacts_and_metadata(sub_page, sub_url)
                    if sub_data.get('phones'):
                        data['phones'] = list(set(data.get('phones', []) + sub_data['phones']))
                    if sub_data.get('emails'):
                        data['emails'] = list(set(data.get('emails', []) + sub_data['emails']))
                    if not data.get('whatsapp') and sub_data.get('whatsapp'):
                        data['whatsapp'] = sub_data['whatsapp']
                    if not data['legal'].get('siret') and sub_data['legal'].get('siret'):
                        data['legal']['siret'] = sub_data['legal']['siret']
                    if not data['legal'].get('manager') and sub_data['legal'].get('manager'):
                        data['legal']['manager'] = sub_data['legal']['manager']
                except Exception:
                    pass

        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "engine": "Scrapling"
        }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: scrapling_crawler.py <url>"}))
        sys.exit(1)

    target_url = sys.argv[1].strip()
    result = crawl_target(target_url)
    print(json.dumps(result))
