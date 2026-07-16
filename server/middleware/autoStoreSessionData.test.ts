import httpMocks from 'node-mocks-http'
import type { Response } from 'express'
import HmppsAuthClient from '../data/hmppsAuthClient'
import autoStoreSessionData from './autoStoreSessionData'

const crn = 'X778160'
const id = '19a88188-6013-43a7-bb4d-6e338516818f'

const res = {
  locals: {
    user: {
      username: 'user-1',
    },
  },
  redirect: jest.fn().mockReturnThis(),
} as unknown as Response

jest.mock('../data/hmppsAuthClient')

const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>
const nextSpy = jest.fn()

describe('/middleware/autoStoreSessionData', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('if no body values are posted', () => {
    const req = httpMocks.createRequest({
      params: {
        crn,
        id,
      },
      session: {
        data: {
          esupervision: {
            [crn]: {
              [id]: {
                manageCheckin: {
                  stopCheckinReason: 'Existing reason',
                },
              },
            },
          },
        },
      },
      body: {
        _csrf: 'z2Oy4ql3-Bdgm83ycXJpIlY8lVV_AyrbAPWE',
      },
    })

    beforeEach(() => {
      autoStoreSessionData(hmppsAuthClient)(req, res, nextSpy)
    })

    it('should leave existing session data unchanged', () => {
      expect(req.session.data.esupervision[crn][id]).toEqual({
        manageCheckin: {
          stopCheckinReason: 'Existing reason',
        },
      })
    })

    it('should return next', () => {
      expect(nextSpy).toHaveBeenCalled()
    })
  })

  describe('session id already exists', () => {
    const req = httpMocks.createRequest({
      params: {
        crn,
        id,
      },
      session: {
        data: {
          esupervision: {
            [crn]: {
              [id]: {
                manageCheckin: {
                  stopCheckinReason: 'Existing reason',
                },
              },
            },
          },
        },
      },
      body: {
        _csrf: 'z2Oy4ql3-Bdgm83ycXJpIlY8lVV_AyrbAPWE',
        esupervision: {
          [crn]: {
            [id]: {
              manageCheckin: {
                stopCheckinReason: 'New reason',
                stopCheckinSensitive: 'true',
              },
            },
          },
        },
      },
    })

    beforeEach(() => {
      autoStoreSessionData(hmppsAuthClient)(req, res, nextSpy)
    })

    it('should update the existing session data for the id', () => {
      expect(req.session.data.esupervision[crn][id]).toEqual({
        manageCheckin: {
          stopCheckinReason: 'New reason',
          stopCheckinSensitive: 'true',
        },
      })
    })

    it('should return next', () => {
      expect(nextSpy).toHaveBeenCalled()
    })
  })

  describe('session id does not exist', () => {
    const req = httpMocks.createRequest({
      params: {
        crn,
        id,
      },
      session: {
        data: {
          esupervision: {
            X000001: {
              uuid: {
                manageCheckin: {
                  stopCheckinReason: 'Existing other person reason',
                },
              },
            },
          },
        },
      },
      body: {
        _csrf: 'eWgbIYQJ-4cb7KuSKWXvFK87nZ0M3D0RvaPA',
        esupervision: {
          [crn]: {
            [id]: {
              manageCheckin: {
                stopCheckinReason: 'Reason for stopping',
                stopCheckinSensitive: 'false',
              },
            },
          },
        },
      },
    })

    beforeEach(() => {
      autoStoreSessionData(hmppsAuthClient)(req, res, nextSpy)
    })

    it('should create a new session entry for the id', () => {
      expect(req.session.data.esupervision).toEqual({
        X000001: {
          uuid: {
            manageCheckin: {
              stopCheckinReason: 'Existing other person reason',
            },
          },
        },
        [crn]: {
          [id]: {
            manageCheckin: {
              stopCheckinReason: 'Reason for stopping',
              stopCheckinSensitive: 'false',
            },
          },
        },
      })
    })

    it('should return next', () => {
      expect(nextSpy).toHaveBeenCalled()
    })
  })

  describe('if no id is present in params', () => {
    const req = httpMocks.createRequest({
      params: {
        crn,
      },
      session: {
        data: {},
      },
      body: {
        _csrf: 'eWgbIYQJ-4cb7KuSKWXvFK87nZ0M3D0RvaPA',
        esupervision: {
          [crn]: {
            manageCheckin: {
              stopCheckinReason: 'Reason without id',
            },
          },
        },
      },
    })

    beforeEach(() => {
      autoStoreSessionData(hmppsAuthClient)(req, res, nextSpy)
    })

    it('should store data under crn when id is missing', () => {
      expect(req.session.data.esupervision[crn]).toEqual({
        manageCheckin: {
          stopCheckinReason: 'Reason without id',
        },
      })
    })

    it('should return next', () => {
      expect(nextSpy).toHaveBeenCalled()
    })
  })

  describe('if value is an object', () => {
    const req = httpMocks.createRequest({
      params: {
        crn,
        id,
      },
      session: {
        data: {
          esupervision: {
            [crn]: {
              [id]: {
                manageCheckin: {
                  existingValue: 'keep me',
                },
              },
            },
          },
        },
      },
      body: {
        _csrf: 'eWgbIYQJ-4cb7KuSKWXvFK87nZ0M3D0RvaPA',
        esupervision: {
          [crn]: {
            [id]: {
              manageCheckin: {
                stopCheckinReason: 'Reason for stopping',
              },
            },
          },
        },
      },
    })

    beforeEach(() => {
      autoStoreSessionData(hmppsAuthClient)(req, res, nextSpy)
    })

    it('should merge into the existing object value in session data', () => {
      expect(req.session.data.esupervision[crn][id]).toEqual({
        manageCheckin: {
          existingValue: 'keep me',
          stopCheckinReason: 'Reason for stopping',
        },
      })
    })
  })

  // The setup wizard spreads one group (`checkins`) across many pages, so replacing the
  // group on each post would drop the answers restrictPageAccess relies on.
  describe('when a wizard posts one page of a shared group', () => {
    const setupId = 'dad89a83-3029-488a-ac24-ac2d0cf2e16c'
    const req = httpMocks.createRequest({
      params: { crn, id: setupId },
      session: {
        data: {
          esupervision: {
            [crn]: {
              [setupId]: {
                checkins: { id: setupId, eligibility: ['eligibility-none'], eligibilityChoice: 'REPLACE_F2F' },
              },
            },
          },
        },
      },
      body: { esupervision: { [crn]: { [setupId]: { checkins: { rationale: 'Stable and low risk' } } } } },
    })

    beforeEach(() => {
      autoStoreSessionData(hmppsAuthClient)(req, res, nextSpy)
    })

    it('keeps answers from earlier pages alongside the new one', () => {
      expect(req.session.data.esupervision[crn][setupId].checkins).toEqual({
        id: setupId,
        eligibility: ['eligibility-none'],
        eligibilityChoice: 'REPLACE_F2F',
        rationale: 'Stable and low risk',
      })
    })
  })
})
