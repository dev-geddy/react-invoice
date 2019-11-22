/*
* YOUR DEFAULT INVOICE INFO TO BE CONFIGURED HERE
* */

export default {
  editMode: false,
  lang: 'en',
  history: [],
  provider: {
    companyName: 'CompanyName Ltd',
    name: 'FirstName LastName',
    role: 'Director',
    addressLine1: '9000 House Name',
    addressLine2: 'City',
    addressLine3: 'PostCode',
    addressLine4: 'Country',
    companyRegNo: '10203040',
    companyVatNo: '100200300',
    billingBankAccountIban: 'Iban',
    billingBankAccountBic: 'Bic',
    billingBankAccountNo: 'Account no.',
    billingBankAccountSortCode: 'Sort code',
  },
  customer: {
    companyName: 'CompanyName Ltd',
    name: 'FirstName LastName',
    role: 'Director',
    addressLine1: '9000 House Name',
    addressLine2: 'City',
    addressLine3: 'PostCode',
    addressLine4: 'Country',
    companyRegNo: '10203040',
    companyVatNo: '100200300',
  },
  invoiceMeta: {
    invoiceDate: '05/11/2017',
    invoiceSeries: 'SERIES-',
    invoiceNo: '10001',
    currency: '£',
    brandName: 'Company',
    brandSubName: 'Name',
    vatRate: '20',
  },
  invoiceEntries: [
    {
      dateProvided: '22/11/2019',
      description: 'Web Development',
      qty: '1',
      qtyType: 'h',
      rate: '30',
      total: '30',
    }
  ]
}