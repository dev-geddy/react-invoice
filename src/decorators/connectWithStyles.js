import {connect} from 'react-redux'
import {styled} from '@mui/styles'

export default (...connectArgs) =>
  (...withStylesArgs) =>
    (...componentArgs) =>
      connect(...connectArgs)(styled(...withStylesArgs)(...componentArgs))
