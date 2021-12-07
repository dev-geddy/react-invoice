export const recalcEntry = (entry, fieldName, fieldValue) => {
  switch (fieldName) {
    case "qty":
      entry.total = parseFloat(fieldValue) * parseFloat(entry.rate)
      entry.qty = parseInt(fieldValue)
      return entry
    case "rate":
      entry.total = parseFloat(fieldValue) * parseInt(entry.qty)
      entry.rate = parseFloat(fieldValue)
      return entry
    case "total":
      entry.rate = parseFloat(fieldValue) / parseInt(entry.qty)
      entry.total = parseFloat(fieldValue)
      return entry
    default:
      break
  }
}

export default {
  recalcEntry
}