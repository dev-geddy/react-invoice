import { describe, expect, it } from "vitest"

import {
  clampListUsersArgs,
  LIST_USERS_DEFAULT_LIMIT,
  LIST_USERS_MAX_LIMIT,
  LIST_USERS_MAX_OFFSET,
  resolveGetUserSelector,
} from "./users"

/**
 * Locks the `list_users` bounds/defaults and the `get_user` exactly-one-arg
 * rule (`L2-MCP-05`, `L2-MCP-06`, `L2-MCP-36`). Pure — no database.
 */
describe("clampListUsersArgs", () => {
  it("defaults limit and offset when omitted", () => {
    expect(clampListUsersArgs({})).toEqual({
      limit: LIST_USERS_DEFAULT_LIMIT,
      offset: 0,
      query: undefined,
    })
  })

  it("clamps an over-large limit down to the max", () => {
    expect(clampListUsersArgs({ limit: 10_000 })).toEqual({
      limit: LIST_USERS_MAX_LIMIT,
      offset: 0,
      query: undefined,
    })
  })

  it("clamps a non-positive limit up to 1", () => {
    expect(clampListUsersArgs({ limit: 0 }).limit).toBe(1)
    expect(clampListUsersArgs({ limit: -5 }).limit).toBe(1)
  })

  it("clamps a negative offset up to 0", () => {
    expect(clampListUsersArgs({ offset: -10 }).offset).toBe(0)
  })

  it("clamps an absurdly large offset down to the max instead of erroring in Postgres", () => {
    expect(clampListUsersArgs({ offset: 1e20 }).offset).toBe(
      LIST_USERS_MAX_OFFSET
    )
    expect(clampListUsersArgs({ offset: Number.MAX_SAFE_INTEGER }).offset).toBe(
      LIST_USERS_MAX_OFFSET
    )
  })

  it("passes a valid in-range limit/offset through unchanged", () => {
    expect(clampListUsersArgs({ limit: 50, offset: 20 })).toEqual({
      limit: 50,
      offset: 20,
      query: undefined,
    })
  })

  it("trims query and drops it when blank", () => {
    expect(clampListUsersArgs({ query: "  ann@example.com  " }).query).toBe(
      "ann@example.com"
    )
    expect(clampListUsersArgs({ query: "   " }).query).toBeUndefined()
  })
})

describe("resolveGetUserSelector", () => {
  it("resolves userId when only userId is given", () => {
    expect(resolveGetUserSelector({ userId: "u1" })).toEqual({
      kind: "userId",
      value: "u1",
    })
  })

  it("resolves email when only email is given", () => {
    expect(resolveGetUserSelector({ email: "a@example.com" })).toEqual({
      kind: "email",
      value: "a@example.com",
    })
  })

  it("errors when neither is given", () => {
    expect(resolveGetUserSelector({})).toEqual({
      error: "Provide exactly one of userId or email.",
    })
  })

  it("errors when both are given", () => {
    expect(
      resolveGetUserSelector({ userId: "u1", email: "a@example.com" })
    ).toEqual({ error: "Provide exactly one of userId or email." })
  })
})
