import fs from "fs"
import { portalDataPath } from "@/lib/sharedPortal"

// NOTE: Transition state.
// Export now reads from shared data/processed/inventory/inventory_view.json.
// Upload route still writes legacy public/data/inventory_view.json.
// Source of truth is the shared processed -> inventory pipeline, not the upload-generated local file.
// Upload migration is deferred to a later step.

interface InventoryEntry {
  standard_sku: string
  inventory: number
  status: string
}

const SHARED_VIEW_PATH = portalDataPath("processed", "inventory", "inventory_view.json")

const EMPTY_CSV = "sku,stock,status"

export async function GET() {
  let inventory: InventoryEntry[] = []

  try {
    const file = fs.readFileSync(SHARED_VIEW_PATH, "utf-8")
    const data = JSON.parse(file)
    inventory = Array.isArray(data.inventory) ? data.inventory : []
  } catch {
    return new Response(EMPTY_CSV, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=inventory.csv",
      },
    })
  }

  const csv = [
    EMPTY_CSV,
    ...inventory.map((i) => `${i.standard_sku},${i.inventory},${i.status}`),
  ].join("\n")

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=inventory.csv",
    },
  })
}
