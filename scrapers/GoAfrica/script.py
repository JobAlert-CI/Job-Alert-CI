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

from extract_offer import parse_job_html_go

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

BASE_URL = os.getenv("GO_BASE_URL", "https://www.goafricaonline.com/").strip()
SEARCH_QUERY = os.getenv("GO_SEARCH_QUERY", "cote").strip()

OUTPUT_FILE = Path(os.getenv("GO_OUTPUT_FILE", "../donnees_jobs_Go.json"))
FAILED_FILE = Path(os.getenv("GO_FAILED_FILE", "../failed_jobs_Go.json"))
LOG_FILE = Path(os.getenv("GO_LOG_FILE", "../logsGo.log"))

HEADLESS = os.getenv("GO_HEADLESS", "1").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

try:
    MAX_PAGES = max(1, int(os.getenv("GO_MAX_PAGES", "20")))
except ValueError:
    MAX_PAGES = 20

try:
    MAX_JOBS = max(0, int(os.getenv("GO_MAX_JOBS", "0")))
except ValueError:
    MAX_JOBS = 0

# =============================================================================
# FILTRE DE FRAÎCHEUR DES OFFRES (GoAfricaOnline)
# =============================================================================

try:
    MAX_DAYS_OLD = int(os.getenv("SCRAPER_MAX_DAYS_OLD", "1"))
except ValueError:
    MAX_DAYS_OLD = 1

# Pas de date d'expiration sur les cartes GoAfricaOnline
CHECK_EXPIRATION = False

# Sélecteurs pour les cartes GoAfricaOnline
CARD_SELECTORS = (
    "div.grid.grid-header",
    "div.grid-header",
    "div[class*='grid-header']",
)

CARD_LINK_SELECTORS = (
    "a.stretched-link",
    "a.font-bold",
    "a[grid-area='title']",
    "a",
)

# L'icône clock est à l'intérieur d'un div qui contient la date
PUBLISHED_DATE_ICON_SELECTORS = (
    "i.tnp.tnp-clock",
    "i[class*='tnp-clock']",
    "i[class*='clock']",
)

MOIS_FR_CARD = {
    "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4,
    "mai": 5, "juin": 6, "juillet": 7, "août": 8, "aout": 8,
    "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12
}

try:
    NAVIGATION_TIMEOUT_MS = int(os.getenv("GO_NAV_TIMEOUT_MS", "45000"))
except ValueError:
    NAVIGATION_TIMEOUT_MS = 45000

try:
    ACTION_TIMEOUT_MS = int(os.getenv("GO_ACTION_TIMEOUT_MS", "8000"))
except ValueError:
    ACTION_TIMEOUT_MS = 8000

LOG_LEVEL = os.getenv("GO_LOG_LEVEL", "INFO").strip().upper()
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

# =============================================================================
# FILTRE DE FRAÎCHEUR - GoAfricaOnline
# =============================================================================

def parse_card_date(text: Optional[str]) -> Optional[datetime]:
    """
    Parse une date au format "Posté le 13 août 2026" ou "13 août 2026".
    Retourne un datetime UTC ou None.
    """
    if not text:
        return None
    
    # Nettoyage
    cleaned = clean_text(text)
    if not cleaned:
        return None
    
    # Enlever le préfixe "Posté le "
    cleaned = re.sub(r"^post[ée]e?\s+le\s*", "", cleaned, flags=re.IGNORECASE).strip()
    
    # Format texte FR : "13 août 2026", "1er août 2026"
    normalized = remove_accents(cleaned).lower()
    
    # Pattern : jour (1 ou 2 chiffres, optionnel "er"), mois (lettres), année
    match = re.search(r"(\d{1,2})(?:er)?\s+([a-zûé]+)\s+(\d{4})", normalized)
    if match:
        jour = int(match.group(1))
        mois_texte = match.group(2)
        annee = int(match.group(3))
        
        if mois_texte not in MOIS_FR_CARD:
            logger.debug(f"Mois inconnu : '{mois_texte}' dans '{text}'")
            return None
        
        mois_chiffre = MOIS_FR_CARD[mois_texte]
        
        try:
            return datetime(annee, mois_chiffre, jour, tzinfo=timezone.utc)
        except ValueError as exc:
            logger.debug(f"Date invalide : {jour}/{mois_chiffre}/{annee} <- '{text}' : {exc}")
            return None
    
    # Format numérique FR : 13/08/2026
    match = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", cleaned)
    if match:
        day, month, year = match.groups()
        try:
            return datetime(int(year), int(month), int(day), tzinfo=timezone.utc)
        except ValueError:
            return None
    
    logger.debug(f"Format de date non reconnu : '{text}'")
    return None


def extract_card_published_date(card: Any) -> Optional[datetime]:
    """
    Extrait la date de publication depuis une carte GoAfricaOnline.
    
    HTML typique :
        <div class="flex ... [grid-area:date]">
            <i class="tnp tnp-clock"></i> Posté le 13 août 2026
        </div>
    
    Stratégie : trouver l'icône i.tnp.tnp-clock, puis prendre le texte du parent.
    """
    for icon_selector in PUBLISHED_DATE_ICON_SELECTORS:
        try:
            icon_node = card.css_first(icon_selector)
            if icon_node is None:
                continue
            
            # Remonter au parent pour récupérer le texte complet
            parent = icon_node.parent
            if parent is None:
                continue
            
            text = clean_text(safe_text(parent))
            if not text:
                continue
            
            dt = parse_card_date(text)
            if dt:
                logger.debug(f"Date de publication extraite : {dt.date()} <- '{text}'")
                return dt
        except Exception as exc:
            logger.debug(f"Erreur extraction date avec icône '{icon_selector}' : {exc}")
    
    # Fallback : chercher directement dans le texte de la carte
    try:
        card_text = clean_text(safe_text(card))
        if card_text:
            match = re.search(
                r"post[ée]e?\s+le\s+(\d{1,2}(?:er)?\s+[a-zûé]+\s+\d{4})",
                card_text,
                re.IGNORECASE,
            )
            if match:
                dt = parse_card_date(match.group(1))
                if dt:
                    logger.debug(f"Date de publication extraite via fallback : {dt.date()}")
                    return dt
    except Exception as exc:
        logger.debug(f"Erreur extraction date via fallback : {exc}")
    
    logger.debug("Date de publication non trouvée sur cette carte.")
    return None


def is_offer_fresh(
    card: Any,
    url: str,
    reference_date: Optional[datetime] = None,
) -> tuple[bool, str]:
    """
    Vérifie si une offre est fraîche (publiée récemment).
    Sur GoAfricaOnline, pas de date d'expiration sur les cartes.
    
    Retourne un tuple (is_valid, reason).
    """
    now = reference_date or datetime.now(timezone.utc)
    today_date = now.date()
    
    logger.debug(f"[{url}] Vérification de fraîcheur (date de référence : {today_date})")
    
    published_dt = extract_card_published_date(card)
    
    if published_dt is None:
        logger.debug(f"[{url}] Date de publication introuvable, offre acceptée par défaut.")
        return True, "date non détectée, offre acceptée"
    
    days_old = (today_date - published_dt.date()).days
    logger.debug(f"[{url}] Offre publiée il y a {days_old} jour(s) (le {published_dt.date()})")
    
    # Si MAX_DAYS_OLD < 0, on désactive le filtre de fraîcheur
    if MAX_DAYS_OLD >= 0 and days_old > MAX_DAYS_OLD:
        reason = f"offre trop ancienne (publiée il y a {days_old} jour(s), le {published_dt.date()})"
        return False, reason
    
    if days_old < 0:
        logger.debug(f"[{url}] Date de publication dans le futur ({published_dt.date()}), offre acceptée.")
    
    return True, f"publiée le {published_dt.date()}"


def extract_links_from_current_page(page: Page) -> tuple[list[str], list[str], bool]:
    """
    Extrait les liens de la page courante avec filtrage de fraîcheur.
    
    Retourne un tuple :
      - fresh_links : offres fraîches (récentes)
      - fallback_links : tous les liens valides (pour le fallback si aucune offre fraîche)
      - stop_signal : True si une offre non fraîche a été rencontrée
                      (signale qu'il faut arrêter la pagination)
    """
    html = build_html_parser(page)
    
    if html is None:
        return [], [], False
    
    fresh_links: list[str] = []
    fallback_links: list[str] = []
    seen_local: set[str] = set()
    stop_signal = False
    
    stats = {
        "total_cards": 0,
        "fresh": 0,
        "rejected_too_old": 0,
        "rejected_no_link": 0,
    }
    
    # Récupérer les cartes - essayer div.grid.grid-header d'abord
    cards = []
    for card_selector in CARD_SELECTORS:
        try:
            cards = html.css(card_selector)
            if cards:
                logger.debug(f"Cartes trouvées avec le sélecteur '{card_selector}' : {len(cards)}")
                break
        except Exception as exc:
            logger.debug(f"Sélecteur de carte invalide '{card_selector}' : {exc}")
            continue
    
    if not cards:
        logger.warning("Aucune carte d'offre trouvée sur cette page.")
        return [], [], False
    
    stats["total_cards"] = len(cards)
    
    # Parcourir chaque carte
    for card_index, card in enumerate(cards, start=1):
        # --- Extraction du lien ---
        href = None
        
        for link_selector in CARD_LINK_SELECTORS:
            try:
                a_tag = card.css_first(link_selector)
                if a_tag is None:
                    continue
                attributes = getattr(a_tag, "attributes", None) or {}
                href = attributes.get("href")
                if href:
                    break
            except Exception:
                continue
        
        url = normalize_url(href)
        if not url:
            stats["rejected_no_link"] += 1
            logger.debug(f"Carte {card_index} : lien invalide ou absent")
            continue
        
        # --- On ajoute TOUJOURS le lien au fallback ---
        if url not in seen_local:
            seen_local.add(url)
            fallback_links.append(url)
        
        # --- Vérification de fraîcheur ---
        is_valid, reason = is_offer_fresh(card, url)
        
        if not is_valid:
            stats["rejected_too_old"] += 1
            logger.info(f"🛑 Offre non fraîche [{url}] : {reason}")
            logger.info("   -> ARRÊT IMMÉDIAT de la collecte sur cette page")
            stop_signal = True
            break  # On arrête immédiatement la boucle sur les cartes
        
        # --- Offre fraîche : on l'ajoute ---
        if url not in fresh_links:
            fresh_links.append(url)
            stats["fresh"] += 1
            logger.info(f"✅ Offre fraîche acceptée [{url}] : {reason}")
    
    # Log récapitulatif
    logger.info(
        f"📊 Filtrage page terminé : "
        f"{stats['fresh']} fraîche(s) | "
        f"{stats['rejected_too_old']} trop ancienne(s) | "
        f"{stats['rejected_no_link']} sans lien "
        f"(sur {stats['total_cards']} carte(s) analysée(s))"
    )
    
    if stop_signal:
        logger.warning("🛑 SIGNAL D'ARRÊT ÉMIS : une offre non fraîche a été rencontrée.")
    
    return fresh_links, fallback_links, stop_signal


def collect_all_job_links(page: Page) -> list[str]:
    """
    Collecte les liens de postes sur plusieurs pages.
    
    Logique :
      - Si on rencontre une offre non fraîche → arrêt immédiat
      - Si à la fin on a au moins 1 offre fraîche → on les retourne
      - Si on a 0 offre fraîche → fallback sur les 10 premières offres (sans filtre)
    """
    fresh_links: list[str] = []
    all_fallback_links: list[str] = []
    seen_fresh: set[str] = set()
    seen_fallback: set[str] = set()
    
    current_page_number = 1
    max_pages = max(1, MAX_PAGES)
    
    logger.info(
        f"Filtre de fraîcheur actif : MAX_DAYS_OLD={MAX_DAYS_OLD} "
        f"(pas de vérification d'expiration sur GoAfricaOnline)"
    )
    
    while current_page_number <= max_pages:
        logger.info(f"Collecte des liens sur la page {current_page_number}.")
        
        wait_for_page_ready(page)
        auto_scroll(page)
        
        page_fresh, page_fallback, stop_signal = extract_links_from_current_page(page)
        
        # Ajoute les offres fraîches (dédupliquées)
        new_fresh = [link for link in page_fresh if link not in seen_fresh]
        if new_fresh:
            seen_fresh.update(new_fresh)
            fresh_links.extend(new_fresh)
        
        # Ajoute les offres de fallback (dédupliquées)
        new_fallback = [link for link in page_fallback if link not in seen_fallback]
        if new_fallback:
            seen_fallback.update(new_fallback)
            all_fallback_links.extend(new_fallback)
        
        logger.info(
            f"Page {current_page_number} : "
            f"{len(page_fresh)} fraîche(s), "
            f"{len(page_fallback)} totale(s), "
            f"total fraîches collectées : {len(fresh_links)}."
        )
        
        # --- Cas 1 : arrêt demandé (offre non fraîche rencontrée) ---
        if stop_signal:
            logger.info(
                "Arrêt de la pagination : une offre non fraîche a été rencontrée. "
                f"On conserve les {len(fresh_links)} offre(s) fraîche(s) déjà collectée(s)."
            )
            break
        
        # --- Cas 2 : aucune nouvelle offre fraîche et page > 1 ---
        if not new_fresh and current_page_number > 1:
            logger.info("Aucune nouvelle offre fraîche sur cette page. Arrêt de la pagination.")
            break
        
        # --- Cas 3 : nombre max de pages atteint ---
        if current_page_number >= max_pages:
            logger.info("Nombre maximum de pages atteint.")
            break
        
        # --- Pagination ---
        if not goto_next_page(page, current_page_number):
            logger.info("Fin de la pagination.")
            break
        
        current_page_number += 1
    
    # ============================================================
    # DÉCISION FINALE
    # ============================================================
    
    if fresh_links:
        logger.info(
            f"✅ Collecte terminée avec {len(fresh_links)} offre(s) fraîche(s)."
        )
        return fresh_links
    
    # Aucune offre fraîche → fallback
    fallback_count = min(10, len(all_fallback_links))
    logger.warning(
        f"⚠️ Aucune offre fraîche trouvée. "
        f"Fallback : récupération des {fallback_count} première(s) offre(s) "
        f"sans tenir compte de la date."
    )
    return all_fallback_links[:10]



# =============================================================================
# EXTRACTION DES DONNÉES D'UN POSTE
# =============================================================================

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


def get_data_job(html: HTMLParser, url: str) -> dict[str, Any]:
    """
    Extrait les données d'une page de poste en utilisant le parser unifié.
    """
    logger.info(f"Début de l'extraction des données sur {url} via extract_offer_Go.")
    
    job_data = parse_job_html_go(html, source_url=url)
    
    useful_fields = (
        job_data.get("title"),
        job_data.get("description"),
        job_data.get("location_raw"),
    )
    if not any(useful_fields):
        logger.warning(f"Aucun champ réellement utile trouvé sur {url}.")
        
    # 3. Couche d'adaptation (Adapter) pour la rétrocompatibilité
    # (Au cas où ton API ou la suite du script attend les anciennes clés)
        
    # Mapping du télétravail
    remote_raw = job_data.get("remote_work")
    if remote_raw:
        job_data["télétravail"] = remote_raw
        job_data["is_télétravail"] = is_true_teletravail(remote_raw)
        
    # Le statut "active" peut être déduit de la date de publication
    if not job_data.get("active"):
        job_data["active"] = job_data.get("published_at")

    return job_data

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
