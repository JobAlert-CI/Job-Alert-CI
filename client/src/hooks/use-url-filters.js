import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"

/* ════════════════════════════════════════════════════════════════════
   FILTRES ↔ URL — la query string est la source de vérité.
   setScalar / setScalars matchent sur la CLÉ du scalaire (ex. "pageJobs"),
   jamais sur le nom du param URL (ex. "page_jobs").
════════════════════════════════════════════════════════════════════ */

const parseSet = (v) => new Set(v ? v.split(",").filter(Boolean) : [])
const serialSet = (s) => [...s].join(",")

const parseDate = (v) => {
  if (!v) return null
  const d = new Date(`${v}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const serialDate = (d) => {
  if (!d) return null
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const j = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${j}`
}

export const useUrlFilters = ({ sets = [], scalars = [], period = null }) => {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => {
    const f = {}
    sets.forEach(({ key, param }) => { f[key] = parseSet(searchParams.get(param)) })
    if (period) {
      f.period = {
        start: parseDate(searchParams.get(period.debut)),
        end: parseDate(searchParams.get(period.fin)),
      }
    }
    return f
  }, [searchParams, sets, period])

  const valeurs = useMemo(() => {
    const v = {}
    scalars.forEach(({ key, param, defaut = "" }) => { v[key] = searchParams.get(param) ?? defaut })
    return v
  }, [searchParams, scalars])

  const toggle = useCallback((key, value) => {
    const def = sets.find((s) => s.key === key)
    if (!def) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const current = parseSet(next.get(def.param))
      current.has(value) ? current.delete(value) : current.add(value)
      current.size ? next.set(def.param, serialSet(current)) : next.delete(def.param)
      return next
    }, { replace: true })
  }, [sets, setSearchParams])

  const setScalar = useCallback((key, value) => {
    const def = scalars.find((s) => s.key === key)
    if (!def) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      value && value !== def.defaut ? next.set(def.param, value) : next.delete(def.param)
      return next
    }, { replace: true })
  }, [scalars, setSearchParams])

  /* Écriture groupée : plusieurs scalaires en UNE seule écriture URL.
     Indispensable quand un setter touche 2 params (filtre + reset de page) :
     deux setSearchParams consécutifs ne se composent pas (le second écrase
     le premier), donc on applique tout dans la même mise à jour. */
  const setScalars = useCallback((changes) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(changes).forEach(([key, value]) => {
        const def = scalars.find((s) => s.key === key)
        if (!def) return
        value && value !== def.defaut ? next.set(def.param, value) : next.delete(def.param)
      })
      return next
    }, { replace: true })
  }, [scalars, setSearchParams])

  const setPeriod = useCallback((range) => {
    if (!period) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const debut = serialDate(range?.start)
      const fin = serialDate(range?.end)
      debut ? next.set(period.debut, debut) : next.delete(period.debut)
      fin ? next.set(period.fin, fin) : next.delete(period.fin)
      return next
    }, { replace: true })
  }, [period, setSearchParams])

  const reset = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      sets.forEach(({ param }) => next.delete(param))
      scalars.forEach(({ param }) => next.delete(param))
      if (period) { next.delete(period.debut); next.delete(period.fin) }
      return next
    }, { replace: true })
  }, [sets, scalars, period, setSearchParams])

  return { filters, valeurs, toggle, setScalar, setScalars, setPeriod, reset }
}