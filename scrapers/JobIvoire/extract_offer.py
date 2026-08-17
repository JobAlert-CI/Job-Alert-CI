"""
jobivoire_parser.py

Parser d'offres d'emploi pour Jobivoire.
Utilise selectolax pour le parsing HTML.
Peut être importé par scriptJobIvoire.py ou utilisé en standalone.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone, time as dt_time
from typing import Any, Dict, List, Optional, Tuple, Union
import unicodedata

from loguru import logger
from selectolax.lexbor import LexborHTMLParser

try:
    from selectolax.parser import HTMLParser
except ImportError:
    HTMLParser = None

# --------------------------------------------------
# Constantes
# --------------------------------------------------

DEFAULT_STOP_LABELS = (
    r"Exp[ée]rience|Niveau\sd['’]?\s[ée]tude|Salaire|Description\s+du\s+poste|"
    r"D[ée]tails\s+de\s+l['’]offre|Publi[ée]\s+le|Dernier\s+d[ée]lai|Postuler|"
    r"Partager|Offres\s+similaires|Information\s+sur\s+le\s+poste|Recruteur\s+confidentiel|"
    r"Connectez-vous|Créez\s+votre\s+profil"
)

DESCRIPTION_STOPS = [
    "Attention aux arnaques",
    "Offres similaires",
    "Postuler maintenant",
    "Partager l'offre",
    "Connectez-vous pour postuler",
    "Service CV",
    "Alerte emploi",
    "Publicité",
    "Infos sur l'offre",
]

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

DISTRICT_MAP = {
    "cocody": "Cocody",
    "plateau": "Plateau",
    "yopougon": "Yopougon",
    "marcory": "Marcory",
    "koumassi": "Koumassi",
    "treichville": "Treichville",
    "adjame": "Adjamé",
    "attecoube": "Attécoubé",
    "abobo": "Abobo",
    "port bouet": "Port-Bouët",
    "port-bouet": "Port-Bouët",
    "anvre": "Angré",
    "angre": "Angré",
    "riviera": "Riviera",
    "ii plateaux": "II Plateaux",
    "2 plateaux": "II Plateaux",
    "deux plateaux": "II Plateaux",
    "blockhauss": "Blockhauss",
    "blockhaus": "Blockhauss",
    "djorobite": "Djorobite",
    "angre djorobite": "Angré Djorobite",
}

ABIDJAN_DISTRICTS = {
    "Cocody",
    "Plateau",
    "Yopougon",
    "Marcory",
    "Koumassi",
    "Treichville",
    "Adjamé",
    "Attécoubé",
    "Abobo",
    "Port-Bouët",
    "Angré",
    "Riviera",
    "II Plateaux",
    "Blockhauss",
    "Djorobite",
    "Angré Djorobite",
}

CI_CITIES = {
    "Abidjan",
    "Yamoussoukro",
    "Bouaké",
    "San-Pédro",
    "Korhogo",
    "Daloa",
    "Gagnoa",
    "Man",
    "Bingerville",
    "Grand-Bassam",
    "Divo",
    "Abengourou",
    "Odienné",
    "Séguéla",
    "Ferkessédougou",
    "Bondoukou",
    "Dimbokro",
    "Toumodi",
    "Dabou",
    "Jacqueville",
    "Tabou",
    "Sassandra",
    "Soubré",
    "Issia",
    "Vavoua",
    "Duékoué",
    "Guiglo",
    "Toulepleu",
}

BJ_CITIES = {
    "Cotonou",
    "Porto-Novo",
    "Parakou",
}

# --------------------------------------------------
# Helpers généraux
# --------------------------------------------------

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def strip_accents(text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def clean_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    value = str(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_line(value: Optional[str]) -> str:
    value = clean_text(value)
    return value.strip(" |:-–—•·").strip()


def slugify(value: Optional[str]) -> str:
    if not value:
        return ""
    value = strip_accents(clean_text(value))
    value = re.sub(r"[^A-Za-z0-9]+", "", value)
    return value.strip("_").upper()


def safe_extract(name: str, func, *args, default: Any = None, **kwargs) -> Any:
    """
    Wrapper pour éviter qu'une erreur d'extraction ne fasse échouer tout le parsing.
    Logue l'erreur avec le nom du champ et l'exception complète.
    """
    try:
        return func(*args, **kwargs)
    except Exception as exc:
        logger.opt(exception=True).warning(
            f"[Extraction] Champ '{name}' : erreur lors de l'extraction -> "
            f"{exc.__class__.__name__}: {exc}"
        )
        return default


# --------------------------------------------------
# Helpers Selectolax
# --------------------------------------------------

def _is_selectolax_tree(obj: Any) -> bool:
    """
    Vérifie si l'objet ressemble à un arbre Selectolax.
    On utilise du duck typing pour accepter aussi bien
    LexborHTMLParser que HTMLParser.
    """
    return (
        hasattr(obj, "css")
        and callable(getattr(obj, "css", None))
        and hasattr(obj, "css_first")
        and callable(getattr(obj, "css_first", None))
        and (
            hasattr(obj, "body")
            or hasattr(obj, "root")
        )
    )


def _ensure_tree(html: Union[str, bytes, Any]) -> Any:
    """
    Accepte soit :
    - str
    - bytes
    - LexborHTMLParser
    - HTMLParser
    """
    if _is_selectolax_tree(html):
        return html

    if isinstance(html, bytes):
        html = html.decode("utf-8", errors="ignore")

    if isinstance(html, str):
        return LexborHTMLParser(html)

    if HTMLParser is not None and isinstance(html, HTMLParser):
        return html

    raise TypeError(
        "parse_job_html() attend du HTML (str/bytes) "
        "ou un objet Selectolax HTMLParser/LexborHTMLParser."
    )


def node_text(node, separator: str = " ") -> str:
    if node is None:
        return ""
    try:
        return clean_text(node.text(deep=True, separator=separator, strip=True))
    except TypeError:
        try:
            return clean_text(node.text())
        except Exception as exc:
            logger.debug(f"[node_text] Erreur lors de l'extraction du texte d'un nœud : {exc}")
            return ""
    except Exception as exc:
        logger.debug(f"[node_text] Erreur inattendue : {exc}")
        return ""


def get_visible_text(tree: LexborHTMLParser) -> str:
    root = tree.body or tree.root
    if root is None:
        logger.warning("[get_visible_text] Aucun body/root trouvé dans l'arbre HTML.")
        return ""
    try:
        return root.text(deep=True, separator="\n", strip=True) or ""
    except TypeError:
        try:
            return root.text() or ""
        except Exception as exc:
            logger.warning(f"[get_visible_text] Erreur lors de l'extraction du texte visible : {exc}")
            return ""
    except Exception as exc:
        logger.warning(f"[get_visible_text] Erreur inattendue : {exc}")
        return ""


def css_first_text(tree: LexborHTMLParser, selectors: List[str], min_length: int = 0) -> Optional[str]:
    for selector in selectors:
        try:
            node = tree.css_first(selector)
            if node is not None:
                txt = node_text(node)
                if txt and len(txt) >= min_length:
                    return txt
        except Exception as exc:
            logger.debug(f"[css_first_text] Sélecteur '{selector}' a échoué : {exc}")
    return None


def make_header_text(visible_text: str) -> str:
    """
    Découpe la partie haute de la page pour éviter d'aller chercher
    des infos dans les offres similaires / footer.
    """
    if not visible_text:
        logger.debug("[make_header_text] Texte visible vide, rien à découper.")
        return ""

    markers = [
        "Description du poste",
        "Détails de l'offre",
        "Détails de l'offre",
        "Comment postuler",
        "Offres similaires",
        "📧 Votre dossier",
    ]

    for marker in markers:
        idx = visible_text.find(marker)
        if idx > 0:
            logger.debug(f"[make_header_text] Coupure au marqueur '{marker}' (index {idx}).")
            return visible_text[:idx]

    logger.debug("[make_header_text] Aucun marqueur de coupure trouvé, utilisation des 6000 premiers caractères.")
    return visible_text[:6000]


# --------------------------------------------------
# Extraction des champs principaux
# --------------------------------------------------

def extract_title(tree: LexborHTMLParser, visible_text: str) -> Optional[str]:
    candidates = []

    og_title = css_first_text(tree, ['meta[property="og:title"]'])
    if og_title:
        candidates.append(og_title)

    h1_title = css_first_text(tree, ["h1", ".job-title", ".title", "header h2"])
    if h1_title:
        candidates.append(h1_title)

    title_tag = css_first_text(tree, ["title"])
    if title_tag:
        candidates.append(title_tag)

    for candidate in candidates:
        cleaned = clean_text(candidate)
        cleaned = re.split(r"\s*[|-]\s*Jobivoire.*$", cleaned, flags=re.I)[0].strip()
        if cleaned:
            logger.debug(f"[extract_title] Titre trouvé : '{cleaned[:80]}'")
            return cleaned

    # Fallback texte visible
    for line in visible_text.splitlines():
        line = clean_line(line)
        if len(line) >= 12:
            lower = line.lower()
            if lower in {"accueil", "emploi"}:
                continue
            if re.search(r"dernier délai|réf|publié", line, re.I):
                continue
            logger.debug(f"[extract_title] Titre trouvé via fallback texte visible : '{line[:80]}'")
            return line

    logger.warning("[extract_title] TITRE INTROUVABLE : aucun candidat valide (og:title, h1, title, fallback texte).")
    return None


def extract_canonical_url(tree: LexborHTMLParser, source_url: Optional[str]) -> Optional[str]:
    selectors_attrs = [
        ('link[rel="canonical"]', "href"),
        ('meta[property="og:url"]', "content"),
        ('meta[name="twitter:url"]', "content"),
    ]

    for selector, attr in selectors_attrs:
        try:
            node = tree.css_first(selector)
            if node is not None and node.attributes:
                value = node.attributes.get(attr)
                if value:
                    logger.debug(f"[extract_canonical_url] URL canonique trouvée via '{selector}'.")
                    return clean_text(value)
        except Exception as exc:
            logger.debug(f"[extract_canonical_url] Sélecteur '{selector}' a échoué : {exc}")

    if source_url:
        logger.debug("[extract_canonical_url] Aucune URL canonique trouvée, utilisation de source_url.")
    else:
        logger.warning("[extract_canonical_url] Aucune URL canonique trouvée et source_url non fourni.")

    return source_url


def extract_reference(visible_text: str, source_url: Optional[str]) -> Optional[str]:
    if source_url:
        m = re.search(r"([A-Z]{2}-\d{4,})", source_url, re.I)
        if m:
            logger.debug(f"[extract_reference] Référence trouvée dans l'URL : {m.group(1).upper()}")
            return m.group(1).upper()

    patterns = [
        r"R[ée]f(?:[ée]rence)?\s*\.?\s*:?([A-Z]{2}-\d{4,})",
        r"R[ée]f(?:[ée]rence)?\s*\.?\s*:?([A-Z0-9]{2,}-\d{4,})",
        r"\b([A-Z]{2}-\d{4,})\b",
    ]

    for pattern in patterns:
        m = re.search(pattern, visible_text or "", re.I)
        if m:
            logger.debug(f"[extract_reference] Référence trouvée dans le texte : {m.group(1).upper()}")
            return m.group(1).upper()

    logger.warning("[extract_reference] RÉFÉRENCE INTROUVABLE : ni dans l'URL ni dans le texte.")
    return None


def extract_labeled_value(
    text: Optional[str],
    label_pattern: str,
    stop_pattern: str = DEFAULT_STOP_LABELS,
    max_next_lines: int = 2,
) -> Optional[str]:
    """
    Recherche une valeur associée à un libellé dans le texte visible.
    Ex: Lieu -> valeur, Expérience -> valeur, etc.
    """
    if not text:
        logger.debug(f"[extract_labeled_value] Texte vide pour le pattern '{label_pattern}'.")
        return None

    try:
        label_re = re.compile(label_pattern, re.I)
        stop_re = re.compile(stop_pattern, re.I)
    except re.error as exc:
        logger.error(f"[extract_labeled_value] Erreur de compilation regex pour '{label_pattern}' : {exc}")
        return None

    lines = text.splitlines()

    for i, raw_line in enumerate(lines):
        line = clean_line(raw_line)
        if not line:
            continue

        m = label_re.search(line)
        if not m:
            continue

        after = line[m.end():].strip(" :|-–—")

        if after:
            stop_match = stop_re.search(after)
            if stop_match and stop_match.start() > 0:
                after = after[:stop_match.start()]
            return clean_text(after)

        collected = []
        for raw_next in lines[i + 1:]:
            nxt = clean_line(raw_next)
            if not nxt:
                continue
            if stop_re.search(nxt):
                break
            collected.append(nxt)
            if len(collected) >= max_next_lines:
                break

        if collected:
            return clean_text(" ".join(collected))

    # Fallback regex globale
    try:
        fallback_pattern = rf"(?:{label_pattern})\s*[:\-–—]?\s*(.*?)(?=\s*(?:{stop_pattern})|$)"
        m = re.search(fallback_pattern, text, re.I | re.S)
        if m:
            value = clean_text(m.group(1))
            if value:
                logger.debug(f"[extract_labeled_value] Valeur trouvée via fallback regex pour '{label_pattern}'.")
                return value
    except re.error as exc:
        logger.debug(f"[extract_labeled_value] Erreur fallback regex pour '{label_pattern}' : {exc}")

    logger.debug(f"[extract_labeled_value] Aucune valeur trouvée pour le libellé '{label_pattern}'.")
    return None


def extract_location_fallback(text: Optional[str]) -> Optional[str]:
    if not text:
        logger.debug("[extract_location_fallback] Texte vide pour le fallback localisation.")
        return None

    m = re.search(
        r"(Côte d'Ivoire|Bénin|Abidjan|Cotonou|Yamoussoukro|Bouaké|San-Pédro)[^\n]{0,120}",
        text,
        re.I,
    )

    if m:
        logger.debug(f"[extract_location_fallback] Localisation trouvée via fallback : '{m.group(0)[:60]}'")
        return clean_text(m.group(0))

    logger.warning("[extract_location_fallback] LOCALISATION INTROUVABLE via le fallback.")
    return None


def extract_salary_raw(header_text: Optional[str]) -> Optional[str]:
    value = extract_labeled_value(
        header_text,
        r"Salaire(?:\s*propos[ée])?",
        DEFAULT_STOP_LABELS,
        max_next_lines=1,
    )

    if not value:
        logger.warning("[extract_salary_raw] SALAIRE INTROUVABLE dans le header.")
        return None

    value = clean_text(value)

    if re.fullmatch(r"(N/A|NA|N\.?D\.?|Non\s+renseign[ée]|Néant)", value, re.I):
        logger.debug(f"[extract_salary_raw] Salaire considéré comme non renseigné : '{value}'.")
        return None

    if value.upper().startswith("N/A"):
        logger.debug(f"[extract_salary_raw] Salaire commence par N/A : '{value}'.")
        return None

    logger.debug(f"[extract_salary_raw] Salaire trouvé : '{value[:60]}'")
    return value


def extract_deadline_raw(header_text: Optional[str]) -> Optional[str]:
    if not header_text:
        logger.warning("[extract_deadline_raw] Header vide, impossible d'extraire la date limite.")
        return None

    m = re.search(
        r"Dernier\s+d[ée]lai\s*:\s*(\d{1,2}/\d{1,2}/\d{4})",
        header_text,
        re.I,
    )

    if m:
        logger.debug(f"[extract_deadline_raw] Date limite trouvée via regex : {m.group(1)}")
        return m.group(1)

    result = extract_labeled_value(
        header_text,
        r"Dernier\s+d[ée]lai",
        DEFAULT_STOP_LABELS,
        max_next_lines=1,
    )

    if result:
        logger.debug(f"[extract_deadline_raw] Date limite trouvée via labeled value : '{result}'")
    else:
        logger.warning("[extract_deadline_raw] DATE LIMITE INTROUVABLE.")

    return result


def extract_contract(text: Optional[str]) -> Tuple[Optional[str], str]:
    if not text:
        logger.warning("[extract_contract] Texte vide, impossible d'extraire le type de contrat.")
        return None, "INCONNU"

    segment = text

    for marker in [
        "Information sur le poste",
        "Description du poste",
        "Détails de l'offre",
        "Détails de l'offre",
    ]:
        idx = segment.find(marker)
        if idx > 0:
            segment = segment[:idx]
            break

    match = None

    # Cas fréquent: "Emploi (CDD)Réf. XYZ" ou "StageRéf. XYZ"
    m = re.search(
        r"(Emploi\s*\([^)]*\)|Stage\s*\([^)]*\)|Stage|Emploi|CDD|CDI|Alternance|Freelance|Int[ée]rim)\s*R[ée]f",
        segment,
        re.I,
    )

    if m:
        match = m

    # Sinon, regarder juste avant la référence
    if not match:
        ref = re.search(r"R[ée]f(?:[ée]rence)?", segment, re.I)
        if ref:
            before = segment[:ref.start()]
            matches = list(
                re.finditer(
                    r"(Emploi\s*\([^)]*\)|Stage|Emploi|CDD|CDI|Alternance|Freelance|Int[ée]rim)",
                    before,
                    re.I,
                )
            )
            if matches:
                match = matches[-1]

    # Fallback plus large
    if not match:
        matches = list(
            re.finditer(
                r"(Emploi\s*\([^)]*\)|Stage|CDD|CDI|Alternance|Freelance|Int[ée]rim|Emploi)",
                segment,
                re.I,
            )
        )

        # Éviter le premier lien "Emploi" du menu si possible
        for item in matches:
            value = item.group(1)
            if "(" in value or value.lower() != "emploi":
                match = item
                break

        if not match and matches:
            match = matches[-1]

    raw = clean_text(match.group(1)) if match else None
    code = normalize_contract(raw)

    if raw:
        logger.debug(f"[extract_contract] Contrat trouvé : '{raw}' -> code '{code}'")
    else:
        logger.warning("[extract_contract] TYPE DE CONTRAT INTROUVABLE, code 'INCONNU' retourné.")

    return raw, code


def normalize_contract(raw: Optional[str]) -> str:
    if not raw:
        return "INCONNU"

    upper = strip_accents(raw.upper())

    if "CDD" in upper:
        return "CDD"
    if "CDI" in upper:
        return "CDI"
    if "STAGE" in upper:
        return "STAGE"
    if "ALTERNANCE" in upper:
        return "ALTERNANCE"
    if "INTERIM" in upper:
        return "INTERIM"
    if "FREELANCE" in upper:
        return "FREELANCE"
    if "EMPLOI" in upper:
        return "INCONNU"

    return "INCONNU"


def extract_description(tree: LexborHTMLParser, visible_text: str) -> Optional[str]:
    # 1) Sélecteurs précis
    specific_selectors = [
        ".job-description",
        "#description",
        '[id*="description"]',
        "article",
    ]

    for selector in specific_selectors:
        try:
            node = tree.css_first(selector)
            if node is not None:
                txt = node_text(node, separator="\n")
                cleaned = clean_description(txt)
                if len(cleaned) > 120:
                    logger.debug(f"[extract_description] Description trouvée via sélecteur '{selector}' ({len(cleaned)} chars).")
                    return cleaned
        except Exception as exc:
            logger.debug(f"[extract_description] Sélecteur '{selector}' a échoué : {exc}")

    # 2) Regex sur texte visible
    patterns = [
        re.compile(
            r"D[ée]tails\s+de\s+l['’]offre\s*(.*?)(?:📧\s*Votre dossier|Comment postuler\s*\??|"
            r"Attention aux arnaques|Offres similaires|Partager l['’]offre|$)",
            re.I | re.S,
        ),
        re.compile(
            r"Description\s+du\s+poste\s*(.*?)(?:Comment postuler\s*\??|Attention aux arnaques|"
            r"Offres similaires|Partager l['’]offre|$)",
            re.I | re.S,
        ),
    ]

    for pattern in patterns:
        m = pattern.search(visible_text or "")
        if m:
            cleaned = clean_description(m.group(1))
            if cleaned:
                logger.debug(f"[extract_description] Description trouvée via regex ({len(cleaned)} chars).")
                return cleaned

    # 3) Sélecteurs plus larges
    broad_selectors = [
        '[class*="description"]',
        ".card-body",
    ]

    for selector in broad_selectors:
        try:
            node = tree.css_first(selector)
            if node is not None:
                txt = node_text(node, separator="\n")
                cleaned = clean_description(txt)
                if len(cleaned) > 120:
                    logger.debug(f"[extract_description] Description trouvée via sélecteur large '{selector}' ({len(cleaned)} chars).")
                    return cleaned
        except Exception as exc:
            logger.debug(f"[extract_description] Sélecteur large '{selector}' a échoué : {exc}")

    # 4) Meta description
    meta = css_first_text(tree, ['meta[property="og:description"]', 'meta[name="description"]'])
    if meta:
        logger.debug(f"[extract_description] Description trouvée via meta ({len(meta)} chars).")
        return clean_description(meta)

    logger.warning("[extract_description] DESCRIPTION INTROUVABLE : aucun sélecteur, regex ou meta n'a fonctionné.")
    return None


def clean_description(text: Optional[str]) -> str:
    if not text:
        return ""

    text = clean_text(text)

    for stop in DESCRIPTION_STOPS:
        idx = text.find(stop)
        if idx != -1:
            text = text[:idx]

    text = re.sub(r"^D[ée]tails\s+de\s+l['’]offre\s*", "", text, flags=re.I)
    text = re.sub(r"^Description\s+du\s+poste\s*", "", text, flags=re.I)

    return text.strip()


# --------------------------------------------------
# Dates
# --------------------------------------------------

def parse_french_date(raw: Optional[str], end_of_day: bool = False) -> Optional[datetime]:
    if not raw:
        logger.debug("[parse_french_date] Date brute vide.")
        return None

    raw = clean_text(raw)
    if not raw:
        logger.debug("[parse_french_date] Date brute vide après nettoyage.")
        return None

    # ISO direct, si jamais
    try:
        iso_raw = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_raw)
        logger.debug(f"[parse_french_date] Date parsée au format ISO : {dt}")
        return dt.astimezone(timezone.utc)
    except Exception:
        pass

    normalized = strip_accents(raw.lower())
    now = utc_now()
    base_date = None

    if "hier" in normalized:
        base_date = (now - timedelta(days=1)).date()
    elif "aujourd" in normalized:
        base_date = now.date()
    else:
        m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
        if m:
            day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        else:
            m2 = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", raw)
            if not m2:
                logger.debug(f"[parse_french_date] Format de date non reconnu : '{raw}'.")
                return None
            year, month, day = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))

        try:
            base_date = datetime(year, month, day, tzinfo=timezone.utc).date()
        except ValueError:
            logger.warning(f"[parse_french_date] DATE INVALIDE : '{raw}'.")
            return None

    hour = 0
    minute = 0

    m_time = re.search(r"(\d{1,2})[:h](\d{2})", raw)
    if m_time:
        try:
            h = int(m_time.group(1))
            mn = int(m_time.group(2))
            if 0 <= h <= 23 and 0 <= mn <= 59:
                hour = h
                minute = mn
        except Exception:
            pass

    if hour == 0 and minute == 0 and end_of_day:
        return datetime.combine(base_date, dt_time(23, 59, 59), tzinfo=timezone.utc)

    return datetime.combine(base_date, dt_time(hour, minute), tzinfo=timezone.utc)


# --------------------------------------------------
# Expérience
# --------------------------------------------------

def parse_experience(header_text: Optional[str], description: Optional[str]) -> Tuple[Optional[str], Dict[str, Any]]:
    raw = extract_labeled_value(
        header_text,
        r"Exp[ée]rience",
        DEFAULT_STOP_LABELS,
        max_next_lines=1,
    )

    min_years, max_years = parse_experience_years(description or "")
    code = normalize_experience(raw, min_years)

    label = raw
    if not label:
        if min_years is not None:
            label = f"{min_years} ans minimum" if min_years > 0 else "Débutant"
        else:
            label = None

    if raw:
        logger.debug(f"[parse_experience] Expérience trouvée : '{raw}' -> code '{code}'")
    else:
        logger.warning(f"[parse_experience] EXPÉRIENCE INTROUVABLE. Code retourné : '{code}'.")

    return raw, {
        "code": code,
        "label": label,
        "min_years": min_years,
        "max_years": max_years,
    }


def parse_experience_years(text: str) -> Tuple[Optional[int], Optional[int]]:
    if not text:
        return None, None

    txt = strip_accents(text.lower())

    min_candidates: List[int] = []
    max_candidates: List[int] = []

    for m in re.finditer(r"entre\s*(\d+)\s*et\s*(\d+)\s*(?:ans?|annees?)", txt):
        a, b = int(m.group(1)), int(m.group(2))
        min_candidates.append(min(a, b))
        max_candidates.append(max(a, b))

    for m in re.finditer(r"(?:minimum|minimal|au\s+moins|plus\s+de)\s*(\d+)\s*(?:ans?|annees?)", txt):
        min_candidates.append(int(m.group(1)))

    for m in re.finditer(r"(?:maximum|max|au\s+plus|jusqu\'?a)\s*(\d+)\s*(?:ans?|annees?)", txt):
        max_candidates.append(int(m.group(1)))

    for m in re.finditer(r"(\d+)\s*(?:ans?|annees?)\s*(?:d'?experience|experience)", txt):
        min_candidates.append(int(m.group(1)))

    for m in re.finditer(r"experience\s*(?:de|d'?)?\s*(\d+)\s*(?:ans?|annees?)", txt):
        min_candidates.append(int(m.group(1)))

    range_m = re.search(r"(\d+)\s*mois\s*(?:a|-|–|et)\s*(\d+)\s*(?:ans?|annees?)", txt)
    if range_m:
        min_candidates.append(0)
        max_candidates.append(int(range_m.group(2)))

    if re.search(r"\bmois\b", txt) and not min_candidates:
        min_candidates.append(0)

    min_candidates = [x for x in min_candidates if 0 <= x <= 50]
    max_candidates = [x for x in max_candidates if 0 <= x <= 50]

    min_years = min(min_candidates) if min_candidates else None
    max_years = max(max_candidates) if max_candidates else None

    if min_years is not None and max_years is not None and max_years < min_years:
        max_years = min_years

    return min_years, max_years


def normalize_experience(raw: Optional[str], min_years: Optional[int]) -> str:
    if min_years is not None:
        if min_years >= 5:
            return "SENIOR"
        if min_years >= 3:
            return "CONFIRME"
        if min_years >= 1:
            return "JUNIOR"
        return "DEBUTANT"

    if not raw:
        return "INCONNU"

    normalized = strip_accents(raw.lower())

    if "debutant" in normalized:
        return "DEBUTANT"
    if "stagiaire" in normalized or "etudiant" in normalized:
        return "STAGIAIRE"
    if "junior" in normalized:
        return "JUNIOR"
    if "senior" in normalized:
        return "SENIOR"
    if "confirme" in normalized:
        return "CONFIRME"

    return "INCONNU"


# --------------------------------------------------
# Formation / Niveau d'étude
# --------------------------------------------------

def parse_education(header_text: Optional[str], description: Optional[str]) -> Tuple[Optional[str], Dict[str, Any]]:
    raw = extract_labeled_value(
        header_text,
        r"Niveau\sd['’']?\s[ée]tude",
        DEFAULT_STOP_LABELS,
        max_next_lines=1,
    )

    if not raw and description:
        m = re.search(
            r"Niveau\s+minimum\s+souhait[ée]\s*:\s*([^.\n]+)",
            description,
            re.I,
        )
        if m:
            raw = clean_text(m.group(1))

    search_text = " ".join(filter(None, [raw, description, header_text]))
    ascii_text = strip_accents(search_text or "")

    ranks = [int(x) for x in re.findall(r"BAC\s*\+\s*(\d{1,2})", ascii_text, re.I)]
    ranks = sorted({r for r in ranks if 0 <= r <= 10})

    if ranks:
        rank = ranks[0]
        label = f"BAC+{rank}"
        logger.debug(f"[parse_education] Niveau d'études trouvé : {label}")
        return raw or label, {
            "code": f"BAC_PLUS_{rank}",
            "label": label,
            "rank": rank,
        }

    if raw and re.search(r"\bBAC\b", raw, re.I):
        logger.debug("[parse_education] Niveau d'études trouvé : BAC")
        return raw, {
            "code": "BAC",
            "label": "BAC",
            "rank": 0,
        }

    if raw and re.search(r"\bCAP\b", raw, re.I):
        logger.debug("[parse_education] Niveau d'études trouvé : CAP")
        return raw, {
            "code": "CAP",
            "label": "CAP",
            "rank": -1,
        }

    if raw:
        logger.debug(f"[parse_education] Niveau d'études trouvé (non classifié) : '{raw}'")
    else:
        logger.warning("[parse_education] NIVEAU D'ÉTUDES INTROUVABLE.")

    return raw, {
        "code": None,
        "label": raw,
        "rank": None,
    }


# --------------------------------------------------
# Spécialité / domaine
# --------------------------------------------------

def extract_specialty(
    tree: LexborHTMLParser,
    header_text: Optional[str],
    title: Optional[str],
    location_raw: Optional[str],
) -> Dict[str, Optional[str]]:
    # 1) Sélecteurs CSS éventuels
    css_value = css_first_text(
        tree,
        [
            ".specialty",
            ".category",
            ".job-category",
            '[class*="category"]',
            '[class*="secteur"]',
            'a[href*="category"]',
            'a[href*="categorie"]',
            'a[href*="secteur"]',
        ],
    )

    if css_value and len(css_value) < 120:
        code, label = normalize_specialty(css_value)
        logger.debug(f"[extract_specialty] Spécialité trouvée via CSS : '{label}' -> code '{code}'")
        return {"code": code, "label": label}

    # 2) Liens avec href catégorie
    try:
        for a in tree.css("a"):
            href = (a.attributes or {}).get("href", "") if a.attributes else ""
            text = node_text(a)
            if not text or not href:
                continue

            if re.search(r"categ|secteur|domaine|specialite", href, re.I):
                if text.lower() not in {"accueil", "emploi", "voir tout"} and len(text) < 120:
                    code, label = normalize_specialty(text)
                    logger.debug(f"[extract_specialty] Spécialité trouvée via lien href : '{label}' -> code '{code}'")
                    return {"code": code, "label": label}
    except Exception as exc:
        logger.debug(f"[extract_specialty] Erreur lors de la recherche de liens catégorie : {exc}")

    # 3) Heuristique texte visible
    if not header_text:
        logger.warning("[extract_specialty] Header vide, impossible d'extraire la spécialité via heuristique.")
        return {"code": None, "label": None}

    lines = [clean_line(line) for line in header_text.splitlines()]
    title_l = (title or "").lower()
    loc_l = (location_raw or "").lower()

    stop_re = re.compile(
        r"accueil|emploi|dernier délai|réf|publié|lieu|expérience|niveau|salaire|bac\+|"
        r"recruteur|postuler|partager|information",
        re.I,
    )

    term_re = re.compile(
        r"(electrom[ée]canique|electrotechnique|electricit[ée]|electronique|communication|"
        r"marketing|finance|comptabilit[ée]|informatique|logistique|ressources humaines|rh|"
        r"btp|mines|hse|s[ée]curit[ée]|m[ée]canique|vente|commercial[e]?|audit|juridique|"
        r"assurance|banque|t[ée]l[ée]com|r[ée]seaux|d[ée]veloppement|design|infographie|"
        r"audiovisuel)",
        re.I,
    )

    for line in lines:
        if not line or len(line) > 120:
            continue
        if stop_re.search(line):
            continue
        if title_l and line.lower() in title_l:
            continue
        if loc_l and line.lower() in loc_l:
            continue
        if term_re.search(line):
            code, label = normalize_specialty(line)
            logger.debug(f"[extract_specialty] Spécialité trouvée via mot-clé métier : '{label}' -> code '{code}'")
            return {"code": code, "label": label}

    # Fallback: ligne courte avec slash/virgule
    for line in lines:
        if not line or len(line) < 3 or len(line) > 80:
            continue
        if stop_re.search(line):
            continue
        if re.search(r"\d{2}/\d{2}/\d{4}|BAC\+|RY-|UW-|VI-", line, re.I):
            continue
        if title_l and line.lower() in title_l:
            continue
        if loc_l and line.lower() in loc_l:
            continue
        if re.search(r"[A-Za-zÀ-ÿ]{3,}", line) and re.search(r"[/,]", line):
            code, label = normalize_specialty(line)
            logger.debug(f"[extract_specialty] Spécialité trouvée via fallback slash/virgule : '{label}' -> code '{code}'")
            return {"code": code, "label": label}

    logger.warning("[extract_specialty] SPÉCIALITÉ INTROUVABLE : aucune méthode n'a fonctionné.")
    return {"code": None, "label": None}


def normalize_specialty(raw: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    label = clean_text(raw)
    if not label:
        return None, None

    base = label.split(",")[0].split("/")[0]
    code = slugify(base) or "SPECIALTY"

    return code, label


# --------------------------------------------------
# Localisation
# --------------------------------------------------

def parse_location(raw: Optional[str]) -> Dict[str, Optional[str]]:
    raw = clean_text(raw)

    if not raw:
        logger.warning("[parse_location] Localisation brute vide.")
        return {
            "country_code": None,
            "city": None,
            "district": None,
            "label": None,
            "normalized_label": None,
        }

    ascii_raw = strip_accents(raw.lower())

    country_code = None

    if any(term in ascii_raw for term in ["cote divoire", "cote d'ivoire", "ivory coast"]):
        country_code = "CI"
    elif "benin" in ascii_raw:
        country_code = "BJ"

    city = None

    for c in CI_CITIES:
        if strip_accents(c.lower()) in ascii_raw:
            city = c
            break

    if not city:
        for c in BJ_CITIES:
            if strip_accents(c.lower()) in ascii_raw:
                city = c
                break

    district = None

    for key, value in DISTRICT_MAP.items():
        if strip_accents(key.lower()) in ascii_raw:
            district = value
            break

    if district and not city and district in ABIDJAN_DISTRICTS:
        city = "Abidjan"

    if city:
        if city in CI_CITIES:
            country_code = country_code or "CI"
        elif city in BJ_CITIES:
            country_code = country_code or "BJ"

    if country_code is None and (city == "Abidjan" or district in ABIDJAN_DISTRICTS):
        country_code = "CI"

    country_name = None

    if country_code == "CI":
        country_name = "Côte d'Ivoire"
    elif country_code == "BJ":
        country_name = "Bénin"

    parts = [p for p in [district, city, country_name] if p]
    normalized_label = ", ".join(parts).lower() if parts else raw.lower()

    logger.debug(f"[parse_location] Localisation parsée : city='{city}', district='{district}', country='{country_code}'")

    return {
        "country_code": country_code,
        "city": city,
        "district": district,
        "label": raw,
        "normalized_label": normalized_label,
    }


# --------------------------------------------------
# Emails / entreprise
# --------------------------------------------------

def extract_emails(tree: LexborHTMLParser, visible_text: str, description: Optional[str]) -> List[str]:
    emails: List[str] = []

    def add_email(email: Optional[str]) -> None:
        if not email:
            return
        email = email.strip().lower()
        if email.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            return
        if EMAIL_RE.fullmatch(email) and email not in emails:
            emails.append(email)

    try:
        for node in tree.css('a[href^="mailto:"]'):
            href = node.attributes.get("href", "") if node.attributes else ""
            if href:
                email = href.replace("mailto:", "").split("?")[0]
                add_email(email)
    except Exception as exc:
        logger.debug(f"[extract_emails] Erreur lors de l'extraction des liens mailto : {exc}")

    for text in [visible_text, description]:
        if not text:
            continue
        for match in EMAIL_RE.findall(text):
            add_email(match)

    if emails:
        logger.debug(f"[extract_emails] {len(emails)} email(s) trouvé(s).")
    else:
        logger.warning("[extract_emails] AUCUN EMAIL de candidature trouvé.")

    return emails


def extract_company_name(
    tree: LexborHTMLParser,
    visible_text: str,
    description: Optional[str],
    emails: List[str],
) -> Optional[str]:
    css_company = css_first_text(
        tree,
        [
            ".company-name",
            '[class*="company"]',
            '[class*="recruiter"]',
            ".recruiter",
        ],
    )

    if css_company:
        logger.debug(f"[extract_company_name] Nom d'entreprise trouvé via CSS : '{css_company}'")
        return css_company

    text = " ".join(filter(None, [description, visible_text]))

    m = re.search(r"([A-Z][A-Za-zÀ-ÿ0-9&\- ]{2,60})\s+recrute", text)
    if m:
        logger.debug(f"[extract_company_name] Nom d'entreprise trouvé via pattern 'recrute' : '{m.group(1)}'")
        return clean_text(m.group(1))

    if re.search(r"Recruteur\s+confidentiel", visible_text or "", re.I):
        logger.debug("[extract_company_name] Recruteur confidentiel détecté.")
        return "Recruteur confidentiel"

    logger.warning("[extract_company_name] NOM DE L'ENTREPRISE INTROUVABLE.")
    return None


def extract_company_hint(emails: List[str]) -> Optional[str]:
    for email in emails:
        email_l = email.lower()
        if "sudcontractors" in email_l:
            return "SUD CONTRACTORS"
        if "pograwa" in email_l:
            return "POGRAWA HOLDING"

    return None


# --------------------------------------------------
# Parser principal
# --------------------------------------------------

def parse_job_html(
    html: Union[str, bytes, Any],
    source_url: Optional[str] = None
) -> Dict[str, Any]:
    collected_at = utc_now()
    collected_iso = to_iso(collected_at)

    empty_location = {
        "country_code": None,
        "city": None,
        "district": None,
        "label": None,
        "normalized_label": None,
    }

    empty_experience = {
        "code": None,
        "label": None,
        "min_years": None,
        "max_years": None,
    }

    empty_education = {
        "code": None,
        "label": None,
        "rank": None,
    }

    empty_specialty = {
        "code": None,
        "label": None,
    }

    # --- Initialisation du parser HTML ---
    try:
        tree = _ensure_tree(html)
    except Exception as exc:
        logger.opt(exception=True).error(
            f"[parse_job_html] IMPOSSIBLE D'INITIALISER LE PARSER HTML : {exc}"
        )
        return {
            "error": "html_parse_failed",
            "detail": str(exc),
            "collected_at": collected_iso,
        }

    logger.info(f"[parse_job_html] Début du parsing pour : {source_url or 'source inconnue'}")

    # --- Texte visible ---
    visible_text = safe_extract("visible_text", get_visible_text, tree, default="") or ""
    header_text = safe_extract("header_text", make_header_text, visible_text, default="") or ""

    if not visible_text:
        logger.warning("[parse_job_html] AUCUN TEXTE VISIBLE extrait de la page.")

    # --- Champs principaux ---
    title = safe_extract("title", extract_title, tree, visible_text)
    reference = safe_extract("reference", extract_reference, visible_text, source_url)
    canonical_url = safe_extract("canonical_url", extract_canonical_url, tree, source_url) or source_url

    location_raw = safe_extract(
        "location_raw",
        extract_labeled_value,
        header_text,
        r"Lieu|Localisation",
        DEFAULT_STOP_LABELS,
        1,
    )

    if not location_raw:
        logger.debug("[parse_job_html] Localisation non trouvée via labeled value, tentative fallback.")
        location_raw = safe_extract("location_fallback", extract_location_fallback, header_text or visible_text)

    if not location_raw:
        logger.warning("[parse_job_html] LOCALISATION INTROUVABLE après toutes les tentatives.")

    salary_raw = safe_extract("salary_raw", extract_salary_raw, header_text)

    published_raw = safe_extract(
        "published_raw",
        extract_labeled_value,
        header_text,
        r"Publi[ée]\s+le",
        DEFAULT_STOP_LABELS,
        1,
    )

    if not published_raw:
        logger.warning("[parse_job_html] DATE DE PUBLICATION INTROUVABLE.")

    deadline_raw = safe_extract("deadline_raw", extract_deadline_raw, header_text or visible_text)

    contract_result = safe_extract(
        "contract",
        extract_contract,
        header_text or visible_text,
        default=(None, "INCONNU"),
    )
    contract_raw, contract_code = contract_result if isinstance(contract_result, tuple) else (None, "INCONNU")

    description = safe_extract("description", extract_description, tree, visible_text)

    experience_result = safe_extract(
        "experience",
        parse_experience,
        header_text,
        description,
        default=(None, empty_experience),
    )
    experience_raw, experience_level = experience_result if isinstance(experience_result, tuple) else (None, empty_experience)

    education_result = safe_extract(
        "education",
        parse_education,
        header_text,
        description,
        default=(None, empty_education),
    )
    education_raw, education_level = education_result if isinstance(education_result, tuple) else (None, empty_education)

    specialty = safe_extract(
        "specialty",
        extract_specialty,
        tree,
        header_text or visible_text,
        title,
        location_raw,
        default=empty_specialty,
    )

    emails = safe_extract("emails", extract_emails, tree, visible_text, description, default=[])

    company_name = safe_extract(
        "company_name",
        extract_company_name,
        tree,
        visible_text,
        description,
        emails,
    )

    company_hint = safe_extract("company_hint", extract_company_hint, emails)

    location = safe_extract("location", parse_location, location_raw, default=empty_location)

    published_dt = safe_extract("published_date", parse_french_date, published_raw, False)
    deadline_dt = safe_extract("deadline_date", parse_french_date, deadline_raw, True)

    published_at = to_iso(published_dt)
    deadline_at = to_iso(deadline_dt)

    if not published_at and published_raw:
        logger.warning(f"[parse_job_html] Date de publication non parsable : '{published_raw}'.")
    elif not published_at:
        logger.debug("[parse_job_html] Date de publication absente.")

    if not deadline_at and deadline_raw:
        logger.warning(f"[parse_job_html] Date limite non parsable : '{deadline_raw}'.")

    # --- Construction du résultat ---
    result: Dict[str, Any] = {
        "title": title,
        "source_reference": reference,
        "source_url": source_url,
        "canonical_url": canonical_url,
        "location_raw": location_raw,
        "salary_raw": salary_raw,
        "published_at": published_at,
        "collected_at": collected_iso,
        "first_seen_at": collected_iso,
        "last_seen_at": collected_iso,
        "expires_at": deadline_at,
        "application_deadline_at": deadline_at,
        "location": location,
        "specialty": specialty,
        "contract_type": {
            "code": contract_code,
            "label": contract_raw,
        },
        "experience_level": experience_level,
        "education_level": education_level,
        "description": description,
        "company_name": company_name,
        "company_hint": company_hint,
        "application_email": emails[0] if emails else None,
        "application_emails": emails,
        "raw_fields": {
            "published_raw": published_raw,
            "deadline_raw": deadline_raw,
            "contract_raw": contract_raw,
            "experience_raw": experience_raw,
            "education_raw": education_raw,
        },
    }

    # --- Résumé des champs manquants ---
    critical_missing = [
        key
        for key in ("title", "description", "location_raw")
        if not result.get(key)
    ]

    if critical_missing:
        logger.warning(f"[parse_job_html] CHAMPS CRITIQUES MANQUANTS : {critical_missing}")

    secondary_missing = [
        key
        for key in ("source_reference", "salary_raw", "published_at", "expires_at", "company_name")
        if not result.get(key)
    ]

    if secondary_missing:
        logger.debug(f"[parse_job_html] Champs secondaires manquants : {secondary_missing}")

    logger.info(
        f"[parse_job_html] Parsing terminé pour {source_url or 'source inconnue'} : "
        f"title={'✓' if title else '✗'}, "
        f"ref={'✓' if reference else '✗'}, "
        f"desc={'✓' if description else '✗'}, "
        f"location={'✓' if location_raw else '✗'}, "
        f"contract={'✓' if contract_raw else '✗'}"
    )

    return result


# --------------------------------------------------
# CLI optionnelle pour tester rapidement
# --------------------------------------------------

if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    if len(sys.argv) < 2:
        print("Usage: python extract_offer.py <fichier.html> [source_url]")
        raise SystemExit(1)

    file_path = Path(sys.argv[1])
    url = sys.argv[2] if len(sys.argv) > 2 else None

    if not file_path.exists():
        print(f"Erreur : fichier '{file_path}' introuvable.")
        raise SystemExit(1)

    try:
        html_content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        print(f"Erreur lors de la lecture du fichier : {exc}")
        raise SystemExit(1)

    parsed = parse_job_html(html_content, source_url=url)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))