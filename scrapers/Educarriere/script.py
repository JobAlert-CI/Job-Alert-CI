import json
import os
import random
import re
import shutil
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import urljoin, urlparse, urlunparse

from loguru import logger
from playwright.sync_api import (
    Error as PlaywrightError,
    Locator,
    Page,
    Route,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)
from selectolax.parser import HTMLParser


# =============================================================================
# CHARGEMENT DU .ENV
# =============================================================================

def load_env_file_fallback() -> None:
    """
    Charge manuellement un fichier .env si python-dotenv n'est pas installé.
    """
    candidates = [
        Path(".env"),
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]

    for env_path in candidates:
        if not env_path.exists():
            continue

        try:
            content = env_path.read_text(encoding="utf-8")

            for line in content.splitlines():
                line = line.strip()

                if not line or line.startswith("#") or "=" not in line:
                    continue

                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()

                if value and value[0] in {"'", '"'} and value[-1] == value[0]:
                    value = value[1:-1]

                if key and key not in os.environ:
                    os.environ[key] = value

            return
        except Exception as exc:
            print(f"Impossible de charger manuellement le fichier .env : {exc}", file=sys.stderr)
            return


def load_environment() -> None:
    """
    Charge le fichier .env avec python-dotenv si disponible,
    sinon utilise un fallback manuel.
    """
    candidates = [
        Path(".env"),
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]

    try:
        from dotenv import load_dotenv

        for candidate in candidates:
            if candidate.exists():
                load_dotenv(dotenv_path=candidate, override=False)
                return

        load_dotenv(override=False)
    except ImportError:
        load_env_file_fallback()


load_environment()


# =============================================================================
# OPTION : PLAYWRIGHT STEALTH
# =============================================================================

try:
    from playwright_stealth import Stealth
    STEALTH_MODE = "class"
except ImportError:
    try:
        from playwright_stealth import stealth_sync as _stealth_sync
        STEALTH_MODE = "function"
    except ImportError:
        STEALTH_MODE = None
        _stealth_sync = None


# =============================================================================
# CONFIGURATION GLOBALE - PRÉFIXE EDUC_
# =============================================================================

BASE_URL = os.getenv("EDUC_BASE_URL", "https://emploi.educarriere.ci/page/all").strip()

OUTPUT_FILE = Path(os.getenv("EDUC_OUTPUT_FILE", "donnees_jobs_Educ.json"))
FAILED_FILE = Path(os.getenv("EDUC_FAILED_FILE", "failed_jobs_Educ.json"))
LOG_FILE = Path(os.getenv("EDUC_LOG_FILE", "logsEduc.log"))

HEADLESS = os.getenv("EDUC_HEADLESS", "1").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

try:
    MAX_PAGES = max(1, int(os.getenv("EDUC_MAX_PAGES", "20")))
except ValueError:
    MAX_PAGES = 20

try:
    MAX_JOBS = max(0, int(os.getenv("EDUC_MAX_JOBS", "0")))
except ValueError:
    MAX_JOBS = 0

try:
    NAVIGATION_TIMEOUT_MS = int(os.getenv("EDUC_NAV_TIMEOUT_MS", "45000"))
except ValueError:
    NAVIGATION_TIMEOUT_MS = 45000

try:
    ACTION_TIMEOUT_MS = int(os.getenv("EDUC_ACTION_TIMEOUT_MS", "8000"))
except ValueError:
    ACTION_TIMEOUT_MS = 8000

COUNTRY_CODE = os.getenv("EDUC_COUNTRY_CODE", "CI").strip().upper()

LOG_LEVEL = os.getenv("EDUC_LOG_LEVEL", "INFO").strip().upper()
if LOG_LEVEL not in {"TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"}:
    LOG_LEVEL = "INFO"

BLOCKED_RESOURCE_TYPES = {"image", "font"}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)

parsed_base = urlparse(BASE_URL)
BASE_DOMAIN = parsed_base.netloc.lower().split(":")[0]
if BASE_DOMAIN.startswith("www."):
    BASE_DOMAIN = BASE_DOMAIN[4:]

SCRAPERS_ROOT = Path(__file__).resolve().parents[1]
if str(SCRAPERS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_ROOT))

from common.ingestion import maybe_send_jobs_to_api


# =============================================================================
# SÉLECTEURS SPÉCIFIQUES AU SITE EDUC
# =============================================================================

LIST_SELECTOR_CONFIGS = (
    # (sélecteur, exige_mots_clés_dans_url)
    ("div.ej-content a.ej-poste", False),
    ("a.ej-poste", False),
    ("div.ej-content a[href]", True),
    ("a[href*='poste']", True),
    ("a[href*='offre']", True),
    ("a[href*='emploi']", True),
    ("article a[href]", True),
)

JOB_URL_KEYWORDS = (
    "poste",
    "job",
    "offre",
    "emploi",
    "annonce",
    "detail",
    "details",
    "recrutement",
)

JOB_BODY_SELECTORS = (
    "div.joh-body",
    "main",
    "article",
    "div[id*='job']",
    "div[class*='job']",
)

TITLE_SELECTORS = (
    "h1.joh-title",
    "h1",
    "[class*='title']",
)

CONTRACT_TYPE_SELECTORS = (
    "div.joh-top span.joh-type-badge",
    "span.joh-type-badge",
    "[class*='type-badge']",
    "div[class*='top'] span",
)

STATS_CONTAINER_SELECTORS = (
    "div.joh-stats",
    "div[class*='stats']",
    "ul[class*='stats']",
)

STAT_VALUE_SELECTORS = (
    "strong.joh-stat__val",
    "span.joh-stat__val",
    "[class*='stat__val']",
    "strong",
)

STAT_ITEM_CLASS_HINTS = (
    "joh-stat",
    "stat",
    "item",
    "badge",
    "chip",
    "col",
)

SECTEUR_ICON_SELECTORS = (
    "i.fa.fa-suitcase",
    "i[class*='suitcase']",
    "i[class*='briefcase']",
)

LOCATION_ICON_SELECTORS = (
    "i.fa.fa-map-marker",
    "i[class*='map-marker']",
    "i[class*='map']",
)

EDUCATION_ICON_SELECTORS = (
    "i.fa.fa-graduation-cap",
    "i[class*='graduation-cap']",
    "i[class*='graduation']",
)

EXPIRES_ICON_SELECTORS = (
    "i.fa.fa-calendar-times-o",
    "i[class*='calendar-times']",
    "i[class*='calendar']",
)

PUBLISHED_DATE_SELECTORS = (
    "div.joh-footer span.joh-date",
    "span.joh-date",
    "[class*='date']",
)

DESCRIPTION_SELECTORS = (
    "div.offer-description-wrap",
    "div[class*='description']",
    "article",
    "main",
)

APPLY_LINK_SELECTORS = (
    "div.offer-description-wrap a",
    "a[class*='apply']",
    "a[href*='apply']",
    "a[href*='postule']",
)

COMPANY_CONTAINER_SELECTORS = (
    "div.joh-company",
    "section[class*='company']",
    "div[class*='company']",
    "aside",
)

COMPANY_NAME_SELECTORS = (
    "div.joh-company span.joh-company-name",
    "span.joh-company-name",
    "[class*='company-name']",
)

COMPANY_LINK_SELECTORS = (
    "div.joh-company a",
    "a[href*='company']",
    "a[href*='entreprise']",
    "a[class*='company']",
)

COMPANY_DESC_SELECTORS = (
    "div.joh-company p",
    "div[class*='company-description']",
    "p",
)


# =============================================================================
# DATES
# =============================================================================

MOIS_FR = {
    "janvier": "01",
    "fevrier": "02",
    "mars": "03",
    "avril": "04",
    "mai": "05",
    "juin": "06",
    "juillet": "07",
    "aout": "08",
    "septembre": "09",
    "octobre": "10",
    "novembre": "11",
    "decembre": "12",
}

MONTH_ALIASES = {
    "jan": "janvier",
    "fev": "fevrier",
    "feb": "fevrier",
    "mar": "mars",
    "avr": "avril",
    "apr": "avril",
    "mai": "mai",
    "jun": "juin",
    "jui": "juin",
    "jul": "juillet",
    "aou": "aout",
    "aug": "aout",
    "sep": "septembre",
    "oct": "octobre",
    "nov": "novembre",
    "dec": "decembre",
}


# =============================================================================
# LOGGING
# =============================================================================

def setup_logger() -> None:
    """
    Configure les logs :
    - fichier détaillé DEBUG
    - console INFO par défaut
    """
    logger.remove()

    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        print(f"Impossible de créer le dossier de logs : {exc}", file=sys.stderr)

    logger.add(
        str(LOG_FILE),
        level="DEBUG",
        rotation="10 MB",
        retention="14 days",
        compression="zip",
        encoding="utf-8",
        backtrace=True,
        diagnose=False,
    )

    logger.add(
        sys.stderr,
        level=LOG_LEVEL,
        backtrace=True,
        diagnose=False,
    )


# =============================================================================
# OUTILS GÉNÉRIQUES
# =============================================================================

def retry_sync(
    func: Callable[[], Any],
    *,
    attempts: int = 3,
    min_delay: float = 1.0,
    max_delay: float = 8.0,
    what: str = "opération",
) -> Any:
    """
    Réessaie une fonction avec backoff exponentiel.
    """
    last_exception: Optional[Exception] = None

    for attempt in range(1, attempts + 1):
        try:
            return func()
        except (
            PlaywrightError,
            PlaywrightTimeoutError,
            ConnectionError,
            TimeoutError,
            OSError,
        ) as exc:
            last_exception = exc

            if attempt >= attempts:
                break

            delay = min(
                max_delay,
                min_delay * (2 ** (attempt - 1)) + random.uniform(0.0, 0.5),
            )

            logger.warning(
                f"{what} : tentative {attempt}/{attempts} échouée "
                f"({exc.__class__.__name__}: {exc}). "
                f"Nouvelle tentative dans {delay:.2f}s."
            )

            time.sleep(delay)

    logger.error(f"{what} : échec définitif après {attempts} tentative(s).")

    if last_exception:
        raise last_exception

    return None


def human_wait(page: Optional[Page], min_s: float = 1.0, max_s: float = 3.0) -> None:
    """
    Attend un délai aléatoire pour simuler un comportement humain.
    """
    delay = random.uniform(min_s, max_s)

    if page is None:
        time.sleep(delay)
        return

    try:
        page.wait_for_timeout(int(delay * 1000))
    except Exception as exc:
        logger.debug(f"human_wait via Playwright impossible, fallback time.sleep : {exc}")
        time.sleep(delay)


def clean_text(value: Any) -> Optional[str]:
    """
    Nettoie un texte : espaces insécables, caractères invisibles, espaces multiples.
    """
    if value is None:
        return None

    try:
        text = str(value)
        text = text.replace("\xa0", " ")
        text = text.replace("\u200b", "")
        text = text.replace("\ufeff", "")

        text = unicodedata.normalize("NFKC", text)
        text = re.sub(r"[\t\r\n\f\v]+", " ", text)
        text = re.sub(r"\s{2,}", " ", text)
        text = text.strip()

        return text if text else None
    except Exception as exc:
        logger.debug(f"Erreur dans clean_text : {exc}")
        return None


def remove_accents(value: Optional[str]) -> str:
    """
    Supprime les accents pour les comparaisons ou parsing de dates.
    """
    if not value:
        return ""

    nfkd_form = unicodedata.normalize("NFD", value)
    return "".join(c for c in nfkd_form if unicodedata.category(c) != "Mn")


def make_code(value: Optional[str]) -> Optional[str]:
    """
    Transforme un label en code technique.
    Exemple : 'Temps plein' -> 'temps_plein'
    """
    if not value:
        return None

    code = remove_accents(str(value)).lower()
    code = re.sub(r"[^a-z0-9]+", "_", code)
    code = code.strip("_")

    return code or None


def safe_text(node: Any) -> Optional[str]:
    """
    Récupère le texte d'un nœud selectolax sans lever d'exception.
    """
    if node is None:
        return None

    try:
        return node.text(deep=True)
    except TypeError:
        try:
            return node.text()
        except Exception as exc:
            logger.debug(f"Impossible de récupérer le texte du nœud : {exc}")
            return None
    except Exception as exc:
        logger.debug(f"Impossible de récupérer le texte du nœud : {exc}")
        return None


def find_first_node(root: Any, selectors: tuple[str, ...] | list[str]) -> Any:
    """
    Essaie plusieurs sélecteurs CSS et retourne le premier nœud trouvé.
    """
    if root is None:
        return None

    for selector in selectors:
        try:
            node = root.css_first(selector)
            if node is not None:
                return node
        except Exception as exc:
            logger.debug(f"Sélecteur invalide ou erreur '{selector}' : {exc}")

    return None


def normalize_url(href: Optional[str]) -> Optional[str]:
    """
    Transforme un lien relatif en lien absolu et supprime le fragment.
    """
    if not href:
        return None

    href = href.strip()

    if href.startswith(("javascript:", "mailto:", "tel:", "#")):
        return None

    try:
        absolute = urljoin(BASE_URL, href)
    except Exception as exc:
        logger.debug(f"URL impossible à normaliser '{href}' : {exc}")
        return None

    parsed = urlparse(absolute)

    if parsed.scheme not in {"http", "https"}:
        return None

    try:
        return urlunparse(parsed._replace(fragment=""))
    except Exception:
        return absolute


def is_probable_job_link(url: Optional[str]) -> bool:
    """
    Filtre les liens qui semblent être des pages de poste.
    """
    if not url:
        return False

    parsed = urlparse(url)
    netloc = parsed.netloc.lower().split(":")[0]

    if BASE_DOMAIN and netloc and not netloc.endswith(BASE_DOMAIN):
        return False

    path_and_query = f"{parsed.path} {parsed.query}".lower()
    return any(keyword in path_and_query for keyword in JOB_URL_KEYWORDS)


def build_html_parser(page: Page) -> Optional[HTMLParser]:
    """
    Récupère le HTML de la page et construit un parser selectolax.
    """
    try:
        content = page.content()
        return HTMLParser(content)
    except Exception as exc:
        logger.opt(exception=True).error(f"Impossible de récupérer le HTML de la page : {exc}")
        return None


def save_json(data: Any, path: Path, description: str) -> None:
    """
    Sauvegarde JSON de manière atomique.
    """
    try:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        tmp_path = path.with_name(f"{path.name}.{os.getpid()}.tmp")

        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        shutil.move(str(tmp_path), str(path))

        count = len(data) if hasattr(data, "__len__") else "?"
        logger.debug(f"{description} sauvegardé : {path} ({count} élément(s)).")
    except Exception as exc:
        logger.opt(exception=True).error(f"Échec de la sauvegarde JSON vers {path} : {exc}")


def close_safely(closeable: Any, name: str) -> None:
    """
    Ferme un objet Playwright sans lever d'exception.
    """
    if closeable is None:
        return

    try:
        closeable.close()
        logger.debug(f"{name} fermé correctement.")
    except Exception as exc:
        logger.debug(f"Erreur lors de la fermeture de {name} : {exc}")


# =============================================================================
# PLAYWRIGHT : NAVIGATION / ACTIONS
# =============================================================================

def block_resources(route: Route) -> None:
    """
    Bloque certaines ressources pour accélérer le scraping.
    """
    try:
        if route.request.resource_type in BLOCKED_RESOURCE_TYPES:
            route.abort()
        else:
            route.continue_()
    except Exception as exc:
        logger.debug(f"Erreur dans block_resources : {exc}")
        try:
            route.continue_()
        except Exception:
            pass


def apply_stealth(context: Any) -> None:
    """
    Applique playwright-stealth si disponible.
    """
    if STEALTH_MODE is None:
        logger.warning("playwright-stealth n'est pas installé. Continuation sans stealth.")
        return

    try:
        if STEALTH_MODE == "class":
            Stealth().apply_stealth_sync(context)
        elif STEALTH_MODE == "function" and _stealth_sync is not None:
            _stealth_sync(context)

        logger.info("Stealth appliqué au contexte Playwright.")
    except Exception as exc:
        logger.warning(f"Impossible d'appliquer playwright-stealth : {exc}")


def launch_browser(p: Any) -> Any:
    """
    Lance le navigateur Chromium avec des options anti-détection basiques.
    """
    args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
    ]

    logger.info(f"Lancement du navigateur Chromium (headless={HEADLESS}).")

    return p.chromium.launch(
        headless=HEADLESS,
        args=args,
    )


def create_context(browser: Any) -> Any:
    """
    Crée un contexte navigateur avec timeouts, user-agent et blocage de ressources.
    """
    context = browser.new_context(
        user_agent=USER_AGENT,
        locale="fr-FR",
        timezone_id="Europe/Paris",
        viewport={"width": 1366, "height": 768},
    )

    try:
        context.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
        context.set_default_timeout(ACTION_TIMEOUT_MS)
    except Exception as exc:
        logger.warning(f"Impossible de définir les timeouts par défaut : {exc}")

    try:
        context.route("**/*", block_resources)
    except Exception as exc:
        logger.warning(f"Impossible de mettre en place le blocage de ressources : {exc}")

    apply_stealth(context)

    return context


def goto_safe(page: Page, url: str, attempts: int = 3) -> bool:
    """
    Charge une URL avec retry.
    """
    if not url:
        logger.warning("goto_safe appelé avec une URL vide.")
        return False

    def _goto() -> bool:
        page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)

        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except PlaywrightError:
            logger.debug(f"networkidle non atteint pour {url}, continuation.")

        return True

    try:
        retry_sync(_goto, attempts=attempts, what=f"Chargement de {url}")
        return True
    except Exception as exc:
        logger.error(f"Échec de chargement de {url} : {exc}")
        return False


def wait_for_page_ready(page: Page) -> None:
    """
    Attend que la page soit suffisamment chargée.
    """
    try:
        page.wait_for_load_state("domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
    except Exception:
        logger.debug("wait_for_load_state('domcontentloaded') a échoué ou timeout.")

    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        logger.debug("wait_for_load_state('networkidle') a échoué ou timeout.")


def safe_click_locator(
    locator: Locator,
    description: str,
    timeout_ms: int = ACTION_TIMEOUT_MS,
) -> bool:
    """
    Clique sur un locator de manière sécurisée.
    """
    try:
        if locator.count() == 0:
            logger.debug(f"{description} : aucun élément trouvé.")
            return False

        first = locator.first

        if not first.is_visible():
            logger.debug(f"{description} : élément présent mais invisible.")
            return False

        first.scroll_into_view_if_needed(timeout=timeout_ms)
        first.click(timeout=timeout_ms)

        logger.debug(f"{description} : clic réussi.")
        return True
    except Exception as exc:
        logger.debug(f"{description} : clic impossible -> {exc}")
        return False


def auto_scroll(page: Page, scrolls: int = 4) -> None:
    """
    Scrolle la page pour déclencher d'éventuels chargements paresseux.
    """
    try:
        for _ in range(scrolls):
            page.mouse.wheel(0, 1800)
            page.wait_for_timeout(250)

        page.evaluate("window.scrollTo(0, 0);")
    except Exception as exc:
        logger.debug(f"Scroll automatique impossible : {exc}")


def goto_next_page(page: Page, current_page_number: int) -> bool:
    """
    Essaie de naviguer vers la page suivante de pagination.
    """
    next_number = current_page_number + 1

    candidates = [
        page.locator("button.pagination-btn-nav").filter(
            has_text=re.compile(r"suivant", re.IGNORECASE)
        ),
        page.get_by_role("button", name=re.compile(r"suivant", re.IGNORECASE)),
        page.get_by_role("link", name=re.compile(r"suivant", re.IGNORECASE)),
        page.get_by_role("button", name=f"Page {next_number}", exact=True),
        page.get_by_role("link", name=f"Page {next_number}", exact=True),
        page.locator('a[rel="next"]'),
        page.locator("li.next a"),
        page.locator("li.pagination-next a"),
    ]

    for candidate in candidates:
        if safe_click_locator(candidate, f"Pagination suivante (page {next_number})"):
            wait_for_page_ready(page)
            human_wait(page, 1.0, 3.0)
            logger.info(f"Navigation vers la page {next_number} réussie.")
            return True

    logger.debug(f"Aucun bouton de pagination trouvé pour la page {next_number}.")
    return False


# =============================================================================
# COLLECTE DES LIENS
# =============================================================================

def extract_links_from_current_page(page: Page) -> list[str]:
    """
    Extrait les liens de la page courante en utilisant plusieurs sélecteurs.
    """
    html = build_html_parser(page)

    if html is None:
        return []

    links: list[str] = []
    seen_local: set[str] = set()

    for selector, require_keyword in LIST_SELECTOR_CONFIGS:
        try:
            anchors = html.css(selector)
        except Exception as exc:
            logger.debug(f"Sélecteur de liens invalide '{selector}' : {exc}")
            continue

        if not anchors:
            continue

        found = 0

        for a_tag in anchors:
            try:
                attributes = getattr(a_tag, "attributes", None) or {}
                href = attributes.get("href")

                url = normalize_url(href)
                if not url:
                    continue

                if require_keyword and not is_probable_job_link(url):
                    continue

                if url not in seen_local:
                    seen_local.add(url)
                    links.append(url)
                    found += 1
            except Exception as exc:
                logger.debug(f"Erreur lors de l'extraction d'un lien : {exc}")

        if links:
            logger.debug(f"{found} lien(s) collectés avec le sélecteur '{selector}'.")
            break

    return links


def collect_all_job_links(page: Page) -> list[str]:
    """
    Collecte les liens de postes sur plusieurs pages.
    """
    links: list[str] = []
    seen: set[str] = set()

    current_page_number = 1
    max_pages = max(1, MAX_PAGES)

    while current_page_number <= max_pages:
        logger.info(f"Collecte des liens sur la page {current_page_number}.")

        wait_for_page_ready(page)
        auto_scroll(page)

        page_links = extract_links_from_current_page(page)
        new_links = [link for link in page_links if link not in seen]

        if new_links:
            seen.update(new_links)
            links.extend(new_links)

        logger.info(
            f"Page {current_page_number} : "
            f"{len(page_links)} lien(s) détecté(s), "
            f"{len(new_links)} nouveau(x), "
            f"total collecté : {len(links)}."
        )

        if not new_links and current_page_number > 1:
            logger.info("Aucun nouveau lien sur cette page. Arrêt de la pagination.")
            break

        if current_page_number >= max_pages:
            logger.info("Nombre maximum de pages atteint.")
            break

        if not goto_next_page(page, current_page_number):
            logger.info("Fin de la pagination.")
            break

        current_page_number += 1

    logger.info(f"Nombre total de liens collectés : {len(links)}")
    return links


# =============================================================================
# UTILITAIRES D'EXTRACTION
# =============================================================================

def extract_meta_content(html: HTMLParser, selectors: tuple[str, ...] | list[str]) -> Optional[str]:
    """
    Extrait le contenu d'une balise meta.
    """
    node = find_first_node(html, selectors)

    if node is None:
        return None

    try:
        attributes = getattr(node, "attributes", None) or {}
        return clean_text(attributes.get("content"))
    except Exception as exc:
        logger.debug(f"Erreur lors de l'extraction meta : {exc}")
        return None


def extract_first_text_from_selectors(
    roots: tuple[Any, ...] | list[Any],
    selectors: tuple[str, ...] | list[str],
    field_name: str,
    url: str,
) -> Optional[str]:
    """
    Cherche un nœud via plusieurs racines et sélecteurs, puis retourne son texte.
    """
    for root in roots:
        if root is None:
            continue

        node = find_first_node(root, selectors)

        if node:
            text = clean_text(safe_text(node))
            if text:
                return text

    logger.warning(f"{field_name} : texte introuvable sur {url}.")
    return None


def extract_stat_value(
    container: Any,
    icon_selectors: tuple[str, ...] | list[str],
    field_name: str,
    url: str,
    log_if_missing: bool = True,
) -> Optional[str]:
    """
    Extrait une statistique à partir d'une icône FontAwesome.

    Stratégie :
    1. trouver l'icône ;
    2. remonter vers le parent ;
    3. chercher strong.joh-stat__val ;
    4. sinon retourner le texte le plus proche.
    """
    if container is None:
        if log_if_missing:
            logger.warning(f"{field_name} : conteneur absent sur {url}.")
        return None

    icon_node = find_first_node(container, icon_selectors)

    if icon_node is None:
        if log_if_missing:
            logger.warning(
                f"{field_name} : icône introuvable sur {url}. "
                f"Sélecteurs testés : {', '.join(icon_selectors)}."
            )
        return None

    current = icon_node
    first_text: Optional[str] = None

    for level in range(4):
        if current is None:
            break

        value_node = find_first_node(current, STAT_VALUE_SELECTORS)

        if value_node is not None:
            value = clean_text(safe_text(value_node))

            if value:
                logger.debug(
                    f"{field_name} : valeur strong trouvée au niveau {level} sur {url} : {value[:120]}"
                )
                return value

        if current is not icon_node:
            cleaned = clean_text(safe_text(current))

            if cleaned:
                if first_text is None:
                    first_text = cleaned

                attributes = getattr(current, "attributes", None) or {}
                css_class = str(attributes.get("class", ""))

                if any(hint in css_class for hint in STAT_ITEM_CLASS_HINTS):
                    logger.debug(
                        f"{field_name} : texte proche trouvé au niveau {level} sur {url} : {cleaned[:120]}"
                    )
                    return cleaned

        try:
            current = current.parent
        except Exception:
            break

    if first_text:
        logger.debug(
            f"{field_name} : texte fallback retourné sur {url} : {first_text[:120]}"
        )
        return first_text

    if log_if_missing:
        logger.warning(f"{field_name} : aucun texte proche de l'icône sur {url}.")

    return None


def extract_stat_value_from_roots(
    roots: tuple[Any, ...] | list[Any],
    icon_selectors: tuple[str, ...] | list[str],
    field_name: str,
    url: str,
) -> Optional[str]:
    """
    Essaie plusieurs racines de recherche pour une statistique.
    """
    for root in roots:
        if root is None:
            continue

        value = extract_stat_value(
            container=root,
            icon_selectors=icon_selectors,
            field_name=field_name,
            url=url,
            log_if_missing=False,
        )

        if value:
            return value

    logger.warning(
        f"{field_name} : icône/texte introuvable dans les conteneurs testés sur {url}."
    )
    return None


def make_iso_date(year: str, month: str, day: str) -> Optional[str]:
    """
    Convertit une date en ISO si elle est valide.
    """
    try:
        return datetime(int(year), int(month), int(day)).date().isoformat()
    except (ValueError, TypeError):
        return None


def parse_date_to_iso(date_str: Optional[str]) -> Optional[str]:
    """
    Convertit plusieurs formats de date en ISO YYYY-MM-DD.

    Gère :
    - 2026-08-06
    - 06/08/2026
    - 06.08.2026
    - 06-08-2026
    - Publiée le 6 août 2026
    - 6 août 2026
    - 1er août 2026
    """
    if not date_str:
        return None

    cleaned = clean_text(date_str)

    if not cleaned:
        return None

    # ISO déjà présent : 2026-08-06
    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", cleaned)
    if match:
        iso = make_iso_date(*match.groups())
        if iso:
            return iso

    # Format numérique FR : 06/08/2026, 06.08.2026, 06-08-2026
    match = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", cleaned)
    if match:
        day, month, year = match.groups()
        iso = make_iso_date(year, month, day)
        if iso:
            return iso

    # Format texte FR : 6 août 2026, Publiée le 6 août 2026, 1er août 2026
    normalized = remove_accents(cleaned).lower()

    normalized = re.sub(
        r"^(poste|publiee?|mis en ligne|date de publication|publication|date de creation|creation|date limite|expires?)\s*(le|:)?\s*",
        "",
        normalized,
    )

    match = re.search(
        r"(\d{1,2})(?:er)?\s+([a-z]+)\.?\s+(\d{4})",
        normalized,
    )

    if match:
        day, month_text, year = match.groups()

        month_key = month_text[:3]
        month_text = MONTH_ALIASES.get(month_key, month_text)
        month = MOIS_FR.get(month_text)

        if month:
            iso = make_iso_date(year, month, day)
            if iso:
                return iso

    logger.debug(f"Date non parsable : '{date_str}' -> valeur nettoyée : '{cleaned}'.")
    return cleaned


# =============================================================================
# EXTRACTION DES CHAMPS PRINCIPAUX
# =============================================================================

def extract_title(content: Any, html: HTMLParser, url: str) -> Optional[str]:
    """
    Extrait le titre du poste avec plusieurs fallbacks.
    """
    node = find_first_node(content, TITLE_SELECTORS) or find_first_node(html, TITLE_SELECTORS)

    if node:
        title = clean_text(safe_text(node))
        if title:
            return title

    meta_title = extract_meta_content(
        html,
        (
            'meta[property="og:title"]',
            'meta[name="twitter:title"]',
        ),
    )

    if meta_title:
        return meta_title

    title_node = html.css_first("title")
    title = clean_text(safe_text(title_node))

    if title:
        return title

    logger.warning(f"Titre du poste introuvable sur {url}.")
    return None


def extract_description(content: Any, html: HTMLParser, url: str) -> Optional[str]:
    """
    Extrait la description du poste avec plusieurs fallbacks.
    """
    node = find_first_node(content, DESCRIPTION_SELECTORS) or find_first_node(
        html,
        DESCRIPTION_SELECTORS,
    )

    if node:
        description = clean_text(safe_text(node))

        if description and len(description) > 20:
            return description

    meta_description = extract_meta_content(
        html,
        (
            'meta[property="og:description"]',
            'meta[name="description"]',
        ),
    )

    if meta_description:
        return meta_description

    logger.warning(f"Description du poste introuvable ou trop courte sur {url}.")
    return None


def extract_apply_link(content: Any, html: HTMLParser, url: str) -> Optional[str]:
    """
    Extrait le lien pour postuler.
    """
    for root in (content, html):
        node = find_first_node(root, APPLY_LINK_SELECTORS)

        if node:
            attributes = getattr(node, "attributes", None) or {}
            href = attributes.get("href")
            normalized = normalize_url(href)

            if normalized:
                return normalized

    logger.warning(f"Lien de postulation introuvable sur {url}.")
    return None


def extract_published_date(content: Any, html: HTMLParser, url: str) -> Optional[str]:
    """
    Extrait la date de publication.
    """
    for root in (content, html):
        node = find_first_node(root, PUBLISHED_DATE_SELECTORS)

        if node:
            raw = clean_text(safe_text(node))

            if raw:
                raw = re.sub(
                    r"^publi[ée]e?\s+le\s*",
                    "",
                    raw,
                    flags=re.IGNORECASE,
                )

                raw = re.sub(
                    r"^date de publication\s*:?\s*",
                    "",
                    raw,
                    flags=re.IGNORECASE,
                )

                return clean_text(raw)

    meta_date = extract_meta_content(
        html,
        (
            'meta[property="article:published_time"]',
            'meta[property="og:article:published_time"]',
            'meta[name="publish-date"]',
            'meta[name="date"]',
        ),
    )

    if meta_date:
        return meta_date

    logger.warning(f"Date de publication introuvable sur {url}.")
    return None


# =============================================================================
# EXTRACTION ENTREPRISE
# =============================================================================

def get_data_company(
    html: HTMLParser,
    url: str,
    secteur_label: Optional[str] = None,
) -> dict[str, Any]:
    """
    Extrait les informations de l'entreprise.
    """
    company: dict[str, Any] = {
        "website_url": None,
        "name": None,
        "type": secteur_label,
        "description": None,
    }

    try:
        container = find_first_node(html, COMPANY_CONTAINER_SELECTORS) or html

        name_node = find_first_node(container, COMPANY_NAME_SELECTORS)

        if name_node:
            company["name"] = clean_text(safe_text(name_node))
        else:
            logger.warning(f"Nom de l'entreprise non trouvé sur {url}.")

        link_node = find_first_node(container, COMPANY_LINK_SELECTORS)

        if link_node is None and name_node is not None:
            if getattr(name_node, "tag", "") == "a":
                link_node = name_node

        if link_node:
            attributes = getattr(link_node, "attributes", None) or {}
            company["website_url"] = normalize_url(attributes.get("href"))
        else:
            logger.debug(f"URL de l'entreprise non trouvée sur {url}.")

        desc_node = find_first_node(container, COMPANY_DESC_SELECTORS)

        if desc_node:
            company["description"] = clean_text(safe_text(desc_node))
        else:
            logger.debug(f"Description de l'entreprise non trouvée sur {url}.")

    except Exception as exc:
        logger.opt(exception=True).error(
            f"Erreur lors de l'extraction des données de l'entreprise sur {url} : {exc}"
        )

    return company


# =============================================================================
# EXTRACTION D'UN POSTE
# =============================================================================

def get_data_job(html: HTMLParser, url: str) -> dict[str, Any]:
    """
    Extrait les données d'une page de poste.
    """
    logger.info(f"Début de l'extraction des données sur {url}.")

    job: dict[str, Any] = {
        "source_url": url,
        "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    try:
        content = find_first_node(html, JOB_BODY_SELECTORS) or html
        roots = (content, html)

        # Titre
        job["title"] = extract_title(content, html, url)

        # Type de contrat
        contract_label = extract_first_text_from_selectors(
            roots,
            CONTRACT_TYPE_SELECTORS,
            "contract_type",
            url,
        )

        job["contract_type"] = {
            "code": make_code(contract_label),
            "label": contract_label,
        }

        # Statistiques
        stats_container = find_first_node(content, STATS_CONTAINER_SELECTORS) or find_first_node(
            html,
            STATS_CONTAINER_SELECTORS,
        )

        stat_roots = (stats_container, content, html)

        # Secteur
        secteur_label = extract_stat_value_from_roots(
            stat_roots,
            SECTEUR_ICON_SELECTORS,
            "secteur",
            url,
        )

        job["secteur"] = {
            "code": make_code(secteur_label),
            "label": secteur_label,
        }

        # Localisation
        location_raw = extract_stat_value_from_roots(
            stat_roots,
            LOCATION_ICON_SELECTORS,
            "location",
            url,
        )

        job["location_raw"] = location_raw
        job["location"] = {
            "country_code": COUNTRY_CODE,
            "label": location_raw,
        }

        # Niveau / expérience
        education_label = extract_stat_value_from_roots(
            stat_roots,
            EDUCATION_ICON_SELECTORS,
            "niveau",
            url,
        )

        job["experience_level"] = education_label
        job["education_level"] = {
            "code": make_code(education_label),
            "label": education_label,
        }

        # Date limite
        expires_raw = extract_stat_value_from_roots(
            stat_roots,
            EXPIRES_ICON_SELECTORS,
            "date limite",
            url,
        )

        job["expires_at"] = parse_date_to_iso(expires_raw)

        # Date de publication
        published_raw = extract_published_date(content, html, url)
        job["published_at"] = parse_date_to_iso(published_raw)
        job["active"] = job.get("published_at") or published_raw

        # Description
        description = extract_description(content, html, url)
        job["detail"] = {
            "source_text": description,
        }

        # Lien pour postuler
        job["postule_link"] = extract_apply_link(content, html, url)

        # Entreprise
        job["company"] = get_data_company(html, url, secteur_label)

        useful_fields = (
            job.get("title"),
            description,
            location_raw,
            contract_label,
        )

        if not any(useful_fields):
            logger.warning(f"Aucun champ réellement utile trouvé sur {url}.")

        return job

    except Exception as exc:
        logger.opt(exception=True).error(
            f"Erreur globale lors de l'extraction des données sur {url} : {exc}"
        )
        return job


# =============================================================================
# TRAITEMENT DES LIENS DE POSTES
# =============================================================================

def scrape_job_links(page: Page, links: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Parcourt chaque lien de poste et extrait les données.
    """
    jobs: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    total = len(links)

    for index, link in enumerate(links, start=1):
        logger.info(f"[{index}/{total}] Traitement du poste : {link}")

        try:
            if not goto_safe(page, link):
                failures.append(
                    {
                        "url": link,
                        "erreur": "Navigation impossible ou page non chargée.",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                continue

            human_wait(page, 2.0, 5.0)

            html = build_html_parser(page)

            if html is None:
                failures.append(
                    {
                        "url": link,
                        "erreur": "HTML de la page inaccessible.",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                continue

            job = get_data_job(html, link)

            detail = job.get("detail") or {}

            if job and (job.get("title") or detail.get("source_text")):
                jobs.append(job)
                save_json(jobs, OUTPUT_FILE, "Données des jobs Educ")
                logger.info(f"[{index}/{total}] Données extraites avec succès pour {link}.")
            else:
                failures.append(
                    {
                        "url": link,
                        "erreur": "Aucune donnée pertinente trouvée.",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                logger.warning(f"[{index}/{total}] Aucune donnée pertinente pour {link}.")

        except Exception as exc:
            logger.opt(exception=True).error(
                f"[{index}/{total}] Erreur inattendue pendant l'extraction de {link} : {exc}"
            )

            failures.append(
                {
                    "url": link,
                    "erreur": str(exc),
                    "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                }
            )

        finally:
            human_wait(page, 1.0, 3.0)

    return jobs, failures


# =============================================================================
# FONCTION PRINCIPALE
# =============================================================================

def main() -> int:
    setup_logger()

    logger.info("Démarrage du scraper Educ.")
    logger.info(
        f"Configuration : BASE_URL={BASE_URL} | "
        f"MAX_PAGES={MAX_PAGES} | MAX_JOBS={MAX_JOBS} | HEADLESS={HEADLESS}"
    )

    if not BASE_URL.startswith(("http://", "https://")):
        logger.critical(f"BASE_URL invalide : '{BASE_URL}'.")
        return 2

    jobs: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    exit_code = 0

    try:
        with sync_playwright() as p:
            browser = None
            context = None
            page = None

            try:
                browser = launch_browser(p)
                context = create_context(browser)
                page = context.new_page()

                if not goto_safe(page, BASE_URL):
                    logger.critical(f"Impossible de charger la page de base : {BASE_URL}")
                    exit_code = 1
                else:
                    human_wait(page, 1.0, 3.0)

                    links = collect_all_job_links(page)

                    if not links:
                        logger.warning("Aucun lien de poste n'a pu être collecté.")

                    if MAX_JOBS > 0:
                        logger.info(f"Limitation du traitement à {MAX_JOBS} lien(s).")
                        links = links[:MAX_JOBS]

                    jobs, failures = scrape_job_links(page, links)

            except KeyboardInterrupt:
                logger.warning("Interruption manuelle du script. Sauvegarde des données partielles.")
                exit_code = 130

            except Exception as exc:
                logger.opt(exception=True).critical(f"Erreur globale pendant le scraping : {exc}")
                exit_code = 1

            finally:
                save_json(jobs, OUTPUT_FILE, "Données des jobs Educ")
                save_json(failures, FAILED_FILE, "Échecs de scraping Educ")

                if jobs:
                    try:
                        maybe_send_jobs_to_api("educarriere", jobs, run_reference="educarriere:script", logger=logger)
                    except Exception as exc:
                        logger.opt(exception=True).error(f"Envoi API impossible pour Educarriere : {exc}")
                        if exit_code == 0:
                            exit_code = 1

                close_safely(page, "page")
                close_safely(context, "contexte")
                close_safely(browser, "navigateur")

    except Exception as exc:
        logger.opt(exception=True).critical(f"Impossible d'initialiser Playwright : {exc}")
        return 1

    logger.info(
        f"Scraping terminé. Succès : {len(jobs)} | Échecs : {len(failures)}."
    )

    if failures and not jobs and exit_code == 0:
        exit_code = 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
