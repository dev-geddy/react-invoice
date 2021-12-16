import React, {PureComponent} from 'react'
import labels from './../../translations'

export class InvoiceMeta extends PureComponent {
  render() {
    const {meta} = this.props

    return (
      <div className="Invoice-meta">
        <table className="Invoice-table">
          <thead>
          <tr>
            <th>{labels.invoiceDate}</th>
            <th>{labels.invoiceNumber}</th>
          </tr>
          </thead>
          <tbody>
          <tr>
            <td>{meta.invoiceDate}</td>
            <td>{meta.invoiceSeries}{meta.invoiceNo}</td>
          </tr>
          </tbody>
        </table>
      </div>
    )
  }
}

export default InvoiceMeta