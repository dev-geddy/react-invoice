import React, {Fragment, PureComponent} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {
  Backdrop,
  Box,
  Fade,
  Modal,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
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
              <Typography variant="body" component="p">
                {labels.showingCustomersWithDetails}
              </Typography>

              <List>
                {allCustomers?.map((customer, index) => (
                  <Fragment key={`${customer.companyName}_${index}`}>
                    <ListItem alignItems="flexStart">
                      <ListItemButton onClick={this.handlePrefillCustomer(customer)}>
                        <ListItemText secondary={`${customer.addressLine1}, ${customer.addressLine2}`}>
                          {customer.companyName}
                        </ListItemText>
                      </ListItemButton>
                    </ListItem>
                    <Divider inset component="li" />
                  </Fragment>
                ))}
              </List>
            </Box>
          </Fade>
        </Modal>
      </Fragment>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(PrefillCustomer)
