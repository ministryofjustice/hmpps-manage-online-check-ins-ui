import httpMocks from 'node-mocks-http'
import { NextFunction } from 'express'
import checkInReview from './checkInReview'
import { validateWithSpec } from '../../utils/validationUtils'

jest.mock('../../utils/validationUtils', () => ({ validateWithSpec: jest.fn() }))
jest.mock('../../controllers/check-ins', () => ({ systemIdCheckPass: jest.fn(() => true) }))

const mockValidateWithSpec = validateWithSpec as jest.MockedFunction<typeof validateWithSpec>

const crn = 'X000001'
const id = 'f1654ea3-0abb-46eb-860b-654a96edbe20'

const run = (url: string) => {
  const req = httpMocks.createRequest({ method: 'POST', url, params: { crn, id } })
  const res = httpMocks.createResponse()
  res.locals.checkIn = { status: 'REVIEWED' }
  const renderSpy = jest.spyOn(res, 'render')
  const next = jest.fn() as NextFunction
  checkInReview(req, res, next)
  return { renderSpy, next }
}

describe('checkInReview', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls next when the URL matches no check-in page', () => {
    mockValidateWithSpec.mockReturnValue({})
    const { next, renderSpy } = run(`/case/${crn}/appointments/${id}/check-in/something-else`)
    expect(next).toHaveBeenCalled()
    expect(renderSpy).not.toHaveBeenCalled()
  })

  it('calls next when validation passes', () => {
    mockValidateWithSpec.mockReturnValue({})
    const { next, renderSpy } = run(`/case/${crn}/appointments/${id}/check-in/review/notes`)
    expect(next).toHaveBeenCalled()
    expect(renderSpy).not.toHaveBeenCalled()
  })

  it('re-renders the matched page with errors when validation fails', () => {
    mockValidateWithSpec.mockReturnValue({ field: 'Required' })
    const { next, renderSpy } = run(`/case/${crn}/appointments/${id}/check-in/review/identity`)
    expect(next).not.toHaveBeenCalled()
    const [template, context] = renderSpy.mock.calls.pop() as unknown as [string, Record<string, unknown>]
    expect(template).toBe('pages/check-in/review/identity')
    expect(context.errorMessages).toEqual({ field: 'Required' })
    expect(context.systemIdCheckPass).toBe(true)
  })

  it('matches view-expired rather than view for a view-expired URL', () => {
    mockValidateWithSpec.mockReturnValue({ field: 'Required' })
    const { renderSpy } = run(`/case/${crn}/appointments/${id}/check-in/view-expired`)
    const [template] = renderSpy.mock.calls.pop() as unknown as [string, Record<string, unknown>]
    expect(template).toBe('pages/check-in/view-expired')
    expect(mockValidateWithSpec).toHaveBeenCalledWith(expect.anything(), expect.anything())
  })
})
