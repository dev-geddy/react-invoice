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

// title and numbers calc

export const getVatMultiplier = (vat) => {
  return parseFloat(100 + parseFloat(vat)) / 100
}

export const getInvoiceTotalPayable = ({invoiceEntries, invoiceMeta}) => {
  const total = invoiceEntries?.reduce((grandTotal, entry) => {
    return grandTotal + parseFloat(entry.total)
  }, 0)

  const multiplier = getVatMultiplier(invoiceMeta.vatRate)

  return total * multiplier
}

export const getTotalsAndVat = (entries, invoiceMeta) => {
  const total = entries?.reduce((grandTotal, entry) => {
    return grandTotal + parseFloat(entry.total)
  }, 0)

  const multiplier = getVatMultiplier(invoiceMeta?.vatRate)

  return {
    total: total,
    vatAmount: (total * multiplier) - total,
    vatBasis: total,
    totalVat: total * multiplier
  }
}

export const constructTitle = ({provider, customer, invoiceEntries, invoiceMeta, uuid}) => {
  try {
    const invoiceDateISO = String(invoiceMeta.invoiceDate).split('/').reverse().join('_')
    const invoiceCurrency = invoiceMeta.currency
    const invoiceCurrencyISO = invoiceCurrency === '£' ? 'GBP' : invoiceCurrency === '€' ? 'EUR' : invoiceCurrency
    const invoiceTotal = Number(getInvoiceTotalPayable({invoiceEntries, invoiceMeta})).toFixed(2);
    const vatInclusive = Number(invoiceMeta.vatRate) > 0 ? ' VAT incl. ' : ' NON-VAT '
    const nameOnFile = `${customer.companyName}, ${customer.name}`

    return `${invoiceDateISO} - ${invoiceMeta.invoiceSeries}${invoiceMeta.invoiceNo} - ${invoiceCurrencyISO}${invoiceTotal}${vatInclusive} - (PENDING) - ${nameOnFile}`
  } catch (error) {
    return 'React Invoice - Creating New Invoice';
  }
}

export const today = () => {
  const date = new Date()
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

// const qtyTypes = [
//   {
//     name: '',
//     description: 'none'
//   },
//   {
//     name: 'h',
//     description: 'hours'
//   },
//   {
//     name: 'd',
//     description: 'days'
//   },
//   {
//     name: 'units',
//     description: 'number of goods'
//   }
// ]
//
// const currencyTypes = [
//   {
//     symbol: '£',
//     name: 'British Pound',
//     iso: 'GBP',
//   },
//   {
//     symbol: '€',
//     name: 'Euro',
//     iso: 'EUR',
//   },
//   {
//     symbol: '$',
//     name: 'US Dollar',
//     iso: 'USD',
//   },
//   {
//     symbol: 'Fr.',
//     name: 'Swiss Frank',
//     iso: 'CHF',
//   }
// ]

export default {
  recalcEntry,
  constructTitle,
  today,
}
