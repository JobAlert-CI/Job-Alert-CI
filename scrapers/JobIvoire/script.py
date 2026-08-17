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

# Chargement du .env
load_dotenv()

# Optionnel : playwright-stealth
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

# Import du parser d'offres
from extract_offer import parse_job_html

# =============================================================================
# CONFIGURATION - PRÉFIXE JIV_
# =============================================================================

BASE_URL = os.getenv("JIV_BASE_URL", "https://www.jobivoire.ci/job").strip()
OUTPUT_FILE = Path(os.getenv("JIV_OUTPUT_FILE", "donnees_jobs_jobivoire.json"))
FAILED_FILE = Path(os.getenv("JIV_FAILED_FILE", "failed_jobs_jobivoire.json"))
LOG_FILE = Path(os.getenv("JIV_LOG_FILE", "logsJobIvoire.log"))

HEADLESS = os.getenv("JIV_HEADLESS", "1").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

try:
    MAX_PAGES = max(1, int(os.getenv("JIV_MAX_PAGES", "20")))
except ValueError:
    MAX_PAGES = 20

try:
    MAX_JOBS = max(0, int(os.getenv("JIV_MAX_JOBS", "0")))
except ValueError:
    MAX_JOBS = 0

try:
    NAVIGATION_TIMEOUT_MS = int(os.getenv("JIV_NAV_TIMEOUT_MS", "45000"))
except ValueError:
    NAVIGATION_TIMEOUT_MS = 45000

try:
    ACTION_TIMEOUT_MS = int(os.getenv("JIV_ACTION_TIMEOUT_MS", "8000"))
except ValueError:
    ACTION_TIMEOUT_MS = 8000

LOG_LEVEL = os.getenv("JIV_LOG_LEVEL", "INFO").strip().upper()
if LOG_LEVEL not in {"TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"}:
    LOG_LEVEL = "INFO"

BLOCKED_RESOURCE_TYPES = {"image", "font"}

USER_AGENT = os.getenv(
    "USER_AGENT",
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
# SÉLECTEURS
# =============================================================================

JOB_CARD_SELECTORS = (
    "div.job-item.job-card.shadow-lite",
    "div.job-card",
    "div.job-item",
    "article.job-item",
)

JOB_LINK_SELECTORS = (
    "a.stretched-link",
    "a.job-link",
    "a[href]",
)

NEXT_PAGE_SELECTORS = (
    'a.page-link[aria-label="Suivant"]',
    'a[aria-label="Next"]',
    'a.next',
    'li.next a',
    'a:has-text("Suivant")',
)

JOB_URL_KEYWORDS = (
    "job",
    "offre",
    "emploi",
    "poste",
    "annonce",
    "recrutement",
    "detail",
)

# =============================================================================
# LOGGING
# =============================================================================

def setup_logger() -> None:
    """Configure les logs avec rotation et niveaux appropriés"""
    logger.remove()

    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        print(f"Impossible de créer le dossier de logs : {exc}", file=sys.stderr)

    # Fichier de logs détaillé
    logger.add(
        str(LOG_FILE),
        level="DEBUG",
        rotation="10 MB",
        retention="14 days",
        compression="zip",
        encoding="utf-8",
        backtrace=True,
        diagnose=False,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}"
    )

    # Console
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
    """Réessaie une fonction avec backoff exponentiel"""
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
    """Attend un délai aléatoire pour simuler un comportement humain"""
    delay = random.uniform(min_s, max_s)

    if page is None:
        time.sleep(delay)
        return

    try:
        page.wait_for_timeout(int(delay * 1000))
    except Exception as exc:
        logger.debug(f"human_wait via Playwright impossible, fallback time.sleep : {exc}")
        time.sleep(delay)


def normalize_url(href: Optional[str]) -> Optional[str]:
    """Transforme un lien relatif en lien absolu et supprime le fragment"""
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
    """Filtre les liens qui semblent être des pages de poste"""
    if not url:
        return False

    parsed = urlparse(url)
    netloc = parsed.netloc.lower().split(":")[0]

    if BASE_DOMAIN and netloc and not netloc.endswith(BASE_DOMAIN):
        return False

    path_and_query = f"{parsed.path} {parsed.query}".lower()
    return any(keyword in path_and_query for keyword in JOB_URL_KEYWORDS)


def save_json(data: Any, path: Path, description: str) -> None:
    """Sauvegarde JSON de manière atomique"""
    try:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        tmp_path = path.with_name(f"{path.name}.{os.getpid()}.tmp")

        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        shutil.move(str(tmp_path), str(path))

        count = len(data) if hasattr(data, "__len__") else "?"
        logger.success(f"{description} sauvegardé : {path} ({count} élément(s)).")
    except Exception as exc:
        logger.opt(exception=True).error(f"Échec de la sauvegarde JSON vers {path} : {exc}")


def close_safely(closeable: Any, name: str) -> None:
    """Ferme un objet Playwright sans lever d'exception"""
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
    """Bloque certaines ressources pour accélérer le scraping"""
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
    """Applique playwright-stealth si disponible"""
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
    """Lance le navigateur Chromium avec des options anti-détection"""
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
    """Crée un contexte navigateur avec timeouts et blocage de ressources"""
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
    """Charge une URL avec retry"""
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
    """Attend que la page soit suffisamment chargée"""
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
    """Clique sur un locator de manière sécurisée"""
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


def auto_scroll(page: Page, scrolls: int = 3) -> None:
    """Scrolle la page pour déclencher d'éventuels chargements paresseux"""
    try:
        for _ in range(scrolls):
            page.mouse.wheel(0, 1500)
            page.wait_for_timeout(300)

        page.evaluate("window.scrollTo(0, 0);")
    except Exception as exc:
        logger.debug(f"Scroll automatique impossible : {exc}")


def goto_next_page(page: Page, current_page_number: int) -> bool:
    """Essaie de naviguer vers la page suivante"""
    for selector in NEXT_PAGE_SELECTORS:
        try:
            locator = page.locator(selector)
            if safe_click_locator(locator, f"Pagination suivante (page {current_page_number + 1})"):
                wait_for_page_ready(page)
                human_wait(page, 1.5, 3.0)
                logger.info(f"Navigation vers la page {current_page_number + 1} réussie.")
                return True
        except Exception as exc:
            logger.debug(f"Sélecteur de pagination '{selector}' échoué : {exc}")

    logger.debug(f"Aucun bouton de pagination trouvé pour la page {current_page_number + 1}.")
    return False

# =============================================================================
# COLLECTE DES LIENS
# =============================================================================

def build_html_parser(page: Page) -> Optional[HTMLParser]:
    """Récupère le HTML de la page et construit un parser selectolax"""
    try:
        content = page.content()
        return HTMLParser(content)
    except Exception as exc:
        logger.opt(exception=True).error(f"Impossible de récupérer le HTML de la page : {exc}")
        return None


def extract_links_from_current_page(page: Page) -> list[str]:
    """Extrait les liens de la page courante"""
    html = build_html_parser(page)

    if html is None:
        return []

    links: list[str] = []
    seen_local: set[str] = set()

    for card_selector in JOB_CARD_SELECTORS:
        try:
            cards = html.css(card_selector)
        except Exception as exc:
            logger.debug(f"Sélecteur de carte invalide '{card_selector}' : {exc}")
            continue

        if not cards:
            continue

        found = 0

        for card in cards:
            for link_selector in JOB_LINK_SELECTORS:
                try:
                    a_tag = card.css_first(link_selector)
                except Exception:
                    continue

                if not a_tag:
                    continue

                try:
                    attributes = getattr(a_tag, "attributes", None) or {}
                    href = attributes.get("href")

                    url = normalize_url(href)
                    if not url:
                        continue

                    if url not in seen_local:
                        seen_local.add(url)
                        links.append(url)
                        found += 1
                        break  # Un lien par carte suffit
                except Exception as exc:
                    logger.debug(f"Erreur lors de l'extraction d'un lien : {exc}")

        if links:
            logger.debug(f"{found} lien(s) collectés avec le sélecteur '{card_selector}'.")
            break

    return links


def collect_all_job_links(page: Page) -> list[str]:
    """Collecte les liens de postes sur plusieurs pages"""
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
# TRAITEMENT DES OFFRES
# =============================================================================

def scrape_job_links(page: Page, links: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parcourt chaque lien de poste et extrait les données"""
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

            human_wait(page, 2.0, 4.0)

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

            # Parse l'offre avec extract_offer
            try:
                job = parse_job_html(html, link)
            except Exception as parse_exc:
                logger.opt(exception=True).error(
                    f"[{index}/{total}] Erreur lors du parsing de {link} : {parse_exc}"
                )
                failures.append(
                    {
                        "url": link,
                        "erreur": f"Erreur de parsing : {parse_exc}",
                        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    }
                )
                continue

            if job and (job.get("title") or job.get("description")):
                jobs.append(job)
                save_json(jobs, OUTPUT_FILE, "Données des jobs")
                logger.success(f"[{index}/{total}] Données extraites avec succès pour {link}.")
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
            human_wait(page, 1.0, 2.5)

    return jobs, failures

# =============================================================================
# FONCTION PRINCIPALE
# =============================================================================

def main() -> int:
    setup_logger()

    logger.info("=" * 80)
    logger.info("Démarrage du scraper JobIvoire")
    logger.info("=" * 80)
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
                    human_wait(page, 1.5, 3.0)

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
                        maybe_send_jobs_to_api("jobivoire", jobs, run_reference="jobivoire:script", logger=logger)
                    except Exception as exc:
                        logger.opt(exception=True).error(f"Envoi API impossible pour JobIvoire : {exc}")
                        if exit_code == 0:
                            exit_code = 1

                close_safely(page, "page")
                close_safely(context, "contexte")
                close_safely(browser, "navigateur")

    except Exception as exc:
        logger.opt(exception=True).critical(f"Impossible d'initialiser Playwright : {exc}")
        return 1

    logger.info("=" * 80)
    logger.info(
        f"Scraping terminé. Succès : {len(jobs)} | Échecs : {len(failures)}."
    )
    logger.info("=" * 80)

    if failures and not jobs and exit_code == 0:
        exit_code = 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
