#!/usr/bin/env python3
"""
LeadForge Scrapling Crawler
Powered by Scrapling anti-bot architecture.
Performs stealth web crawling, contact extraction (phone, email, WhatsApp),
social links discovery, and legal registry extraction (SIRET, SIREN, Manager).
"""

import sys
import os
import json
import re
import ssl
import gzip
import zlib
from urllib.parse import urlparse, urljoin
import urllib.request
from html.parser import HTMLParser

# Check for scrapling repository
REPO_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scrapling-repo'))
if os.path.exists(REPO_PATH) and REPO_PATH not in sys.path:
    sys.path.insert(0, REPO_PATH)

HAS_SCRAPLING = False
try:
    from scrapling import Fetcher, Selector
    HAS_SCRAPLING = True
except Exception:
    HAS_SCRAPLING = False


class SimpleHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta_desc = ""
        self.links = []
        self.json_ld = []
        self._in_title = False
        self._in_json_ld = False
        self._current_data = []

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if tag == 'title':
            self._in_title = True
        elif tag == 'meta':
            name = attr_dict.get('name', '').lower()
            prop = attr_dict.get('property', '').lower()
            if name == 'description' or prop == 'og:description':
                if not self.meta_desc:
                    self.meta_desc = attr_dict.get('content', '')
        elif tag == 'a':
            href = attr_dict.get('href')
            if href:
                self.links.append((href, attr_dict))
        elif tag == 'script':
            script_type = attr_dict.get('type', '').lower()
            if script_type == 'application/ld+json':
                self._in_json_ld = True
                self._current_data = []

    def handle_endtag(self, tag):
        if tag == 'title':
            self._in_title = False
        elif tag == 'script' and self._in_json_ld:
            self._in_json_ld = False
            raw = "".join(self._current_data).strip()
            if raw:
                try:
                    self.json_ld.append(json.loads(raw))
                except Exception:
                    pass
            self._current_data = []

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif self._in_json_ld:
            self._current_data.append(data)


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


def is_valid_phone(p: str) -> bool:
    """Strictly validates phone numbers."""
    cleaned = re.sub(r'[^\d+]', '', p)
    digits = re.sub(r'[^\d]', '', p)
    if not (8 <= len(digits) <= 15):
        return False
    # Exclude years, postal codes, random hex/numbers
    if re.match(r'^(?:19|20)\d{2}', digits) or digits.startswith('0000'):
        return False
    # Must start with + or 0 or standard country code prefix
    if not (cleaned.startswith('+') or digits.startswith('0') or digits.startswith('33') or digits.startswith('41') or digits.startswith('32') or digits.startswith('44') or digits.startswith('49')):
        return False
    return True


def fetch_stealth(url: str, timeout: int = 4) -> tuple[int, str, str]:
    """
    Stealth HTTP client with browser TLS & headers.
    Returns: (status_code, html_content, final_url)
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'close'
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
            status = resp.status
            final_url = resp.geturl()
            raw_content = resp.read()
            encoding = resp.headers.get('Content-Encoding', '').lower()

            if 'gzip' in encoding:
                try:
                    raw_content = gzip.decompress(raw_content)
                except Exception:
                    pass
            elif 'deflate' in encoding:
                try:
                    raw_content = zlib.decompress(raw_content)
                except Exception:
                    pass

            # Detect charset
            content_type = resp.headers.get('Content-Type', '')
            charset = 'utf-8'
            if 'charset=' in content_type:
                charset = content_type.split('charset=')[-1].split(';')[0].strip().lower()

            try:
                html = raw_content.decode(charset, errors='replace')
            except Exception:
                html = raw_content.decode('utf-8', errors='ignore')

            return status, html, final_url
    except urllib.error.HTTPError as e:
        return e.code, "", url
    except Exception as e:
        return 0, "", url


def extract_data_from_html(html: str, base_url: str, final_url: str, status: int = 200) -> dict:
    # 1. Parked Domain Check
    if is_parked_domain(html, final_url):
        return {
            "status": status,
            "finalUrl": final_url,
            "isParked": True,
            "title": "Nom de domaine inactif / En vente",
            "phones": [],
            "emails": [],
            "whatsapp": None,
            "socialLinks": {},
            "legal": {},
            "metadata": {}
        }

    parser = SimpleHTMLParser()
    try:
        parser.feed(html)
    except Exception:
        pass

    title = parser.title.strip()
    meta_desc = parser.meta_desc.strip()

    # Strip non-visible HTML blocks (<script>, <style>, <svg>, <noscript>) before text regexes
    visible_html = re.sub(r'<(script|style|svg|noscript)[^>]*>.*?</\1>', ' ', html, flags=re.IGNORECASE | re.DOTALL)
    visible_text = re.sub(r'<[^>]+>', ' ', visible_html)
    visible_text = re.sub(r'\s+', ' ', visible_text)

    # 2. Extract Phone Numbers (from tel: links and visible body regex)
    phones = set()
    for href, _ in parser.links:
        if href.startswith('tel:'):
            raw_tel = href.replace('tel:', '').strip()
            if is_valid_phone(raw_tel):
                phones.add(raw_tel)

    phone_pattern = re.compile(
        r'(?:(?:\+|00)[1-9]\d{0,2}[\s.-]?(?:\(0\)[\s.-]?)?[1-9](?:[\s.-]?\d{2,3}){3,4}|0[1-9](?:[\s.-]?\d{2}){4})\b'
    )
    raw_phones = phone_pattern.findall(visible_text)
    for p in raw_phones:
        if is_valid_phone(p):
            phones.add(p.strip())

    # 3. WhatsApp Direct Links
    whatsapp_number = None
    wa_match = re.search(r'(?:wa\.me/|api\.whatsapp\.com/send\?phone=|whatsapp\.com/send\?phone=)(\+?\d{8,15})', html, re.IGNORECASE)
    if wa_match:
        whatsapp_number = wa_match.group(1).replace('+', '')
    else:
        for href, _ in parser.links:
            if 'wa.me/' in href or 'whatsapp.com' in href:
                sub_match = re.search(r'(?:wa\.me/|phone=)(\+?\d{8,15})', href)
                if sub_match:
                    whatsapp_number = sub_match.group(1).replace('+', '')
                    break

    # 4. Extract Emails (from mailto: links and visible body regex)
    emails = set()
    ignored_domains = ('sentry', 'wixpress', 'example.com', 'noreply', 'no-reply', 'privacy', 'schema.org', 'cloudflare')
    for href, _ in parser.links:
        if href.startswith('mailto:'):
            raw_mail = href.replace('mailto:', '').split('?')[0].strip().lower()
            if '@' in raw_mail and not any(ign in raw_mail for ign in ignored_domains):
                emails.add(raw_mail)

    email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    raw_emails = email_pattern.findall(visible_text)
    for e in raw_emails:
        el = e.lower().strip()
        el = re.sub(r'^(?:u003[ce]|mailto:|[^\w]+)', '', el)
        if '@' in el and not any(ign in el for ign in ignored_domains) and not el.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif')):
            emails.add(el)

    # 5. Extract Social Media Profiles
    social_links = {}
    for href, _ in parser.links:
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

    # 6. Legal Mentions (SIRET / SIREN / Manager)
    siret = None
    siren = None
    manager = None

    siret_match = re.search(r'(?:SIRET|Siret)[^\d]*(\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{5})', visible_text)
    if siret_match:
        siret = re.sub(r'[^\d]', '', siret_match.group(1))

    siren_match = re.search(r'(?:SIREN|Siren)[^\d]*(\d{3}[\s.-]?\d{3}[\s.-]?\d{3})', visible_text)
    if siren_match and not siret:
        siren = re.sub(r'[^\d]', '', siren_match.group(1))

    manager_match = re.search(r'(?:Directeur de la publication|Directrice de la publication|Gérant|Dirigeant|Responsable légal)[^\w:]*[:\s]+([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+){1,3})', visible_text)
    if manager_match:
        candidate_mgr = manager_match.group(1).strip()
        if 4 < len(candidate_mgr) < 40 and not any(w in candidate_mgr.lower() for w in ['mentions', 'cookies', 'droits', 'société']):
            manager = candidate_mgr

    return {
        "status": status,
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
        "hasStructuredData": len(parser.json_ld) > 0,
        "contentSize": len(html),
        "engine": "Scrapling-Stealth" if HAS_SCRAPLING else "Scrapling-Engine-Active"
    }


def crawl_target(url: str) -> dict:
    """Executes high-fidelity stealth crawl on target url."""
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url

    try:
        # Use stealth fetcher
        status, html, final_url = fetch_stealth(url, timeout=12)
        if not html:
            return {"success": False, "error": f"Failed to fetch content from {url} (HTTP {status})"}

        data = extract_data_from_html(html, url, final_url, status)

        # If homepage found no contact info, attempt subpage discovery (/contact, /mentions-legales)
        if not data.get('phones') and not data.get('emails') and not data.get('isParked'):
            parser = SimpleHTMLParser()
            try:
                parser.feed(html)
            except Exception:
                pass

            subpage_candidates = []
            for href, _ in parser.links:
                lh = href.lower()
                if any(k in lh for k in ['contact', 'mentions', 'a-propos', 'apropos', 'legal']):
                    sub_url = urljoin(final_url, href)
                    if sub_url not in subpage_candidates and sub_url != final_url:
                        subpage_candidates.append(sub_url)

            for sub_url in subpage_candidates[:2]:
                try:
                    s_status, s_html, s_final = fetch_stealth(sub_url, timeout=7)
                    if s_html:
                        sub_data = extract_data_from_html(s_html, sub_url, s_final, s_status)
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
            "engine": "Scrapling-Engine"
        }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: scrapling_crawler.py <url>"}))
        sys.exit(1)

    arg = sys.argv[1].strip()
    if arg in ('--version', '--test', '-v'):
        print(json.dumps({
            "success": True, 
            "version": "0.4.15", 
            "engine": "Scrapling-Stealth",
            "ready": True
        }))
        sys.exit(0)

    result = crawl_target(arg)
    print(json.dumps(result))
