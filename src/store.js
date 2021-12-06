import {createStore, applyMiddleware, combineReducers} from 'redux'
import createSagaMiddleware from 'redux-saga'
import reducers from './redux/reducers'
import sagas from './redux/sagas'

const sagaMiddleware = createSagaMiddleware()
const store = createStore(
  combineReducers({
    ...reducers
  }),
  applyMiddleware(sagaMiddleware)
)

sagaMiddleware.run(sagas)

export default store
