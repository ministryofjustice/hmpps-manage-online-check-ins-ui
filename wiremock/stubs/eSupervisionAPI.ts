import superagent, { SuperAgentRequest } from 'superagent'
import { DateTime } from 'luxon'
import { esupervisionAdditionalQuestions } from '../../server/controllers/mocks/esupervisionAdditionalQuestions'
import { NdeliusEvent } from '../../server/data/model/personalDetails'

const stubOffenderSetup500Response = (): SuperAgentRequest =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: {
      urlPathPattern: '/v2/offender_setup',
      method: 'POST',
    },
    response: {
      status: 500,
      jsonBody: {
        status: 500,
        errorCode: null,
        userMessage: '500 internal server error',
        developerMessage: '500 internal server error',
        moreInfo: null,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })

const stubOffenderSetup422Response = (): SuperAgentRequest =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: {
      urlPathPattern: '/v2/offender_setup',
      method: 'POST',
    },
    response: {
      status: 422,
      jsonBody: {
        status: 422,
        errorCode: null,
        userMessage: '422 BAD_REQUEST Unprocessable entity: contact information already in use',
        developerMessage: '422 BAD_REQUEST Unprocessable entity: contact information already in use',
        moreInfo: null,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })

const stubUpdatePersonalContact404Response = (): SuperAgentRequest =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: {
      urlPathPattern: '/v2/offenders/crn/[^/]+/contact-details',
      method: 'PUT',
    },
    response: {
      status: 404,
      jsonBody: {
        status: 404,
        errorCode: 'NOT_FOUND',
        userMessage: '404 NOT_FOUND',
        developerMessage: '404 NOT_FOUND',
        moreInfo: null,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })

const stubUpdatePersonalContact500Response = (): SuperAgentRequest =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: {
      urlPathPattern: '/v2/offenders/crn/[^/]+/contact-details',
      method: 'PUT',
    },
    response: {
      status: 500,
      jsonBody: {
        status: 500,
        errorCode: null,
        userMessage: '500 internal server error',
        developerMessage: '500 internal server error',
        moreInfo: null,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })

const stubOffenderSetupComplete500Response = (): SuperAgentRequest =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: {
      urlPathPattern: '/v2/offender_setup/.+?/complete',
      method: 'POST',
    },
    response: {
      status: 500,
      jsonBody: {
        status: 500,
        errorCode: null,
        userMessage: 'Unexpected error: No setup found for uuid=93e135af-4526-68ed-fd63-112437f63465',
        developerMessage: 'No setup found for uuid=93e135af-4526-68ed-fd63-112437f63465',
        moreInfo: null,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })
export const stubGetQuestionsTemplates = () => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPattern: 'v2/questionstemplates\\?locale=en-GB',
    },
    response: {
      status: 200,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
      jsonBody: esupervisionAdditionalQuestions,
    },
  })
}

export const stubGetOffenderByCRN = (crn: string) => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPath: `/v2/offenders/crn/${crn}`,
      queryParameters: {
        'include-personal-details': {
          equalTo: 'true',
        },
      },
    },
    response: {
      status: 200,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
      jsonBody: {
        uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
        crn: 'X000001',
        status: 'VERIFIED',
        firstCheckin: '2026-07-14',
        checkinInterval: 'WEEKLY',
        contactPreference: 'PHONE',
        photoUrl: 'string',
        details: {
          name: {
            forename: 'John',
            surname: 'Smith',
          },
        },
      },
    },
  })
}

// A VERIFIED person with contact details on file, so the manage and restart journeys can confirm
// contact without editing it. Takes the schedule, which is what the ad-hoc journeys vary.
const stubGetVerifiedOffenderByCRN = (
  crn: string,
  schedule: { mode: 'SCHEDULED' | 'AD_HOC'; checkinInterval: string | null; firstCheckin: string | null },
  sentenceDetails: { currentEvent?: number; events?: NdeliusEvent[] } = {},
) => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPath: `/v2/offenders/crn/${crn}`,
      queryParameters: {
        'include-personal-details': {
          equalTo: 'true',
        },
      },
    },
    response: {
      status: 200,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
      jsonBody: {
        uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
        crn,
        status: 'VERIFIED',
        ...schedule,
        currentEvent: sentenceDetails.currentEvent,
        contactPreference: 'PHONE',
        photoUrl: '/assets/images/placeholder.png',
        details: {
          name: {
            forename: 'Joe',
            surname: 'Bloggs',
          },
          mobile: '071838893',
          email: 'address1@gmail.com',
          events: { events: sentenceDetails.events ?? [] },
        },
      },
    },
  })
}

export const stubGetScheduledOffenderByCRN = (crn: string) =>
  stubGetVerifiedOffenderByCRN(crn, { mode: 'SCHEDULED', checkinInterval: 'WEEKLY', firstCheckin: '2025-11-03' })

const stubSentenceEvents = async ({
  crn,
  events,
  currentEvent,
}: {
  crn: string
  events: NdeliusEvent[]
  currentEvent?: number
}): Promise<null> => {
  await superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: { method: 'GET', urlPath: `/v2/offenders/crn/${crn}/personal-details` },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        crn,
        name: { forename: 'Joe', surname: 'Bloggs' },
        mobile: '071838893',
        email: 'address1@gmail.com',
        events: { events },
      },
    },
  })
  if (currentEvent !== undefined) {
    await stubGetVerifiedOffenderByCRN(
      crn,
      { mode: 'SCHEDULED', checkinInterval: 'WEEKLY', firstCheckin: '2025-11-03' },
      { currentEvent, events },
    )
  }
  return null
}

export const stubGetOffenderHeaderByCRN = (crn: string, tierScore: string = 'D') =>
  superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPath: `/v2/offenders/header/${crn}`,
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: {
        crn,
        dateOfBirth: '1979-08-18',
        tierScore,
        tierDetailsLink: 'https://example.com/tier',
        overallRisk: 'MEDIUM',
      },
    },
  })

// An ad-hoc person: the API carries ad-hoc as a mode with no interval, and no check in is booked
// until the practitioner schedules one, so there is no first check-in date either.
export const stubGetAdHocOffenderByCRN = (crn: string) =>
  stubGetVerifiedOffenderByCRN(crn, { mode: 'AD_HOC', checkinInterval: null, firstCheckin: null })

const stubAssignQuestions = () => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'PUT',
      urlPathPattern: '/v2/questions/assignment',
      queryParameters: {
        crn: {
          matches: '.*',
        },
      },
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: {
        expectedCheckinDate: DateTime.now().plus({ days: 5 }).toISO(),
        listId: 3,
      },
    },
  })
}

// A check in booked daysAhead from today; 0 books one due today, which is active and cannot be moved.
const stubGetUpcomingCheckinQuestions = (daysAhead: number | null = 5) => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPattern: '/v2/questions/upcoming/.+?/offender-questions.*',
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: {
        expectedCheckinDate: DateTime.now()
          .plus({ days: daysAhead ?? 5 })
          .toISO(),
        questions: [],
      },
    },
  })
}

// Nothing booked: the API answers 404 when the person has no upcoming check in.
const stubNoUpcomingCheckin = () => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPattern: '/v2/questions/upcoming/.+?/offender-questions.*',
    },
    response: {
      status: 404,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: { status: 404, userMessage: 'No upcoming check in' },
    },
  })
}

const stubGetUpcomingCheckinQuestionItems = () => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPattern: '/v2/questions/upcoming/.+?/question-items\\?language=en-GB',
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: {
        upcoming: {
          expectedCheckinDate: DateTime.now().plus({ days: 5 }).toISO(),
          items: [],
        },
      },
    },
  })
}

export const stubPractitionerAlerts = (count: number) => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'GET',
      urlPathPattern: '/v2/practitioners/.+?/alerts',
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: { count },
    },
  })
}

export const stubPractitionerAlerts500Response = () => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: {
      method: 'GET',
      urlPathPattern: '/v2/practitioners/.+?/alerts',
    },
    response: {
      status: 500,
      jsonBody: {
        status: 500,
        errorCode: null,
        userMessage: '500 internal server error',
        developerMessage: '500 internal server error',
        moreInfo: null,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
  })
}

const stubDeleteAssignedQuestionsFromCheckIn = () => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    request: {
      method: 'DELETE',
      urlPathPattern: '/v2/questions/assignment',
      queryParameters: {
        crn: {
          matches: '.*',
        },
      },
    },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      jsonBody: {
        message: 'deleted',
      },
    },
  })
}
const stubFeatureFlags = (flags: Record<string, boolean> = {}): SuperAgentRequest => {
  return superagent.post('http://localhost:9091/__admin/mappings').send({
    priority: 1,
    request: {
      urlPattern: '/flipt/internal/v1/evaluation/snapshot/namespace/hmpps-esupervision',
      method: 'GET',
    },
    response: {
      status: 200,
      jsonBody: {
        namespace: {
          key: 'hmpps-esupervision',
        },
        flags: Object.entries(flags).map(([key, enabled]) => ({
          key,
          name: key,
          description: '',
          enabled,
          type: 'BOOLEAN_FLAG_TYPE',
          createdAt: '2026-09-09T12:00:00.920581Z',
          updatedAt: '2026-09-09T12:00:00.920581Z',
          rules: [] as unknown[],
          rollouts: [] as unknown[],
        })),
      },
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
    },
  })
}

export default {
  stubFeatureFlags,
  stubOffenderSetup422Response,
  stubOffenderSetup500Response,
  stubOffenderSetupComplete500Response,
  stubUpdatePersonalContact404Response,
  stubUpdatePersonalContact500Response,
  stubGetQuestionsTemplates,
  stubGetOffenderByCRN,
  stubGetOffenderHeaderByCRN,
  stubGetAdHocOffenderByCRN,
  stubGetScheduledOffenderByCRN,
  stubSentenceEvents,
  stubGetUpcomingCheckinQuestionItems,
  stubGetUpcomingCheckinQuestions,
  stubNoUpcomingCheckin,
  stubAssignQuestions,
  stubDeleteAssignedQuestionsFromCheckIn,
  stubPractitionerAlerts,
  stubPractitionerAlerts500Response,
}
