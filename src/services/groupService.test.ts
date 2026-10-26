import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSupabaseClient } from "@/lib/supabase"
import { archiveGroup, getMyGroups } from "./groupService"

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(),
}))

const rpc = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupabaseClient).mockReturnValue({ rpc } as never)
})

describe("groupService", () => {
  it("maps archive timestamps to groups while preserving active groups", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [
          {
            group_id: "active-group",
            group_name: "Aktive Gruppe",
            sort_nr: 0,
            member_count: 2,
            current_user_is_admin: true,
          },
          {
            group_id: "archived-group",
            group_name: "Archivierte Gruppe",
            sort_nr: 1,
            member_count: 2,
            current_user_is_admin: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            group_id: "archived-group",
            archived_at: "2026-10-26T12:00:00.000Z",
          },
        ],
        error: null,
      })

    await expect(getMyGroups()).resolves.toEqual([
      {
        id: "active-group",
        name: "Aktive Gruppe",
        sortNr: 0,
        memberCount: 2,
        currentUserIsAdmin: true,
        archivedAt: null,
      },
      {
        id: "archived-group",
        name: "Archivierte Gruppe",
        sortNr: 1,
        memberCount: 2,
        currentUserIsAdmin: false,
        archivedAt: "2026-10-26T12:00:00.000Z",
      },
    ])
    expect(rpc).toHaveBeenNthCalledWith(1, "get_my_groups")
    expect(rpc).toHaveBeenNthCalledWith(2, "get_my_archived_groups")
  })

  it("archives a group through the authorization-checked database function", async () => {
    rpc.mockResolvedValueOnce({ error: null })

    await archiveGroup("group-1")

    expect(rpc).toHaveBeenCalledWith("archive_group", {
      p_group_id: "group-1",
    })
  })

  it("surfaces archive errors", async () => {
    rpc.mockResolvedValueOnce({ error: new Error("Not an admin") })

    await expect(archiveGroup("group-1")).rejects.toThrow("Not an admin")
  })
})
