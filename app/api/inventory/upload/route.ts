import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"

// NOTE: Transition state.
// This route is now a manual rebuild trigger for the shared inventory view.
// It no longer parses the uploaded Excel or writes public/data/inventory_view.json.
// The uploaded file is accepted to preserve frontend compatibility but its contents are not consumed.
//
// Source of truth for inventory is the shared processed -> inventory pipeline:
//   data/processed/<source>/*.json -> services/inventory/build_inventory_view.py
//                                  -> data/processed/inventory/inventory_view.json
//
// True future import flow will come from processed dataset generation, not from this endpoint.

const execAsync = promisify(exec)

const REPO_ROOT = path.join(process.cwd(), "..", "..")
const BUILDER_SCRIPT = path.join("services", "inventory", "build_inventory_view.py")
const SHARED_VIEW_PATH = path.join(
  REPO_ROOT,
  "data",
  "processed",
  "inventory",
  "inventory_view.json"
)

const FAILURE_RESPONSE = {
  success: false,
  rebuilt: false,
  source: "shared_inventory_view",
  message: "Inventory view rebuild failed",
  count: 0,
}

export async function POST(req: Request) {
  // Accept form data to maintain frontend compatibility; file contents are not consumed.
  try {
    await req.formData()
  } catch {
    // file is optional - rebuild proceeds regardless
  }

  // Trigger shared inventory view rebuild.
  let stdout = ""
  let stderr = ""

  try {
    const result = await execAsync(`python ${BUILDER_SCRIPT}`, { cwd: REPO_ROOT })
    stdout = result.stdout
    stderr = result.stderr
  } catch (err: any) {
    const errorOutput = err.stderr || err.message || "unknown error"
    return NextResponse.json({
      ...FAILURE_RESPONSE,
      message: `Inventory view rebuild failed: ${errorOutput.trim()}`,
    })
  }

  // Read rebuilt view to compute count.
  let count = 0

  try {
    const file = fs.readFileSync(SHARED_VIEW_PATH, "utf-8")
    const data = JSON.parse(file)
    count = Array.isArray(data.inventory) ? data.inventory.length : 0
  } catch {
    // rebuild ran but view is unreadable - still report success with count 0
  }

  const summary = stdout.trim().split("\n").pop() || "Rebuild complete"

  return NextResponse.json({
    success: true,
    rebuilt: true,
    source: "shared_inventory_view",
    message: summary,
    count,
  })
}
