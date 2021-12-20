import React, {Fragment, PureComponent} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {
  Backdrop,
  Box,
  Fade,
  Modal,
  Typography,
  Chip,
  Stack,
} from '@mui/material'
import invoiceActions from '../../redux/invoice/actions'
import {selectors as invoiceSelector} from '../../redux/invoice/reducer'
import labels from '../../translations'

const boxStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: '600px',
  bgcolor: 'background.paper',
  boxShadow: 10,
  p: 3,
}

const mapStateToProps = (state) => ({
  displaySection: invoiceSelector.displaySection(state),
  allCustomers: invoiceSelector.allCustomers(state),
})

const mapDispatchToProps = {
  getInvoices: invoiceActions.getInvoices,
  toggleSectionVisibility: invoiceActions.toggleSectionVisibility,
  updateInvoiceSection: invoiceActions.updateInvoiceSection,
}

export class PrefillCustomer extends PureComponent {
  static propTypes = {
    isLoading: PropTypes.bool,
    getInvoices: PropTypes.func,
    updateInvoiceSection: PropTypes.func,
    toggleSectionVisibility: PropTypes.func,
    displaySection: PropTypes.object,
    allCustomers: PropTypes.array,
  }

  handlePrefillCustomer = (customer) => () => {
    // TODO: copy VAT rate from invoice meta as well
    this.props.updateInvoiceSection('customer', customer)
    this.props.toggleSectionVisibility('customerPrefill', false)
  }

  handleClose = () => {
    this.props.toggleSectionVisibility('customerPrefill', false)
  }

  render = () => {
    const {displaySection, allCustomers} = this.props

    return (
      <Fragment>
        <Modal
          aria-labelledby="transition-modal-title"
          aria-describedby="transition-modal-description"
          open={displaySection.customerPrefill}
          onClose={this.handleClose}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{
            timeout: 500,
          }}
        >
          <Fade in={displaySection.customerPrefill}>
            <Box sx={boxStyle}>
              <Typography id="transition-modal-title" variant="h6" component="h2">
                {labels.selectExistingCustomer}
              </Typography>
              <Typography id="transition-modal-description" sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} justifyContent="wrap">
                  {allCustomers?.map((customer, index) => (
                    <Chip key={`${customer.companyName}_${index}`} label={customer.companyName} variant="outlined" onClick={this.handlePrefillCustomer(customer)} />
                  ))}
                </Stack>
              </Typography>
            </Box>
          </Fade>
        </Modal>
      </Fragment>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(PrefillCustomer)
