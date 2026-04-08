import { NextResponse } from "next/server"
import fs from "fs"
import { portalDataPath } from "@/lib/sharedPortal"

// NOTE: Transition state.
// GET query now reads from shared data/processed/inventory/inventory_view.json.
// Upload and export routes still operate on the legacy customer-service local JSON flow.
// Full consolidation of all three routes is deferred to a later migration step.

interface InventoryEntry {
  standard_sku: string
  inventory: number
  status: string
}

const SHARED_VIEW_PATH = portalDataPath("processed", "inventory", "inventory_view.json")

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sku = searchParams.get("sku")

  if (!sku) {
    return NextResponse.json({ sku: "", stock: 0, status: "Not Found" })
  }

  let data: { inventory?: InventoryEntry[] } = {}

  try {
    const file = fs.readFileSync(SHARED_VIEW_PATH, "utf-8")
    data = JSON.parse(file)
  } catch {
    return NextResponse.json({ sku, stock: 0, status: "Not Found" })
  }

  const inventory = Array.isArray(data.inventory) ? data.inventory : []

  const match = inventory.find((item) => item.standard_sku === sku)

  if (!match) {
    return NextResponse.json({ sku, stock: 0, status: "Not Found" })
  }

  return NextResponse.json({
    sku: match.standard_sku,
    stock: match.inventory,
    status: match.status,
  })
}
