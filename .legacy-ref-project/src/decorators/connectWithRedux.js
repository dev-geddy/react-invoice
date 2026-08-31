import {connect} from 'react-redux'

export const connectWithRedux = (...connectArgs) =>
  (componentArgs) =>
    connect(...connectArgs)(componentArgs)


export default connectWithRedux