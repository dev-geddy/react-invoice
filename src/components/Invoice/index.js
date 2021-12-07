import React, {Component} from 'react'
import './Invoice.css'
import InvoiceSubject from './InvoiceSubject'
import InvoiceEntries from './InvoiceEntries'
import InvoiceMeta from './InvoiceMeta'
import {labels} from './en-UK'
import connectWithRedux from "../../decorators/connectWithRedux";
import {selectors as invoiceSelector} from "../../redux/invoice/reducer";
import invoiceActions from "../../redux/invoice/actions";

@connectWithRedux((state) => ({
  isLoading: invoiceSelector.isLoading(state),
  uuid: invoiceSelector.uuid(state),
  invoiceMeta: invoiceSelector.invoiceMeta(state),
  provider: invoiceSelector.provider(state),
  customer: invoiceSelector.customer(state),
  invoiceEntries: invoiceSelector.invoiceEntries(state),
}), {

})

class Invoice extends Component {
  qtyTypes = [
    {
      name: '',
      description: 'none'
    },
    {
      name: 'h',
      description: 'hours'
    },
    {
      name: 'd',
      description: 'days'
    },
    {
      name: 'units',
      description: 'number of goods'
    }
  ]

  currencyTypes = [
    {
      symbol: '£',
      name: 'British Pound',
      iso: 'GBP',
    },
    {
      symbol: '€',
      name: 'Euro',
      iso: 'EUR',
    },
    {
      symbol: '$',
      name: 'US Dollar',
      iso: 'USD',
    },
    {
      symbol: 'Fr.',
      name: 'Swiss Frank',
      iso: 'CHF',
    }
  ]

  getInvoiceTotalPayable = ({invoiceEntries, invoiceMeta}) => {
    const total = invoiceEntries?.reduce((grandTotal, entry) => {
      return grandTotal + parseFloat(entry.total)
    }, 0)

    const multiplier = this.getVatMultiplier(invoiceMeta.vatRate)

    return total * multiplier
  }

  constructTitle = ({provider, customer, invoiceEntries, invoiceMeta, uuid}) => {
    try {
      const invoiceDateISO = String(invoiceMeta.invoiceDate).split('/').reverse().join('_')
      const invoiceCurrency = invoiceMeta.currency
      const invoiceCurrencyISO = invoiceCurrency === '£' ? 'GBP' : invoiceCurrency === '€' ? 'EUR' : invoiceCurrency
      const invoiceTotal = Number(this.getInvoiceTotalPayable({invoiceEntries, invoiceMeta})).toFixed(2);
      const vatInclusive = Number(invoiceMeta.vatRate) > 0 ? ' VAT incl. ' : ' NON-VAT '
      const nameOnFile = `${customer.companyName}, ${customer.name}`

      return `${invoiceDateISO} - ${invoice.invoiceMeta.invoiceSeries}${invoice.invoiceMeta.invoiceNo} - ${invoiceCurrencyISO}${invoiceTotal}${vatInclusive} - (PENDING) - ${nameOnFile}`
    } catch (error) {
      return '- INVOICE INFORMATION INCOMPLETE -';
    }
  }

  componentDidMount() {
    const {provider, customer, invoiceEntries, invoiceMeta, uuid} = this.props
    document.title = this.constructTitle({provider, customer, invoiceEntries, invoiceMeta, uuid})
  }

  getVatMultiplier = (vat) => {
    return parseFloat(100 + parseFloat(vat)) / 100
  }

  getTotalsAndVat = (entries, invoiceMeta) => {
    const total = entries?.reduce((grandTotal, entry) => {
      return grandTotal + parseFloat(entry.total)
    }, 0)

    const multiplier = this.getVatMultiplier(invoiceMeta?.vatRate)

    return {
      total: total,
      vatAmount: (total * multiplier) - total,
      vatBasis: total,
      totalVat: total * multiplier
    }
  }

  render() {
    const {provider, customer, invoiceEntries, invoiceMeta} = this.props
    const {total, totalVat, vatAmount, vatBasis} = this.getTotalsAndVat(invoiceEntries, invoiceMeta)

    return (
      <div className="Invoice">
        <header className="Invoice-header">
          <h1 className="Logo">
            <span className="Logo-part-1">{invoiceMeta?.brandName}</span>
            <span className="Logo-part-2">{invoiceMeta?.brandSubName}</span>
          </h1>
          <div className="Header-meta">
            {provider.companyName && <span>{provider?.companyName}</span>}
            {provider.companyName && <br/>}
            {provider.companyRegNo && <span>{labels.companyRegNo} <strong>{provider?.companyRegNo}</strong></span>}
            {provider.companyRegNo && <br/>}
            {provider.companyVatNo && <span>{labels.companyVatNo} <strong>{provider?.companyVatNo}</strong></span>}
          </div>
          <hr/>
        </header>
        <div className="Invoice-body">
          <div className="Invoice-subjects">
            <InvoiceSubject subject={provider} subjectType={'provider'} />
            <InvoiceSubject subject={customer} subjectType={'customer'} />
          </div>
          <div className="Invoice-the-invoice">
            <h2>{labels.invoice}</h2>
            <InvoiceMeta meta={invoiceMeta} provider={provider} />
            <p>&nbsp;</p>
          </div>
          <div className="Invoice-details">
            <h3>{labels.worksCompleted}</h3>
            <InvoiceEntries entries={invoiceEntries} invoiceMeta={invoiceMeta} />
            <p>&nbsp;</p>
            <table className="Invoice-table Table-wide">
              <tbody>
              <tr>
                {provider.companyVatNo && <th>{labels.vatBasis}</th> || <th></th>}
                {provider.companyVatNo && <th>{labels.rate}</th> || <th></th>}
                {provider.companyVatNo && <th>{labels.vatAmount}</th> || <th></th>}
                <td rowSpan={2} className="Table-totals">
                  <table className="Totals-table">
                    <tbody>
                    <tr>
                      <th>{labels.total}</th>
                      <td>{invoiceMeta.currency}{parseFloat(total).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>{labels.vat}</th>
                      <td>{invoiceMeta.currency}{parseFloat(provider.companyVatNo ? vatAmount : 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <th>{labels.totalPayable}</th>
                      <td>{invoiceMeta.currency}{parseFloat(totalVat).toFixed(2)}</td>
                    </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {provider.companyVatNo && <tr>
                <td>{invoiceMeta.currency}{parseFloat(vatBasis).toFixed(2)}</td>
                <td>{invoiceMeta.vatRate}%</td>
                <td>{invoiceMeta.currency}{parseFloat(vatAmount).toFixed(2)}</td>
              </tr> || <tr></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="Invoice-footer">
          <hr/>
          <small>
            {provider.companyName},
            &nbsp;{labels.companyRegNo}&nbsp;{provider.companyRegNo},
            &nbsp;{labels.companyVatNo}&nbsp;{provider.companyVatNo},
            &nbsp;{provider.addressLine1},
            &nbsp;{provider.addressLine2},
            &nbsp;{provider.addressLine3},
            &nbsp;{provider.addressLine4}
          </small>
        </footer>
      </div>
    )
  }
}

export default Invoice