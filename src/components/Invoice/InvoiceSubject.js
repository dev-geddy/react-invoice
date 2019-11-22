import React, {Component} from 'react'
import PropTypes from 'prop-types'
import {labels} from './en-UK'

export class InvoiceSubject extends Component {

  subjectTypes = {
    provider: labels.provider,
    customer: labels.customer
  }

  handleChange = (event) => {
    const {subjectType} = this.props
    const fieldName = event.target.name
    const fieldValue = event.target.value

    this.props.onUpdate(subjectType, fieldName, fieldValue)
  }

  render() {
    const {
      subject,
      subjectType,
      editMode
    } = this.props

    const subjectTypeName = this.subjectTypes[subjectType] || ''

    return (
      <div className={`Invoice-subject Subject-${subjectType}`}>
        <small>{subjectTypeName}</small>
        {!editMode &&
        <p>
          {subject.companyName}<br/>
          {subject.companyRegNo && `${labels.companyRegNo} ${subject.companyRegNo}`}
          {subject.companyRegNo && <br/>}
          {subject.companyVatNo && `${labels.companyVatNo} ${subject.companyVatNo}`}
          {subject.companyVatNo && <br/>}
          {subject.name}{subject.role && ` - ${subject.role}`}<br/>
          {subject.addressLine1}<br/>
          {subject.addressLine2}<br/>
          {subject.addressLine3}<br/>
          {subject.addressLine4}
        </p>}
        {editMode && <form>
          <input type="text" placeholder={labels.companyName} value={subject.companyName} name="companyName" onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.companyRegNo} value={subject.companyRegNo} name="companyRegNo" onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.companyVatNo} value={subject.companyVatNo} name="companyVatNo" onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.name} className="Half-size" value={subject.name} name="name" onChange={this.handleChange} />
          <input type="text" placeholder={labels.role} className="Half-size" value={subject.role} name="role" onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.addressLine1} value={subject.addressLine1} name="addressLine1" onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.addressLine2} value={subject.addressLine2} name="addressLine2" onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.addressLine3} value={subject.addressLine3} name="addressLine3" onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.addressLine4} value={subject.addressLine4} name="addressLine4" onChange={this.handleChange} />
        </form>}
        {(subject.billingBankAccountBic && subject.billingBankAccountIban) && <small><br />Billing info</small>}
        {!editMode && <p>
          {subject.billingBankAccountBic && `${labels.billingBankAccountBic} ${subject.billingBankAccountBic}`}
          {subject.billingBankAccountBic && <br/>}
          {subject.billingBankAccountIban && `${labels.billingBankAccountIban} ${subject.billingBankAccountIban}`}
          {subject.billingBankAccountIban && <br/>}
        </p>}
        {!editMode && <p>
          {subject.billingBankAccountNo && `${labels.billingBankAccountNo} ${subject.billingBankAccountNo}`}
          {subject.billingBankAccountNo && <br/>}
          {subject.billingBankAccountSortCode && `${labels.billingBankAccountSortCode} ${subject.billingBankAccountSortCode}`}
          {subject.billingBankAccountSortCode && <br/>}
        </p>}

        {editMode && <form>
          <input type="text" placeholder={labels.billingBankAccountBic} name="billingBankAccountBic" className="Half-size" value={subject.billingBankAccountBic} onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.billingBankAccountIban} name="billingBankAccountIban" className="Half-size" value={subject.billingBankAccountIban} onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.billingBankAccountNo} name="billingBankAccountNo" className="Half-size" value={subject.billingBankAccountNo} onChange={this.handleChange} /><br />
          <input type="text" placeholder={labels.billingBankAccountSortCode} name="billingBankAccountSortCode" className="Half-size" value={subject.billingBankAccountSortCode} onChange={this.handleChange} />
        </form>}
      </div>
    )
  }
}

InvoiceSubject.propTypes = {
  subject: PropTypes.object,
  subjectType: PropTypes.string,
  editMode: PropTypes.bool,
  onUpdate: PropTypes.func
}

export default InvoiceSubject