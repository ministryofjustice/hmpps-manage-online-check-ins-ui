import superagent, { SuperAgentRequest } from 'superagent'

const stubProbationPractitionerNoEmail = (): SuperAgentRequest =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      urlPattern: '/v2/offenders/crn/.*/probation-practitioner',
      method: 'GET',
    },
    response: {
      status: 200,
      jsonBody: {
        code: 'N99TST1',
        name: {
          forename: 'Test',
          surname: 'Practitioner',
        },
        provider: {
          code: 'N07',
          name: 'London',
        },
        team: {
          code: 'N07AAT',
          description: 'Automated Allocation Team',
        },
        unallocated: false,
        username: 'TestPractitioner',
        email: null,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })

const stubProbationPractitioner = ({ username = 'TestPractitioner' } = {}): SuperAgentRequest =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      urlPattern: '/v2/offenders/crn/.*/probation-practitioner',
      method: 'GET',
    },
    response: {
      status: 200,
      jsonBody: {
        code: 'N99TST1',
        name: {
          forename: 'Test',
          surname: 'Practitioner',
        },
        provider: {
          code: 'N07',
          name: 'London',
        },
        team: {
          code: 'N07AAT',
          description: 'Automated Allocation Team',
        },
        unallocated: false,
        username,
        email: 'test.practitioner@example.com',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })

export default {
  stubProbationPractitionerNoEmail,
  stubProbationPractitioner,
}
