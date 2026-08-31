import React, {PureComponent} from 'react'
import './Invoice.css'
import InvoiceSubject from './InvoiceSubject'
import InvoiceEntries from './InvoiceEntries'
import InvoiceMeta from './InvoiceMeta'
import labels from './../../translations'
import connectWithRedux from "../../decorators/connectWithRedux"
import {selectors as invoiceSelector} from "../../redux/invoice/reducer"
import {getTotalsAndVat} from '../../utils/invoice'

@connectWithRedux((state) => ({
  isLoading: invoiceSelector.isLoading(state),
  uuid: invoiceSelector.uuid(state),
  invoiceMeta: invoiceSelector.invoiceMeta(state),
  provider: invoiceSelector.provider(state),
  customer: invoiceSelector.customer(state),
  invoiceEntries: invoiceSelector.invoiceEntries(state),
}), {

})

class Invoice extends PureComponent {

  render() {
    const {provider, customer, invoiceEntries, invoiceMeta} = this.props
    const {total, totalVat, vatAmount, vatBasis} = getTotalsAndVat(invoiceEntries, invoiceMeta)

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
                {provider.companyVatNo && <th>{labels.vatRate}</th> || <th></th>}
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