import React, {Component} from 'react'
import PropTypes from 'prop-types'
import {labels} from './en-UK'

export class InvoiceSubject extends Component {

  subjectTypes = {
    provider: labels.provider,
    customer: labels.customer
  }

  render() {
    const {
      subject,
      subjectType,
    } = this.props

    const subjectTypeName = this.subjectTypes[subjectType] || ''

    return (
      <div className={`Invoice-subject Subject-${subjectType}`}>
        <small>{subjectTypeName}</small>
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
        </p>

        {(subject.billingBankAccountBic || subject.billingBankAccountNo) && <small><br />Billing info</small>}
        <p>
          {subject.billingBankAccountBic && `${labels.billingBankAccountBic} ${subject.billingBankAccountBic}`}
          {subject.billingBankAccountBic && <br/>}
          {subject.billingBankAccountIban && `${labels.billingBankAccountIban} ${subject.billingBankAccountIban}`}
          {subject.billingBankAccountIban && <br/>}
        </p>
        <p>
          {subject.billingBankAccountNo && `${labels.billingBankAccountNo} ${subject.billingBankAccountNo}`}
          {subject.billingBankAccountNo && <br/>}
          {subject.billingBankAccountSortCode && `${labels.billingBankAccountSortCode} ${subject.billingBankAccountSortCode}`}
          {subject.billingBankAccountSortCode && <br/>}
        </p>
      </div>
    )
  }
}

InvoiceSubject.propTypes = {
  subject: PropTypes.object,
  subjectType: PropTypes.string,
}

export default InvoiceSubject