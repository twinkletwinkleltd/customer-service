export const saveHistory = (sku: string, result: any) => {
  const raw = localStorage.getItem("sku_history") || "[]"
  const list = JSON.parse(raw)

  list.unshift({
    sku,
    result,
    time: new Date().toISOString(),
  })

  localStorage.setItem("sku_history", JSON.stringify(list.slice(0, 20)))
}

export const getHistory = () => {
  return JSON.parse(localStorage.getItem("sku_history") || "[]")
}
