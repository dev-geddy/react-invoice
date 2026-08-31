import {all} from 'redux-saga/effects'

import invoice from './invoice/sagas'

export default function* () {
  yield all([
    ...invoice,
  ])
}
