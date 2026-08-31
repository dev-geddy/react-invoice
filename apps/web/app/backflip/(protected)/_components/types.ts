import type { Role } from "@/app/_lib/auth/permissions"

export type SessionUser = {
  name: string
  email: string
  image: string | null
  role?: Role
}
