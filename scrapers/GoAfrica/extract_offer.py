"""
extract_offer_Go.py
Parser d'offres d'emploi pour GoAfricaOnline.
Utilise la logique de normalisation de extract_offer.py (Jobivoire) 
mais avec les sélecteurs CSS et la structure DOM de GoAfricaOnline.
"""
from __future__ import annotations
import re
from datetime import datetime, timedelta, timezone, time as dt_time
from typing import Any, Dict, List, Optional, Tuple, Union
import unicodedata
from loguru import logger

try:
    from selectolax.parser import HTMLParser
except ImportError:
    HTMLParser = None

try:
    from selectolax.lexbor import LexborHTMLParser
except ImportError:
    LexborHTMLParser = None

# ==============================================================================
# SÉLECTEURS GOAFRICAONLINE (Issus de script.py)
# ==============================================================================
MAIN_CONTAINER_SELECTORS = (
    'div[class*="gap-[24px]"][class*="ls:gap-[12px]"]',
    "main", "article", 'div[id*="job"]', 'div[class*="job"]',
)
JOB_CONTENT_SELECTORS = (
    "div.grow.overflow-hidden", 'div[class*="grow"]', "section",
)
COMPANY_CONTAINER_SELECTORS = (
    'div[class*="gap-[16px]"][class*="rounded-[8px]"]',
    'section[class*="company"]', 'div[class*="company"]',
    'div[class*="entreprise"]', "aside",
)
COMPANY_LINK_SELECTORS = (
    "a.text-gray-800.font-bold", 'a[class*="font-bold"]',
    'a[href*="entreprise"]', 'a[href*="company"]',
)
COMPANY_TYPE_SELECTORS = (
    "div.font-normal.italic.text-gray-800", 'div[class*="italic"]',
)
COMPANY_DESC_SELECTORS = (
    "div.font-normal.text-gray-650.line-clamp-10",
    'div[class*="line-clamp"]', "p",
)

# Sélecteurs pour les badges/icônes GoAfrica
ICON_SELECTORS = {
    "contract": ("i.tnp.tnp-file-signature", "i[class*='file-signature']", "i[class*='contract']"),
    "salary": ("i.tnp.tnp-user-salary", "i[class*='file-user-salary']", "i[class*='salary']"),
    "duration": ("i.tnp.tnp-calendar", "i[class*='calendar']"),
    "remote": ("i.tnp.tnp-house-laptop", "i[class*='house-laptop']", "i[class*='remote']"),
    "experience": ("i.tnp.tnp-briefcase-1", "i[class*='briefcase']", "i[class*='experience']"),
    "education": ("i.tnp.tnp-diploma-outlined", "i[class*='diploma']", "i[class*='graduation']"),
    "language": ("i.tnp.tnp-comment-dots", "i[class*='comment']", "i[class*='language']"),
    "location": ("address", "i.tnp.tnp-map-pin", "i[class*='map']"),
    "published_date": ("i.tnp.tnp-clock", "i[class*='clock']"),
}

TITLE_SELECTORS = (
    "div.text-gray-800.font-black", "h1", "[class*='title']", "[data-testid*='title']",
)
DESCRIPTION_SELECTORS = (
    "div.font-normal.text-gray-700.overflow-wrap-anywhere",
    "div[class*='description']", "article", "main",
)

# ==============================================================================
# HELPERS GÉNÉRIQUES & NETTOYAGE (Issus de extract_offer.py)
# ==============================================================================
def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def to_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt: return None
    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def strip_accents(text: str) -> str:
    if not text: return ""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))

def clean_text(value: Optional[str]) -> str:
    if value is None: return ""
    value = str(value).replace("\xa0", " ").replace("\u200b", "").replace("\ufeff", "")
    value = re.sub(r"[\t\r\n\f\v]+", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def slugify(value: Optional[str]) -> str:
    if not value: return ""
    value = strip_accents(clean_text(value))
    value = re.sub(r"[^A-Za-z0-9]+", "", value)
    return value.strip("_").upper()

def safe_node_text(node) -> str:
    if node is None: return ""
    try:
        return clean_text(node.text(deep=True, separator=" ", strip=True))
    except Exception:
        try:
            return clean_text(node.text())
        except Exception:
            return ""

# ==============================================================================
# HELPERS D'EXTRACTION DOM (Adaptés pour GoAfrica)
# ==============================================================================
def find_first_node(root, selectors: tuple[str, ...] | list[str]):
    if root is None: return None
    for selector in selectors:
        try:
            node = root.css_first(selector)
            if node is not None: return node
        except Exception:
            continue
    return None

def get_icon_value(tree, icon_selectors: tuple[str, ...]) -> Optional[str]:
    """Trouve l'icône et remonte au parent pour récupérer le texte du badge."""
    for sel in icon_selectors:
        try:
            icon_node = tree.css_first(sel)
            if icon_node:
                parent = icon_node.parent
                while parent:
                    text = safe_node_text(parent)
                    if text and len(text) > 2:
                        # Nettoie les préfixes type "Type de contrat : "
                        text = re.sub(r"^[^:]+:\s*", "", text).strip()
                        return text
                    parent = parent.parent
        except Exception:
            continue
    return None

# ==============================================================================
# NORMALISATION DES CHAMPS (Logique de extract_offer.py)
# ==============================================================================
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

DISTRICT_MAP = {
    "cocody": "Cocody", "plateau": "Plateau", "yopougon": "Yopougon",
    "marcory": "Marcory", "koumassi": "Koumassi", "treichville": "Treichville",
    "adjame": "Adjamé", "attecoube": "Attécoubé", "abobo": "Abobo",
    "port bouet": "Port-Bouët", "port-bouet": "Port-Bouët",
    "anvre": "Angré", "angre": "Angré", "riviera": "Riviera",
}
CI_CITIES = {
    "Abidjan", "Yamoussoukro", "Bouaké", "San-Pédro", "Korhogo", "Daloa", 
    "Gagnoa", "Man", "Bingerville", "Grand-Bassam", "Divo", "Abengourou"
}

def normalize_contract(raw: Optional[str]) -> str:
    if not raw: return "INCONNU"
    upper = strip_accents(raw.upper())
    if "CDD" in upper: return "CDD"
    if "CDI" in upper: return "CDI"
    if "STAGE" in upper: return "STAGE"
    if "ALTERNANCE" in upper: return "ALTERNANCE"
    if "INTERIM" in upper or "INTÉRIM" in upper: return "INTERIM"
    if "FREELANCE" in upper: return "FREELANCE"
    return "INCONNU"

def parse_experience_years(text: str) -> Tuple[Optional[int], Optional[int]]:
    if not text: return None, None
    txt = strip_accents(text.lower()) # Convertit "à" en "a", "é" en "e", etc.
    min_c, max_c = [], []
    
    # 1. FOURCHETTES : "de 2 ans à 5 ans", "entre 2 et 5 ans", "2 à 5 ans"
    range_matches = re.findall(r"(?:de|entre)?\s*(\d+)\s*(?:ans?|annees?)\s*(?:a|et)\s*(\d+)\s*(?:ans?|annees?)", txt)
    for a, b in range_matches:
        a, b = int(a), int(b)
        min_c.append(min(a, b))
        max_c.append(max(a, b))
        
    # 2. MINIMUMS : "+ de 1 an", "plus de 1 an", "minimum 1 an", "au moins 1 an"
    min_matches = re.findall(r"(?:\+|plus|plus\s+de|\+\s*de|minimum|minimal|au\s+moins)\s*(\d+)\s*(?:ans?|annees?)", txt)
    for val in min_matches:
        min_c.append(int(val))
        
    # 3. MAXIMUMS : "- de 2 ans", "moins de 2 ans", "jusqu'à 2 ans"
    max_matches = re.findall(r"(?:-|moins|moins\s+de|-\s*de|jusqu['']?a|max|maximum)\s*(\d+)\s*(?:ans?|annees?)", txt)
    for val in max_matches:
        max_c.append(int(val))
        
    # 4. SIMPLE : "X ans d'experience" (Fallback uniquement si aucun min/max explicite trouvé)
    # Cela évite de compter "2 ans" comme minimum si le texte original était "- de 2 ans"
    if not min_c and not max_c:
        simple_matches = re.findall(r"(\d+)\s*(?:ans?|annees?)\s*(?:d'?experience|experience)", txt)
        for val in simple_matches:
            min_c.append(int(val))
            
    min_years = min(min_c) if min_c else None
    max_years = max(max_c) if max_c else None
    
    # Sanity check : le max ne peut pas être inférieur au min
    if min_years is not None and max_years is not None and max_years < min_years:
        max_years = min_years
        
    return min_years, max_years


def normalize_experience(raw: Optional[str], min_years: Optional[int], max_years: Optional[int] = None) -> str:
    # Cas 1 : On a seulement un maximum (ex: "- de 2 ans")
    if min_years is None and max_years is not None:
        if max_years <= 1: return "DEBUTANT"
        if max_years <= 3: return "JUNIOR"
        if max_years <= 5: return "CONFIRME"
        return "SENIOR"
        
    # Cas 2 : On a un minimum (ex: "+ de 1 an", "de 2 à 5 ans", "3 ans")
    if min_years is not None:
        if min_years >= 5: return "SENIOR"
        if min_years >= 3: return "CONFIRME"
        if min_years >= 1: return "JUNIOR"
        return "DEBUTANT"
        
    # Cas 3 : Fallback sur le texte brut si aucun chiffre n'a été trouvé
    if not raw: return "INCONNU"
    normalized = strip_accents(raw.lower())
    if "debutant" in normalized: return "DEBUTANT"
    if "stagiaire" in normalized: return "STAGIAIRE"
    if "junior" in normalized: return "JUNIOR"
    if "senior" in normalized: return "SENIOR"
    if "confirme" in normalized: return "CONFIRME"
    return "INCONNU"

def parse_education(raw: Optional[str]) -> Dict[str, Any]:
    if not raw: return {"code": None, "label": None, "rank": None}
    ascii_text = strip_accents(raw)
    ranks = [int(x) for x in re.findall(r"BAC\s*\+\s*(\d{1,2})", ascii_text, re.I)]
    ranks = sorted({r for r in ranks if 0 <= r <= 10})
    if ranks:
        rank = ranks[0]
        return {"code": f"BAC_PLUS_{rank}", "label": f"BAC+{rank}", "rank": rank}
    if re.search(r"\bBAC\b", raw, re.I):
        return {"code": "BAC", "label": "BAC", "rank": 0}
    if re.search(r"\bCAP\b", raw, re.I):
        return {"code": "CAP", "label": "CAP", "rank": -1}
    return {"code": None, "label": raw, "rank": None}

def parse_location(raw: Optional[str]) -> Dict[str, Optional[str]]:
    raw = clean_text(raw)
    if not raw: return {"country_code": None, "city": None, "district": None, "label": None}
    
    ascii_raw = strip_accents(raw.lower())
    country_code = "CI" if any(t in ascii_raw for t in ["cote divoire", "cote d'ivoire"]) else None
    
    city = next((c for c in CI_CITIES if strip_accents(c.lower()) in ascii_raw), None)
    district = next((v for k, v in DISTRICT_MAP.items() if strip_accents(k) in ascii_raw), None)
    
    if district and not city and district in DISTRICT_MAP.values():
        city = "Abidjan"
    if city and not country_code:
        country_code = "CI"
        
    return {
        "country_code": country_code,
        "city": city,
        "district": district,
        "label": raw,
    }

def parse_french_date(raw: Optional[str]) -> Optional[datetime]:
    """Parse les dates françaises (ex: "13 août 2026", "Posté le 13 août 2026")"""
    if not raw: return None
    raw = clean_text(raw)
    raw = re.sub(r"^post[ée]e?\s+le\s*", "", raw, flags=re.IGNORECASE).strip()
    
    normalized = strip_accents(raw.lower())
    match = re.search(r"(\d{1,2})(?:er)?\s+([a-zûé]+)\s+(\d{4})", normalized)
    if match:
        jour, mois_texte, annee = int(match.group(1)), match.group(2), int(match.group(3))
        mois_fr = {"janvier":1,"fevrier":2,"mars":3,"avril":4,"mai":5,"juin":6,
                   "juillet":7,"aout":8,"septembre":9,"octobre":10,"novembre":11,"decembre":12}
        mois = mois_fr.get(mois_texte)
        if mois:
            try: return datetime(annee, mois, jour, tzinfo=timezone.utc)
            except ValueError: pass
            
    match_num = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", raw)
    if match_num:
        day, month, year = int(match_num.group(1)), int(match_num.group(2)), int(match_num.group(3))
        try: return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError: pass
    return None

# ==============================================================================
# EXTRACTION SPÉCIFIQUE GOAFRICA
# ==============================================================================
def get_data_company_go(tree) -> Dict[str, Any]:
    """Extraction de l'entreprise avec la logique de script.py"""
    company = {"website_url": None, "name": None, "type": None, "description": None}
    try:
        container = find_first_node(tree, COMPANY_CONTAINER_SELECTORS) or tree
        link_node = find_first_node(container, COMPANY_LINK_SELECTORS)
        if link_node:
            attrs = getattr(link_node, "attributes", {}) or {}
            href = attrs.get("href")
            if href:
                company["website_url"] = href if href.startswith("http") else f"https://www.goafricaonline.com{href}"
            company["name"] = safe_node_text(link_node)
        
        type_node = find_first_node(container, COMPANY_TYPE_SELECTORS)
        if type_node: company["type"] = safe_node_text(type_node)
            
        desc_node = find_first_node(container, COMPANY_DESC_SELECTORS)
        if desc_node: company["description"] = safe_node_text(desc_node)
    except Exception as e:
        logger.debug(f"Erreur extraction company: {e}")
    return company

def extract_emails_from_text(text: Optional[str]) -> List[str]:
    if not text: return []
    return list(set(EMAIL_RE.findall(text)))

# ==============================================================================
# PARSER PRINCIPAL
# ==============================================================================
def parse_job_html_go(html: Union[str, bytes, Any], source_url: Optional[str] = None) -> Dict[str, Any]:
    collected_at = utc_now()
    collected_iso = to_iso(collected_at)
    
    # Initialisation arbre
    if isinstance(html, (str, bytes)):
        if isinstance(html, bytes): html = html.decode("utf-8", errors="ignore")
        tree = HTMLParser(html) if HTMLParser else LexborHTMLParser(html)
    else:
        tree = html

    logger.info(f"[GoAfrica] Début parsing pour : {source_url}")

    # 1. Titres et Descriptions
    title_node = find_first_node(tree, TITLE_SELECTORS)
    title = safe_node_text(title_node) if title_node else None

    desc_node = find_first_node(tree, DESCRIPTION_SELECTORS)
    description = safe_node_text(desc_node) if desc_node else None

    # 2. Extraction via les icônes (Badges)
    contract_raw = get_icon_value(tree, ICON_SELECTORS["contract"])
    salary_raw = get_icon_value(tree, ICON_SELECTORS["salary"])
    experience_raw = get_icon_value(tree, ICON_SELECTORS["experience"])
    education_raw = get_icon_value(tree, ICON_SELECTORS["education"])
    location_raw = get_icon_value(tree, ICON_SELECTORS["location"])
    remote_raw = get_icon_value(tree, ICON_SELECTORS["remote"])
    published_raw = get_icon_value(tree, ICON_SELECTORS["published_date"])

    # Date d'expiration (Footer spécifique GoAfrica)
    expires_node = find_first_node(tree, ("div.text-brand-blue.font-bold", 'div[class*="echeance"]'))
    expires_raw = safe_node_text(expires_node) if expires_node else None

    # 3. Normalisation des données (Logique Jobivoire)
    contract_code = normalize_contract(contract_raw)
    
    min_years, max_years = parse_experience_years(experience_raw or "")
    exp_code = normalize_experience(experience_raw, min_years, max_years)
    experience_level = {
        "code": exp_code,
        "label": experience_raw or (f"{min_years} ans" if min_years else None),
        "min_years": min_years,
        "max_years": max_years
    }
    
    education_level = parse_education(education_raw)
    location = parse_location(location_raw)
    
    published_dt = parse_french_date(published_raw)
    expires_dt = parse_french_date(expires_raw)

    # 4. Entreprise et Emails
    company_data = get_data_company_go(tree)
    emails = extract_emails_from_text(description)
    
    # 5. Construction du résultat (Format identique à extract_offer.py)
    result = {
        "title": title,
        "source_url": source_url,
        "canonical_url": source_url,
        "location_raw": location_raw,
        "salary_raw": salary_raw,
        "published_at": to_iso(published_dt),
        "collected_at": collected_iso,
        "first_seen_at": collected_iso,
        "last_seen_at": collected_iso,
        "expires_at": to_iso(expires_dt),
        "application_deadline_at": to_iso(expires_dt),
        "location": location,
        "contract_type": {
            "code": contract_code,
            "label": contract_raw
        },
        "experience_level": experience_level,
        "education_level": education_level,
        "description": description,
        "company": {
            "name": company_data.get("name"),            
            "website_url": company_data.get("website_url"),
            "type": company_data.get("type"),
            "description": company_data.get("description"),
        },
        "company_hint": None,
        "application_email": emails[0] if emails else None,
        "application_emails": emails,
        "remote_work": remote_raw,
        "raw_fields": {
            "contract_raw": contract_raw,
            "experience_raw": experience_raw,
            "education_raw": education_raw,
            "published_raw": published_raw,
            "expires_raw": expires_raw,
        }
    }

    logger.info(f"[GoAfrica] Fin parsing : title={'✓' if title else '✗'}, desc={'✓' if description else '✗'}")
    return result

# ==============================================================================
# CLI POUR TESTS
# ==============================================================================
if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    if len(sys.argv) < 2:
        print("Usage: python extract_offer_Go.py <fichier.html> [source_url]")
        raise SystemExit(1)

    file_path = Path(sys.argv[1])
    url = sys.argv[2] if len(sys.argv) > 2 else "https://www.goafricaonline.com/test"

    if not file_path.exists():
        print(f"Erreur : fichier '{file_path}' introuvable.")
        raise SystemExit(1)

    html_content = file_path.read_text(encoding="utf-8", errors="ignore")
    parsed = parse_job_html_go(html_content, source_url=url)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))