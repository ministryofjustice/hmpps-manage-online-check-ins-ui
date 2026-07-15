import config from '../config'
import RestClient from './restClient'
import { PersonalDetails, PersonalDetailsUpdateRequest, ProbationPractitioner } from './model/personalDetails'

export default class MasApiClient extends RestClient {
  constructor(token: string) {
    super('Manage a Supervision API', config.apis.masApi, token)
  }

  async getPersonalDetails(crn: string): Promise<PersonalDetails | null> {
    return this.get({ path: `/personal-details/${crn}`, handle404: false })
  }

  async updatePersonalDetailsContact(crn: string, body: PersonalDetailsUpdateRequest): Promise<PersonalDetails | null> {
    return this.post({
      data: body,
      path: `/personal-details/${crn}/contact`,
      handle404: false,
      handle500: false,
    })
  }

  async getProbationPractitioner(crn: string): Promise<ProbationPractitioner> {
    return this.get({ path: `/case/${crn}/probation-practitioner` })
  }
}
