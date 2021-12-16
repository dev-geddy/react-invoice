import React, {Component} from 'react'
import labels from './../../translations'

export class InvoiceMeta extends Component {

  handleChange = (event) => {
    const fieldName = event.target.name
    const fieldValue = event.target.value
    const subject = 'invoiceMeta'

    this.props.onUpdate(subject, fieldName, fieldValue)
  }
  handleChangeProvider = (event) => {
    const fieldName = event.target.name
    const fieldValue = event.target.value
    const subject = 'provider'

    this.props.onUpdate(subject, fieldName, fieldValue)
  }

  render() {
    const {meta, editMode, provider} = this.props

    return (
      <div className="Invoice-meta">
        {!editMode && <table className="Invoice-table">
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
        </table>}
        {editMode && <div className="Invoice-subjects">
          <div className={`Invoice-subject Subject-provider`}>
            <small>{labels.invoiceMeta}</small><br />
            <input type="text" placeholder={labels.invoiceDate} name="invoiceDate" className="Half-size" value={meta.invoiceDate} onChange={this.handleChange} /><br />
            <input type="text" placeholder={labels.invoiceSeries} name="invoiceSeries" className="Half-size" value={meta.invoiceSeries} onChange={this.handleChange} /><br />
            <input type="text" placeholder={labels.invoiceNumber} name="invoiceNo" className="Half-size" value={meta.invoiceNo} onChange={this.handleChange} /><br />
            <input type="text" placeholder={labels.currency} name="currency" className="Half-size" value={meta.currency} onChange={this.handleChange} /><br />
            <input type="text" placeholder={labels.vatRate} name="vatRate" className="Half-size" value={meta.vatRate} onChange={this.handleChange} /><br />
          </div>
          <div className={`Invoice-subject Subject-customer`}>
            <small>{labels.invoiceBranding}</small><br />
            <input type="text" placeholder={labels.brandName} name="brandName" className="Half-size" value={meta.brandName} onChange={this.handleChange} /><br />
            <input type="text" placeholder={labels.brandSubName} name="brandSubName" className="Half-size" value={meta.brandSubName} onChange={this.handleChange} /><br />
            <br />
            <small>{labels.companyId}</small><br />
            <input type="text" placeholder={labels.companyName} name="companyName" className="Half-size" value={provider.companyName} onChange={this.handleChangeProvider} /><br />
            <input type="text" placeholder={labels.companyRegNo} name="companyRegNo" className="Half-size" value={provider.companyRegNo} onChange={this.handleChangeProvider} /><br />
            <input type="text" placeholder={labels.companyVatNo} name="companyVatNo" className="Half-size" value={provider.companyVatNo} onChange={this.handleChangeProvider} />
          </div>
        </div>}
      </div>
    )
  }
}

export default InvoiceMeta