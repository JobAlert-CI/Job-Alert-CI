from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from api.deps import get_current_admin, get_db
from models import JobOffer, JobOfferStatus, Source, Subscriber, SubscriberStatus
from models.content import ContactMessage
from models.emails import EmailDigest
from models.enums import ContactMessageStatus, DigestStatus
from models.scraping import ScrapeRun
from schemas.admin import DashboardOverviewRead
from schemas.scraping import ScrapeRunRead

# Accessible a tous les roles admin: c'est le point d'entree du back-office.
router = APIRouter(prefix="/api/admin/dashboard", tags=["admin-dashboard"], dependencies=[Depends(get_current_admin)])


@router.get("/overview", response_model=DashboardOverviewRead)
async def get_dashboard_overview(db: Session = Depends(get_db)):
    """Vue d'ensemble : run du jour, abonnés actifs, offres collectées, taux d'échec."""
    offers_total = db.scalar(select(func.count(JobOffer.id))) or 0
    offers_active = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.status == JobOfferStatus.ACTIVE, JobOffer.deleted_at.is_(None))
    ) or 0
    
    subscribers_total = db.scalar(select(func.count(Subscriber.id))) or 0
    subscribers_active = db.scalar(
        select(func.count(Subscriber.id))
        .where(Subscriber.status == SubscriberStatus.ACTIVE)
    ) or 0
    
    contact_messages_new = db.scalar(
        select(func.count(ContactMessage.id))
        .where(ContactMessage.status == ContactMessageStatus.NEW)
    ) or 0
    
    sources_active = db.scalar(
        select(func.count(Source.id))
        .where(Source.status == "active")
    ) or 0
    
    last_scrape_run = db.scalar(
        select(ScrapeRun)
        .order_by(ScrapeRun.started_at.desc().nullslast())
        .limit(1)
    )
    last_scrape_run_at = last_scrape_run.started_at if last_scrape_run else None
    last_scrape_status = last_scrape_run.status.value if last_scrape_run and last_scrape_run.status else None
    
    pending_digests = db.scalar(
        select(func.count(EmailDigest.id))
        .where(EmailDigest.status == DigestStatus.QUEUED)
    ) or 0
    
    return DashboardOverviewRead(
        offers_total=offers_total,
        offers_active=offers_active,
        subscribers_total=subscribers_total,
        subscribers_active=subscribers_active,
        contact_messages_new=contact_messages_new,
        sources_active=sources_active,
        last_scrape_run_at=last_scrape_run_at,
        last_scrape_status=last_scrape_status,
        pending_digests=pending_digests
    )


@router.get("/runs", response_model=list[ScrapeRunRead])
async def list_runs(
    db: Session = Depends(get_db),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Historique des runs quotidiens."""
    stmt = (
        select(ScrapeRun)
        .order_by(ScrapeRun.run_date.desc(), ScrapeRun.started_at.desc().nullslast())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


@router.get("/runs/{run_id}", response_model=ScrapeRunRead)
async def get_run_detail(run_id: str, db: Session = Depends(get_db)):
    """Détail d'un run : stats, erreurs, logs associés."""
    run = db.scalar(
        select(ScrapeRun)
        .options(selectinload(ScrapeRun.source_runs))
        .where(ScrapeRun.id == run_id)
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable")
    return run