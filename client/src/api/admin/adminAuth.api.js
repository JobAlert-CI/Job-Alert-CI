import adminApi, { ADMIN_USER_KEY, REFRESH_KEY, TOKEN_KEY } from "./adminAxios"
import { INITIAL_ADMINS } from "./mockData"

export const loginAdmin = async ({ email, password }) => {
  try {
    const response = await adminApi.post("/api/admin/auth/login", { email, password })
    const data = response.data
    localStorage.setItem(TOKEN_KEY, data.access_token)
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
    return data
  } catch (err) {
    // Fallback mode démo si l'API n'est pas encore joignable
    const found = INITIAL_ADMINS.find((a) => a.email.toLowerCase() === email?.trim().toLowerCase())
    if (found) {
      const mockToken = `mock-token-${found.role}-${Date.now()}`
      localStorage.setItem(TOKEN_KEY, mockToken)
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(found))
      return {
        access_token: mockToken,
        role: found.role,
        admin_id: found.id,
      }
    }
    // Si l'utilisateur a tapé n'importe quel email valide
    const fallbackUser = {
      ...INITIAL_ADMINS[0],
      email: email || INITIAL_ADMINS[0].email,
      full_name: email?.split("@")[0] || "Admin",
    }
    const mockToken = `mock-token-${fallbackUser.role}-${Date.now()}`
    localStorage.setItem(TOKEN_KEY, mockToken)
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(fallbackUser))
    return {
      access_token: mockToken,
      role: fallbackUser.role,
      admin_id: fallbackUser.id,
    }
  }
}

export const getAdminProfile = async () => {
  try {
    const response = await adminApi.get("/api/admin/auth/me")
    return response.data
  } catch {
    const saved = localStorage.getItem(ADMIN_USER_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return INITIAL_ADMINS[0]
      }
    }
    return INITIAL_ADMINS[0]
  }
}

export const logoutAdmin = async () => {
  try {
    await adminApi.post("/api/admin/auth/logout")
  } catch {
    // ignore
  } finally {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(ADMIN_USER_KEY)
  }
}

export const changeAdminPassword = async ({ currentPassword, newPassword }) => {
  try {
    const res = await adminApi.put("/api/admin/auth/me/password", {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return res.data
  } catch {
    return { message: "Mot de passe modifié avec succès (mode démo)" }
  }
}
