import { NextResponse } from "next/server"
import fs from "fs"
import { execFile } from "child_process"
import { promisify } from "util"
import { getPortalSystemRoot, getPythonBin, portalDataPath, portalPath } from "@/lib/sharedPortal"

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

const execFileAsync = promisify(execFile)

const PORTAL_ROOT = getPortalSystemRoot()
const PYTHON_BIN = getPythonBin()
const BUILDER_SCRIPT = portalPath("services", "inventory", "build_inventory_view.py")
const SHARED_VIEW_PATH = portalDataPath("processed", "inventory", "inventory_view.json")

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

  try {
    const result = await execFileAsync(PYTHON_BIN, [BUILDER_SCRIPT], { cwd: PORTAL_ROOT })
    stdout = result.stdout
  } catch (err: unknown) {
    const errorOutput =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr?: string }).stderr || (err as { message?: string }).message || "unknown error")
        : "unknown error"
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
