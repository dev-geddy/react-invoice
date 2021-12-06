/*
* Default invoice info is picked up here from .env file
* */

export default {
  editMode: process.env.REACT_APP__EDIT_MODE,
  lang: process.env.REACT_APP__LANG,
  history: [],
  provider: {
    companyName: process.env.REACT_APP__COMPANY_NAME,
    name: process.env.REACT_APP__REPRESENTATIVE_NAME,
    role: process.env.REACT_APP__REPRESENTATIVE_ROLE,
    addressLine1: process.env.REACT_APP__ADDR_LINE_1,
    addressLine2: process.env.REACT_APP__ADDR_LINE_2,
    addressLine3: process.env.REACT_APP__ADDR_LINE_3,
    addressLine4: process.env.REACT_APP__ADDR_LINE_4,
    companyRegNo: process.env.REACT_APP__COMPANY_REG_NO,
    companyVatNo: process.env.REACT_APP__VAT_NO,
    billingBankAccountIban: process.env.REACT_APP__BANK_IBAN,
    billingBankAccountBic: process.env.REACT_APP__BANK_BIC,
    billingBankAccountNo: process.env.REACT_APP__BANK_ACCOUNT_NO,
    billingBankAccountSortCode: process.env.REACT_APP__BANK_SORT_CODE,
  },
  customer: {
    companyName: process.env.REACT_APP__CLIENT__COMPANY_NAME,
    name: process.env.REACT_APP__CLIENT__REPRESENTATIVE_NAME,
    role: process.env.REACT_APP__CLIENT__REPRESENTATIVE_ROLE,
    addressLine1: process.env.REACT_APP__CLIENT__ADDR_LINE_1,
    addressLine2: process.env.REACT_APP__CLIENT__ADDR_LINE_2,
    addressLine3: process.env.REACT_APP__CLIENT__ADDR_LINE_3,
    addressLine4: process.env.REACT_APP__CLIENT__ADDR_LINE_4,
    companyRegNo: process.env.REACT_APP__CLIENT__COMPANY_REG_NO,
    companyVatNo: process.env.REACT_APP__CLIENT__VAT_NO,
    billingBankAccountIban: process.env.REACT_APP__CLIENT__BANK_IBAN,
    billingBankAccountBic: process.env.REACT_APP__CLIENT__BANK_BIC,
    billingBankAccountNo: process.env.REACT_APP__CLIENT__BANK_ACCOUNT_NO,
    billingBankAccountSortCode: process.env.REACT_APP__CLIENT__BANK_SORT_CODE,
  },
  invoiceMeta: {
    invoiceDate: process.env.REACT_APP__INVOICE_DATE,
    invoiceSeries: process.env.REACT_APP__INVOICE_SERIES,
    invoiceNo: process.env.REACT_APP__INVOICE_NO,
    currency: process.env.REACT_APP__INVOICE_CURRENCY,
    brandName: process.env.REACT_APP__INVOICE_BRAND_NAME,
    brandSubName: process.env.REACT_APP__INVOICE_BRAND_SUBNAME,
    vatRate: process.env.REACT_APP__INVOICE_VAT_RATE_PCT,
  },
  invoiceEntries: [
    {
      dateProvided: process.env.REACT_APP__INVOICE_ENTRY__DATE_PROVIDED,
      description: process.env.REACT_APP__INVOICE_ENTRY__DESCRIPTION,
      qty: process.env.REACT_APP__INVOICE_ENTRY__QTY,
      qtyType: process.env.REACT_APP__INVOICE_ENTRY__QTY_TYPE,
      rate: process.env.REACT_APP__INVOICE_ENTRY__RATE,
      total: process.env.REACT_APP__INVOICE_ENTRY__TOTAL,
    }
  ]
}