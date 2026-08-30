import adminApi, { tokenStorage } from "./adminAxios"
import { INITIAL_ADMINS } from "./mockData"

/**
 * API d'authentification admin (S3).
 * POST /auth/login → stocke les 2 tokens · GET /auth/me · POST /auth/logout.
 * En mode démo (backend absent), bascule sur les comptes factices.
 */

const DEMO_DELAY = 250

const demoLogin = async ({ email }) => {
  await new Promise((r) => setTimeout(r, DEMO_DELAY))
  const found = INITIAL_ADMINS.find((a) => a.email.toLowerCase() === email?.trim().toLowerCase())
  const account =
    found || { ...INITIAL_ADMINS[0], email: email || INITIAL_ADMINS[0].email, full_name: email?.split("@")[0] || "Admin" }
  const accessToken = `mock-access-${account.role}-${Date.now()}`
  const refreshToken = `mock-refresh-${account.role}-${Date.now()}`
  tokenStorage.save({ access_token: accessToken, refresh_token: refreshToken })
  localStorage.setItem("admin_current_user", JSON.stringify(account))
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    admin_id: account.id,
    role: account.role,
    _demo: true,
  }
}

/**
 * Connexion. Lève une erreur typée : status 401 = identifiants invalides,
 * 403 = compte inactif. Retourne le couple de tokens.
 */
export const loginAdmin = async ({ email, password }) => {
  try {
    const { data } = await adminApi.post("/auth/login", { email, password })
    tokenStorage.save(data)
    return data
  } catch (error) {
    if (error?.response) {
      // Vrai refus du backend : on ne bascule pas en mode démo
      error.isInvalidCredentials = error.response.status === 401
      error.isInactiveAccount = error.response.status === 403
      throw error
    }
    // Backend injoignable → mode démo
    return demoLogin({ email })
  }
}

/** Profil de l'admin connecté (GET /auth/me). */
export const getAdminProfile = async () => {
  try {
    const { data } = await adminApi.get("/auth/me")
    return data
  } catch (error) {
    if (error?.response) throw error
    const saved = localStorage.getItem("admin_current_user")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        /* ignore */
      }
    }
    if (tokenStorage.access) return INITIAL_ADMINS[0]
    throw error
  }
}

/** Déconnexion : invalide côté API puis purge du storage local. */
export const logoutAdmin = async () => {
  try {
    await adminApi.post("/auth/logout")
  } catch {
    /* la déconnexion est avant tout locale (JWT sans état) */
  } finally {
    tokenStorage.clear()
  }
}

/** Changement de mot de passe du compte courant. */
export const changeAdminPassword = async ({ currentPassword, newPassword }) => {
  const { data } = await adminApi.put("/auth/me/password", {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return data
}
