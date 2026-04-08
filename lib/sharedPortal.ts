import path from "path"

const DEFAULT_PORTAL_ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..")

export function getPortalSystemRoot() {
  return process.env.PORTAL_SYSTEM_ROOT?.trim() || DEFAULT_PORTAL_ROOT
}

export function getPortalDataRoot() {
  return process.env.PORTAL_DATA_ROOT?.trim() || path.join(getPortalSystemRoot(), "data")
}

export function getPythonBin() {
  return process.env.PYTHON_BIN?.trim() || "python"
}

export function portalPath(...parts: string[]) {
  return path.join(getPortalSystemRoot(), ...parts)
}

export function portalDataPath(...parts: string[]) {
  return path.join(getPortalDataRoot(), ...parts)
}
