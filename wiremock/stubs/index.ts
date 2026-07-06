import superagent, { Response } from 'superagent'
import eSupervisionAPI from './eSupervisionAPI'

export default {
  resetMocks: (): Promise<Array<Response>> =>
    Promise.all([superagent.post('http://localhost:9091/__admin/mappings/reset')]),
  ...eSupervisionAPI,
}
