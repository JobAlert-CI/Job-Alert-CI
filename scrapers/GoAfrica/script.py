import json
import os
import random
import re
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import urljoin, urlparse, urlunparse

import unicodedata
from dotenv import load_dotenv
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
# CONFIGURATION GLOBALE
# =============================================================================

BASE_URL = os.getenv("SCRAPER_BASE_URL", "https://www.goafricaonline.com/").strip()
SEARCH_QUERY = os.getenv("SCRAPER_SEARCH_QUERY", "cote").strip()

OUTPUT_FILE = Path(os.getenv("SCRAPER_OUTPUT_FILE", "../donnees_jobs.json"))
FAILED_FILE = Path(os.getenv("SCRAPER_FAILED_FILE", "../failed_jobs.json"))
LOG_FILE = Path(os.getenv("SCRAPER_LOG_FILE", "../logsGo.log"))

HEADLESS = os.getenv("SCRAPER_HEADLESS", "1").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

try:
    MAX_PAGES = max(1, int(os.getenv("SCRAPER_MAX_PAGES", "20")))
except ValueError:
    MAX_PAGES = 20

try:
    MAX_JOBS = max(0, int(os.getenv("SCRAPER_MAX_JOBS", "0")))
except ValueError:
    MAX_JOBS = 0

try:
    NAVIGATION_TIMEOUT_MS = int(os.getenv("SCRAPER_NAV_TIMEOUT_MS", "45000"))
except ValueError:
    NAVIGATION_TIMEOUT_MS = 45000

try:
    ACTION_TIMEOUT_MS = int(os.getenv("SCRAPER_ACTION_TIMEOUT_MS", "8000"))
except ValueError:
    ACTION_TIMEOUT_MS = 8000

LOG_LEVEL = os.getenv("SCRAPER_LOG_LEVEL", "INFO").strip().upper()
if LOG_LEVEL not in {"TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"}:
    LOG_LEVEL = "INFO"

BLOCKED_RESOURCE_TYPES = {"image", "font"}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)

parsed_base = urlparse(BASE_URL)
ALLOWED_NETLOC = parsed_base.netloc.lower()
BASE_DOMAIN = ALLOWED_NETLOC.split(":")[0]
if BASE_DOMAIN.startswith("www."):
    BASE_DOMAIN = BASE_DOMAIN[4:]

SCRAPERS_ROOT = Path(__file__).resolve().parents[1]
if str(SCRAPERS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_ROOT))

from common.ingestion import maybe_send_jobs_to_api

# =============================================================================
# SÉLECTEURS / STRATÉGIES D'EXTRACTION
# =============================================================================

MAIN_CONTAINER_SELECTORS = (
    'div[class*="gap-[24px]"][class*="ls:gap-[12px]"]',
    "main",
    "article",
    'div[id*="job"]',
    'div[class*="job"]',
)

JOB_CONTENT_SELECTORS = (
    "div.grow.overflow-hidden",
    'div[class*="grow"]',
    "section",
)

COMPANY_CONTAINER_SELECTORS = (
    'div[class*="gap-[16px]"][class*="rounded-[8px]"]',
    'section[class*="company"]',
    'div[class*="company"]',
    'div[class*="entreprise"]',
    "aside",
)

COMPANY_LINK_SELECTORS = (
    "a.text-gray-800.font-bold",
    'a[class*="font-bold"]',
    'a[href*="entreprise"]',
    'a[href*="company"]',
)

COMPANY_TYPE_SELECTORS = (
    "div.font-normal.italic.text-gray-800",
    'div[class*="italic"]',
)

COMPANY_DESC_SELECTORS = (
    "div.font-normal.text-gray-650.line-clamp-10",
    'div[class*="line-clamp"]',
    "p",
)

LINK_SELECTOR_CONFIGS = (
    # (sélecteur, exige_mots_clés_dans_url)
    ("div.grid.grid-header a", False),
    ("div.grid a[href]", False),
    ("article a[href]", True),
    ("a[href*='emploi']", True),
    ("a[href*='job']", True),
    ("a[href*='offre']", True),
    ("a[href*='annonce']", True),
    ("a[href*='poste']", True),
)

JOB_URL_KEYWORDS = (
    "emploi",
    "job",
    "offre",
    "annonce",
    "poste",
    "recrutement",
    "career",
    "detail",
    "details",
)

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

BADGE_CLASS_HINTS = (
    "rounded-full",
    "items-center",
    "badge",
    "chip",
    "tag",
)


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
        # On évite de faire planter le script uniquement pour les logs.
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


def goto_emploi_section(page: Page) -> bool:
    """
    Essaie de cliquer sur le lien 'Emploi'.
    """
    candidates = [
        page.get_by_role("link", name="Emploi", exact=True),
        page.get_by_role("link", name=re.compile(r"Emploi", re.IGNORECASE)),
        page.locator('a:has-text("Emploi")'),
        page.locator('nav a:has-text("Emploi")'),
    ]

    for candidate in candidates:
        if safe_click_locator(candidate, "Lien 'Emploi'"):
            wait_for_page_ready(page)
            human_wait(page, 1.0, 3.0)
            logger.info("Navigation vers la section 'Emploi' réussie.")
            return True

    logger.warning(
        "Lien 'Emploi' introuvable ou non cliquable. "
        "Le script continue sur la page courante."
    )
    return False


def perform_location_search(page: Page, query: str) -> bool:
    """
    Remplit le champ de recherche localisation et valide.
    """
    if not query:
        logger.info("Aucune requête de localisation configurée, étape ignorée.")
        return True

    input_candidates = [
        page.get_by_role("combobox", name=re.compile(r"O[ùu]", re.IGNORECASE)),
        page.get_by_placeholder(re.compile(r"O[ùu]|localisation|ville", re.IGNORECASE)),
        page.locator(
            "input[name*='location'], "
            "input[id*='location'], "
            "input[name*='ville'], "
            "input[id*='ville']"
        ),
    ]

    filled = False

    for locator in input_candidates:
        try:
            if locator.count() == 0:
                continue

            first = locator.first

            if not first.is_visible():
                continue

            first.scroll_into_view_if_needed(timeout=ACTION_TIMEOUT_MS)
            first.click(timeout=ACTION_TIMEOUT_MS)
            first.fill(query, timeout=ACTION_TIMEOUT_MS)

            filled = True
            logger.info(f"Champ de localisation rempli avec '{query}'.")
            break
        except Exception as exc:
            logger.debug(f"Champ de localisation impossible à utiliser : {exc}")

    if not filled:
        logger.warning(
            "Champ de localisation introuvable ou non remplissable. "
            "Continuation sans filtre de localisation."
        )
        return False

    human_wait(page, 1.0, 2.0)

    option_candidates = [
        page.get_by_role("option", name=re.compile(re.escape(query), re.IGNORECASE)),
        page.get_by_role("option"),
        page.locator('[role="option"]'),
        page.locator("li.suggestion, ul.suggestions li"),
    ]

    for options in option_candidates:
        if safe_click_locator(options, "Suggestion de localisation", timeout_ms=5000):
            wait_for_page_ready(page)
            human_wait(page, 1.0, 3.0)
            logger.info("Suggestion de localisation sélectionnée.")
            return True

    try:
        page.keyboard.press("Enter")
        logger.info("Aucune suggestion cliquable. Validation par touche Entrée.")
        wait_for_page_ready(page)
        human_wait(page, 1.0, 3.0)
        return True
    except Exception as exc:
        logger.warning(f"Impossible de valider la recherche de localisation : {exc}")
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
        page.get_by_role("link", name=f"Page {next_number}", exact=True),
        page.get_by_role("button", name=f"Page {next_number}", exact=True),
        page.get_by_role("link", name=re.compile(r"suivant", re.IGNORECASE)),
        page.get_by_role("button", name=re.compile(r"suivant", re.IGNORECASE)),
        page.locator('a[aria-label*="suivant"], a[aria-label*="Suivant"]'),
        page.locator('button[aria-label*="suivant"], button[aria-label*="Suivant"]'),
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

    for selector, require_keyword in LINK_SELECTOR_CONFIGS:
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
# UTILITAIRES D'EXTRACTION DE DONNÉES
# =============================================================================

def iter_ancestors(node: Any, max_levels: int = 3):
    """
    Retourne le nœud puis ses parents, utile pour récupérer le texte autour d'une icône.
    """
    current = node

    for _ in range(max_levels):
        if current is None:
            break

        yield current

        try:
            current = current.parent
        except Exception:
            break


def extract_nearest_icon_text(
        container: Any,
        icon_selectors: tuple[str, ...] | list[str],
        field_name: str,
        url: str,
        max_levels: int = 4,
        log_if_missing: bool = True,
) -> Optional[str]:
    """
    Cherche une icône puis remonte seulement vers le premier texte pertinent.

    L'objectif est d'éviter de récupérer tout le conteneur parent contenant
    tous les badges.
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

    first_text: Optional[str] = None
    current = icon_node

    for level in range(max_levels):
        if current is None:
            break

        cleaned = clean_text(safe_text(current))

        if cleaned:
            if first_text is None:
                first_text = cleaned

            attributes = getattr(current, "attributes", None) or {}
            css_class = str(attributes.get("class", ""))

            # Si on est clairement sur un badge, on retourne immédiatement.
            if any(hint in css_class for hint in BADGE_CLASS_HINTS):
                logger.debug(
                    f"{field_name} : badge trouvé au niveau {level} sur {url} : {cleaned[:120]}"
                )
                return cleaned

        try:
            current = current.parent
        except Exception:
            break

    if first_text:
        logger.debug(
            f"{field_name} : texte le plus proche trouvé sur {url} : {first_text[:120]}"
        )
        return first_text

    if log_if_missing:
        logger.warning(f"{field_name} : aucun texte proche de l'icône sur {url}.")

    return None


def extract_icon_text_from_roots(
        roots: tuple[Any, ...] | list[Any],
        icon_selectors: tuple[str, ...] | list[str],
        field_name: str,
        url: str,
) -> Optional[str]:
    """
    Essaie plusieurs racines de recherche : content, main_container, html complet.
    """
    for root in roots:
        if root is None:
            continue

        value = extract_nearest_icon_text(
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


def extract_value_from_text(
        text: Optional[str],
        patterns: Optional[list[str]] = None,
        fallback: bool = True,
) -> Optional[str]:
    """
    Extrait une valeur à partir d'un texte en utilisant des patterns.
    Si aucun pattern ne matche, retourne le texte nettoyé si fallback=True.
    """
    cleaned = clean_text(text)

    if not cleaned:
        return None

    for pattern in patterns or []:
        try:
            match = re.search(pattern, cleaned, re.IGNORECASE)
            if match and match.group(1).strip():
                return match.group(1).strip()
        except re.error as exc:
            logger.error(f"Regex invalide '{pattern}' : {exc}")

    return cleaned if fallback else None


def extract_icon_value(
        container: Any,
        icon_selectors: tuple[str, ...] | list[str],
        field_name: str,
        url: str,
        patterns: Optional[list[str]] = None,
) -> Optional[str]:
    """
    Cherche une icône, puis extrait le texte autour.
    Si patterns est fourni, essaie d'extraire la valeur après un libellé.
    """
    if container is None:
        logger.warning(f"{field_name} : conteneur absent sur {url}.")
        return None

    icon_node = find_first_node(container, icon_selectors)

    if icon_node is None:
        logger.warning(
            f"{field_name} : icône introuvable sur {url}. "
            f"Sélecteurs testés : {', '.join(icon_selectors)}."
        )
        return None

    last_text: Optional[str] = None

    for ancestor in iter_ancestors(icon_node, max_levels=3):
        raw_text = safe_text(ancestor)
        cleaned = clean_text(raw_text)

        if not cleaned:
            continue

        last_text = cleaned

        if not patterns:
            return cleaned

        for pattern in patterns:
            try:
                match = re.search(pattern, cleaned, re.IGNORECASE)
                if match and match.group(1).strip():
                    return match.group(1).strip()
            except re.error as exc:
                logger.error(f"{field_name} : regex invalide '{pattern}' : {exc}")

    if patterns and last_text:
        truncated = last_text[:120] + ("..." if len(last_text) > 120 else "")
        logger.warning(
            f"{field_name} : pattern non trouvé sur {url}. "
            f"Retour du texte brut : '{truncated}'."
        )

    return last_text


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


def extract_title(content: Any, html: HTMLParser, url: str) -> Optional[str]:
    """
    Extrait le titre du poste avec plusieurs fallbacks.
    """
    title_selectors = (
        "div.text-gray-800.font-black",
        "h1",
        "[class*='title']",
        "[data-testid*='title']",
    )

    node = find_first_node(content, title_selectors) or find_first_node(html, title_selectors)

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
    description_selectors = (
        "div.font-normal.text-gray-700.overflow-wrap-anywhere",
        "div[class*='description']",
        "article",
        "main",
    )

    node = find_first_node(content, description_selectors) or find_first_node(
        html,
        description_selectors,
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
    - Posté le 6 août 2026
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

    # Format texte FR : 6 août 2026, Posté le 6 août 2026, 1er août 2026
    normalized = remove_accents(cleaned).lower()

    # Nettoyage des préfixes fréquents
    normalized = re.sub(
        r"^(poste|publie|mis en ligne|date de creation|creation)\s*(le|:)?\s*",
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


def is_true_teletravail(text: Optional[str]) -> bool:
    """
    Détermine si le télétravail est réel/complet.

    "Sans télétravail" doit retourner False.
    """
    if not text:
        return False

    normalized = remove_accents(text).lower()

    if re.search(r"\bsans\b", normalized):
        return False

    return bool(
        re.search(
            r"(complet|total|100\s*%|oui|full\s*remote)",
            normalized,
            re.IGNORECASE,
        )
    )


# =============================================================================
# EXTRACTION DES DONNÉES D'ENTREPRISE
# =============================================================================

def get_data_company(html: HTMLParser, url: str) -> dict[str, Any]:
    """
    Extrait les informations de l'entreprise.
    """
    company: dict[str, Any] = {
        "website_url": None,
        "name": None,
        "type": None,
        "description": None,
    }

    try:
        container = find_first_node(html, COMPANY_CONTAINER_SELECTORS) or html

        link_node = find_first_node(container, COMPANY_LINK_SELECTORS)

        if link_node:
            attributes = getattr(link_node, "attributes", None) or {}
            company["website_url"] = normalize_url(attributes.get("href"))
            company["name"] = clean_text(safe_text(link_node))
        else:
            logger.warning(f"Lien ou nom de l'entreprise non trouvé sur {url}.")

        type_node = find_first_node(container, COMPANY_TYPE_SELECTORS)

        if type_node:
            company["type"] = clean_text(safe_text(type_node))
        else:
            logger.warning(f"Type de l'entreprise non trouvé sur {url}.")

        desc_node = find_first_node(container, COMPANY_DESC_SELECTORS)

        if desc_node:
            company["description"] = clean_text(safe_text(desc_node))
        else:
            logger.warning(f"Description de l'entreprise non trouvée sur {url}.")

    except Exception as exc:
        logger.opt(exception=True).error(
            f"Erreur lors de l'extraction des données de l'entreprise sur {url} : {exc}"
        )

    return company


# =============================================================================
# EXTRACTION DES DONNÉES D'UN POSTE
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

    main_container = find_first_node(html, MAIN_CONTAINER_SELECTORS)

    if main_container is None:
        logger.error(
            f"Conteneur principal introuvable sur {url}. "
            "Bascule sur le document entier."
        )
        main_container = html

    content = find_first_node(main_container, JOB_CONTENT_SELECTORS) or main_container

    # Ordre de recherche pour les badges
    roots = (content, main_container, html)

    # Titre
    job["title"] = extract_title(content, html, url)

    # Type
    type_raw = extract_icon_text_from_roots(
        roots,
        (
            "i.tnp.tnp-file-signature",
            "i[class*='file-signature']",
            "i[class*='contract']",
        ),
        "type",
        url,
    )

    contract = extract_value_from_text(
        type_raw,
        [r"Type\s*:\s*(.+)"],
        fallback=True,
    )
    job["contract_type"] = {
        "code": contract.lower() if contract else contract,
        "label": contract
    }

    # Salaire
    salaire_raw = extract_icon_text_from_roots(
        roots,
        (
            "i.tnp.tnp-user-salary",
            "i[class*='file-user-salary']",
            "i[class*='salary']",
        ),
        "salary",
        url,
    )
    if salaire_raw:
        clean_text_salary = unicodedata.normalize("NFKD", salaire_raw)
        salaire_raw = re.sub(r"\s+", " ", clean_text_salary).strip()
    job["salary_raw"] = salaire_raw

    # Durée / Temps complet
    duree_raw = extract_icon_text_from_roots(
        roots,
        (
            "i.tnp.tnp-calendar",
            "i[class*='calendar']",
        ),
        "durée",
        url,
    )
    job["durée"] = extract_value_from_text(
        duree_raw,
        [r"Dur[ée]e\s*:\s*(.+)"],
        fallback=True,
    )

    # Télétravail
    teletravail_raw = extract_icon_text_from_roots(
        roots,
        (
            "i.tnp.tnp-house-laptop",
            "i[class*='house-laptop']",
            "i[class*='remote']",
        ),
        "télétravail",
        url,
    )
    job["télétravail"] = extract_value_from_text(
        teletravail_raw,
        [r"T[ée]l[ée]travail\s*:\s*(.+)"],
        fallback=True,
    )
    job["is_télétravail"] = is_true_teletravail(job["télétravail"])

    # Expérience
    job["experience_level"] = extract_icon_text_from_roots(
        roots,
        (
            "i.tnp.tnp-briefcase-1",
            "i[class*='briefcase']",
            "i[class*='experience']",
        ),
        "expérience",
        url,
    )

    # Niveau
    niveau_raw = extract_icon_text_from_roots(
        roots,
        (
            "i.tnp.tnp-diploma-outlined",
            "i[class*='diploma']",
            "i[class*='graduation']",
        ),
        "niveau",
        url,
    )
    education = extract_value_from_text(
        niveau_raw,
        [
            r"Niveau d['’]études\s*:\s*(.+)",
            r"Niveau\s*:\s*(.+)",
        ],
        fallback=True,
    )
    job["education_level"] = {
        "code": education.lower(),
        "label": education
    }

    # Langue
    langue_raw = extract_icon_text_from_roots(
        roots,
        (
            "i.tnp.tnp-comment-dots",
            "i[class*='comment']",
            "i[class*='language']",
        ),
        "langue",
        url,
    )
    job["langue"] = extract_value_from_text(
        langue_raw,
        [r"Langue\s*:\s*(.+)"],
        fallback=True,
    )

    # Adresse
    address_raw = extract_icon_text_from_roots(
        roots,
        ("address",),
        "adresse",
        url,
    )

    if not address_raw:
        address_raw = extract_icon_text_from_roots(
            roots,
            (
                "i.tnp.tnp-map-pin",
                "i[class*='map']",
            ),
            "adresse",
            url,
        )

    location = extract_value_from_text(
        address_raw,
        [
            r"Adresse du poste\s*:\s*(.+)",
            r"Adresse\s*:\s*(.+)",
        ],
        fallback=True,
    )
    job["location_raw"] = location
    job["location"] = {
        "country_code": "CI",
        "label": location
    }

    # Description
    job["detail"] = {
        "source_text": extract_description(content, html, url)
    }

    # Date de création / publication
    # On cherche en priorité dans main_container, puis dans tout le HTML.
    date_roots = (main_container, html, content)

    raw_date_created = extract_icon_text_from_roots(
        date_roots,
        (
            "i.tnp.tnp-clock",
            "i[class*='clock']",
        ),
        "date creation",
        url,
    )

    if not raw_date_created:
        raw_date_created = extract_meta_content(
            html,
            (
                'meta[property="article:published_time"]',
                'meta[property="og:article:published_time"]',
                'meta[name="publish-date"]',
                'meta[name="date"]',
            ),
        )

    job["published_at"] = parse_date_to_iso(raw_date_created)

    # Active
    # Avec le HTML fourni, il n'y a pas de badge dédié "active".
    # Le plus pertinent est donc d'utiliser la date de publication.
    # Si tu préfères null, remplace par : job["active"] = None
    job["active"] = job.get("published_at") or raw_date_created

    # Date échéance
    footer_container = find_first_node(
        main_container,
        (
            'div[class*="gap-[12px]"][class*="pt-[8px]"]',
            "footer",
        ),
    )

    date_echeance_node = find_first_node(
        footer_container or main_container,
        (
            "div.text-brand-blue.font-bold",
            'div[class*="echeance"]',
            'div[class*="deadline"]',
        ),
    )

    raw_date_echeance = (
        clean_text(safe_text(date_echeance_node))
        if date_echeance_node
        else None
    )

    job["expires_at"] = parse_date_to_iso(raw_date_echeance)

    # Entreprise
    job["company"] = get_data_company(html, url)

    useful_fields = (
        job.get("title"),
        job.get("detail"),
        job.get("location"),
        job.get("contract_type"),
    )

    if not any(useful_fields):
        logger.warning(f"Aucun champ réellement utile trouvé sur {url}.")

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

            if job and (job.get("title") or job.get("description")):
                jobs.append(job)
                save_json(jobs, OUTPUT_FILE, "Données des jobs")
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

    logger.info("Démarrage du scraper.")
    logger.info(
        f"Configuration : BASE_URL={BASE_URL} | SEARCH_QUERY={SEARCH_QUERY} | "
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

                    goto_emploi_section(page)
                    perform_location_search(page, SEARCH_QUERY)

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
                save_json(jobs, OUTPUT_FILE, "Données des jobs")
                save_json(failures, FAILED_FILE, "Échecs de scraping")

                if jobs:
                    try:
                        maybe_send_jobs_to_api("goafrica", jobs, run_reference="goafrica:script", logger=logger)
                    except Exception as exc:
                        logger.opt(exception=True).error(f"Envoi API impossible pour GoAfrica : {exc}")
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
