"""
extract_offer_Educ.py
Parser d'offres d'emploi pour Educarriere.
Utilise la logique de normalisation de extract_offer.py (Jobivoire) 
mais avec les sélecteurs CSS et la structure DOM d'Educarriere.
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
# SÉLECTEURS EDUCARRIERE (Issus de script.py)
# ==============================================================================
TITLE_SELECTORS = (
    "h1.joh-title", "h1", "[class*='title']",
)
DESCRIPTION_SELECTORS = (
    "div.offer-description-wrap", "div[class*='description']", "article", "main",
)
CONTRACT_TYPE_SELECTORS = (
    "div.joh-top span.joh-type-badge", "span.joh-type-badge", 
    "[class*='type-badge']", "div[class*='top'] span",
)
STATS_CONTAINER_SELECTORS = (
    "div.joh-stats", "div[class*='stats']", "ul[class*='stats']",
)
STAT_VALUE_SELECTORS = (
    "strong.joh-stat__val", "span.joh-stat__val", "[class*='stat__val']", "strong",
)
SECTEUR_ICON_SELECTORS = (
    "i.fa.fa-suitcase", "i[class*='suitcase']", "i[class*='briefcase']",
)
LOCATION_ICON_SELECTORS = (
    "i.fa.fa-map-marker", "i[class*='map-marker']", "i[class*='map']",
)
EDUCATION_ICON_SELECTORS = (
    "i.fa.fa-graduation-cap", "i[class*='graduation-cap']", "i[class*='graduation']",
)
EXPERIENCE_ICON_SELECTORS = (
    "i.fa.fa-briefcase", "i[class*='briefcase']", "i[class*='experience']",
)
EXPIRES_ICON_SELECTORS = (
    "i.fa.fa-calendar-times-o", "i[class*='calendar-times']", "i[class*='calendar']",
)
PUBLISHED_DATE_SELECTORS = (
    "div.joh-footer span.joh-date", "span.joh-date", "[class*='date']",
)
COMPANY_CONTAINER_SELECTORS = (
    "div.joh-company", "section[class*='company']", "div[class*='company']", "aside",
)
COMPANY_NAME_SELECTORS = (
    "div.joh-company span.joh-company-name", "span.joh-company-name", "[class*='company-name']",
)
COMPANY_LINK_SELECTORS = (
    "div.joh-company a", "a[href*='company']", "a[href*='entreprise']", "a[class*='company']",
)
COMPANY_DESC_SELECTORS = (
    "div.joh-company p", "div[class*='company-description']", "p",
)

# ==============================================================================
# HELPERS GÉNÉRIQUES & NETTOYAGE (Issus de extract_offer.py)
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
# HELPERS D'EXTRACTION DOM (Adaptés pour Educarriere)
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

def extract_stat_value(container, icon_selectors: tuple[str, ...]) -> Optional[str]:
    """
    Extrait une statistique à partir d'une icône FontAwesome (spécifique Educarriere).
    Stratégie : trouver l'icône -> remonter au parent -> chercher strong/span.joh-stat__val.
    """
    if container is None: return None
    icon_node = find_first_node(container, icon_selectors)
    if icon_node is None: return None
    
    current = icon_node
    for _ in range(4):
        if current is None: break
        value_node = find_first_node(current, STAT_VALUE_SELECTORS)
        if value_node is not None:
            val = safe_node_text(value_node)
            if val: return val
        try:
            current = current.parent
        except Exception:
            break
    return None

def extract_emails_from_text(text: Optional[str]) -> List[str]:
    if not text: return []
    return list(set(EMAIL_RE.findall(text)))

# ==============================================================================
# NORMALISATION DES CHAMPS (Logique de extract_offer.py)
# ==============================================================================
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
    txt = strip_accents(text.lower())
    min_c, max_c = [], []
    
    # Fourchettes
    for m in re.finditer(r"(?:de|entre)?\s*(\d+)\s*(?:ans?|annees?)\s*(?:a|et)\s*(\d+)\s*(?:ans?|annees?)", txt):
        a, b = int(m.group(1)), int(m.group(2))
        min_c.append(min(a, b)); max_c.append(max(a, b))
    # Minimums
    for m in re.finditer(r"(?:\+|plus|minimum|minimal|au\s+moins)\s*(\d+)\s*(?:ans?|annees?)", txt):
        min_c.append(int(m.group(1)))
    # Maximums
    for m in re.finditer(r"(?:-|moins|jusqu['']?a|max|maximum)\s*(\d+)\s*(?:ans?|annees?)", txt):
        max_c.append(int(m.group(1)))
    # Simple
    if not min_c and not max_c:
        for m in re.finditer(r"(\d+)\s*(?:ans?|annees?)\s*(?:d'?experience|experience)", txt):
            min_c.append(int(m.group(1)))
            
    min_years = min(min_c) if min_c else None
    max_years = max(max_c) if max_c else None
    if min_years is not None and max_years is not None and max_years < min_years:
        max_years = min_years
    return min_years, max_years

def normalize_experience(raw: Optional[str], min_years: Optional[int], max_years: Optional[int] = None) -> str:
    if min_years is None and max_years is not None:
        if max_years <= 1: return "DEBUTANT"
        if max_years <= 3: return "JUNIOR"
        if max_years <= 5: return "CONFIRME"
        return "SENIOR"
    if min_years is not None:
        if min_years >= 5: return "SENIOR"
        if min_years >= 3: return "CONFIRME"
        if min_years >= 1: return "JUNIOR"
        return "DEBUTANT"
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
    if re.search(r"\bLICENCE\b", raw, re.I) or re.search(r"\bMASTER\b", raw, re.I):
        return {"code": strip_accents(raw.upper()), "label": raw, "rank": None}
    return {"code": None, "label": raw, "rank": None}

def parse_location(raw: Optional[str]) -> Dict[str, Optional[str]]:
    raw = clean_text(raw)
    if not raw: return {"country_code": None, "city": None, "district": None, "label": None}
    ascii_raw = strip_accents(raw.lower())
    country_code = "CI" if any(t in ascii_raw for t in ["cote divoire", "cote d'ivoire"]) else None
    city = next((c for c in CI_CITIES if strip_accents(c.lower()) in ascii_raw), None)
    district = next((v for k, v in DISTRICT_MAP.items() if strip_accents(k) in ascii_raw), None)
    if district and not city and district in DISTRICT_MAP.values(): city = "Abidjan"
    if city and not country_code: country_code = "CI"
    return {"country_code": country_code, "city": city, "district": district, "label": raw}

def parse_french_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw: return None
    raw = clean_text(raw)
    raw = re.sub(r"^(post[ée]e?|publi[ée]e?|date de publication)\s*(le\s*)?", "", raw, flags=re.IGNORECASE).strip()
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
# EXTRACTION SPÉCIFIQUE EDUCARRIERE
# ==============================================================================
def get_data_company_educ(tree) -> Dict[str, Any]:
    company = {"website_url": None, "name": None, "type": None, "description": None}
    try:
        container = find_first_node(tree, COMPANY_CONTAINER_SELECTORS) or tree
        name_node = find_first_node(container, COMPANY_NAME_SELECTORS)
        if name_node:
            company["name"] = safe_node_text(name_node)
        
        link_node = find_first_node(container, COMPANY_LINK_SELECTORS)
        if link_node is None and name_node is not None:
            if getattr(name_node, "tag", "") == "a": link_node = name_node
            
        if link_node:
            attrs = getattr(link_node, "attributes", {}) or {}
            href = attrs.get("href")
            if href:
                company["website_url"] = href if href.startswith("http") else f"https://emploi.educarriere.ci{href}"
                
        desc_node = find_first_node(container, COMPANY_DESC_SELECTORS)
        if desc_node: company["description"] = safe_node_text(desc_node)
    except Exception as e:
        logger.debug(f"Erreur extraction company: {e}")
    return company

# ==============================================================================
# PARSER PRINCIPAL
# ==============================================================================
def parse_job_html_educ(html: Union[str, bytes, Any], source_url: Optional[str] = None) -> Dict[str, Any]:
    collected_at = utc_now()
    collected_iso = to_iso(collected_at)
    
    if isinstance(html, (str, bytes)):
        if isinstance(html, bytes): html = html.decode("utf-8", errors="ignore")
        tree = HTMLParser(html) if HTMLParser else LexborHTMLParser(html)
    else:
        tree = html

    logger.info(f"[Educarriere] Début parsing pour : {source_url}")

    # 1. Titres et Descriptions
    title_node = find_first_node(tree, TITLE_SELECTORS)
    title = safe_node_text(title_node) if title_node else None

    desc_node = find_first_node(tree, DESCRIPTION_SELECTORS)
    description = safe_node_text(desc_node) if desc_node else None

    # 2. Contrat (Badge)
    contract_node = find_first_node(tree, CONTRACT_TYPE_SELECTORS)
    contract_raw = safe_node_text(contract_node) if contract_node else None

    # 3. Statistiques (via icônes FontAwesome)
    stats_container = find_first_node(tree, STATS_CONTAINER_SELECTORS) or tree
    
    secteur_raw = extract_stat_value(stats_container, SECTEUR_ICON_SELECTORS)
    location_raw = extract_stat_value(stats_container, LOCATION_ICON_SELECTORS)
    education_raw = extract_stat_value(stats_container, EDUCATION_ICON_SELECTORS)
    experience_raw = extract_stat_value(stats_container, EXPERIENCE_ICON_SELECTORS)
    expires_raw = extract_stat_value(stats_container, EXPIRES_ICON_SELECTORS)
    
    # Date de publication
    pub_node = find_first_node(tree, PUBLISHED_DATE_SELECTORS)
    published_raw = safe_node_text(pub_node) if pub_node else None

    # 4. Normalisation des données
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

    # 5. Entreprise et Emails
    company_data = get_data_company_educ(tree)
    emails = extract_emails_from_text(description)
    
    # 6. Construction du résultat (Format identique à extract_offer.py)
    result = {
        "title": title,
        "source_url": source_url,
        "canonical_url": source_url,
        "location_raw": location_raw,
        "salary_raw": None, # Pas d'icône salaire explicite sur Educarriere
        "published_at": to_iso(published_dt),
        "collected_at": collected_iso,
        "first_seen_at": collected_iso,
        "last_seen_at": collected_iso,
        "expires_at": to_iso(expires_dt),
        "application_deadline_at": to_iso(expires_dt),
        "location": location,
        "specialty": {"code": strip_accents(secteur_raw).lower() if secteur_raw else None, "label": secteur_raw},
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
            "description": company_data.get("description")
        },
        "company_hint": None,
        "application_email": emails[0] if emails else None,
        "application_emails": emails,
        "remote_work": None,
        "raw_fields": {
            "contract_raw": contract_raw,
            "experience_raw": experience_raw,
            "education_raw": education_raw,
            "published_raw": published_raw,
            "expires_raw": expires_raw,
            "secteur_raw": secteur_raw,
        }
    }

    logger.info(f"[Educarriere] Fin parsing : title={'✓' if title else '✗'}, desc={'✓' if description else '✗'}")
    return result

# ==============================================================================
# CLI POUR TESTS
# ==============================================================================
if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    if len(sys.argv) < 2:
        print("Usage: python extract_offer_Educ.py <fichier.html> [source_url]")
        raise SystemExit(1)

    file_path = Path(sys.argv[1])
    url = sys.argv[2] if len(sys.argv) > 2 else "https://emploi.educarriere.ci/test"

    if not file_path.exists():
        print(f"Erreur : fichier '{file_path}' introuvable.")
        raise SystemExit(1)

    html_content = file_path.read_text(encoding="utf-8", errors="ignore")
    parsed = parse_job_html_educ(html_content, source_url=url)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))