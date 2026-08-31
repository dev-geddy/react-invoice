import type { DefaultSession } from "next-auth"

import type { Role } from "./permissions"

/** Expose `id` + `role` on the session/user/JWT. */
declare module "next-auth" {
  interface Session {
    user: { id: string; role?: Role } & DefaultSession["user"]
  }
  interface User {
    role?: Role
    tokenVersion?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: Role
    tokenVersion?: number
    /** Set when a revalidation finds the session no longer valid. */
    invalid?: boolean
  }
}
