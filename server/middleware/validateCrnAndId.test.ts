import httpMocks from 'node-mocks-http'
import { NextFunction } from 'express'
import validateCrnAndId from './validateCrnAndId'
import renderError from './renderError'

const mockRenderErrorMiddleware = jest.fn()
jest.mock('./renderError', () => jest.fn(() => mockRenderErrorMiddleware))

const mockRenderError = renderError as jest.MockedFunction<typeof renderError>

const validCrn = 'X000001'
const validUuid = 'f1654ea3-0abb-46eb-860b-654a96edbe20'

const run = (params: Record<string, string>) => {
  const req = httpMocks.createRequest({ params })
  const res = httpMocks.createResponse()
  const next = jest.fn() as NextFunction
  validateCrnAndId(req, res, next)
  return { req, res, next }
}

describe('validateCrnAndId', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls next when crn and id are valid', () => {
    const { next } = run({ crn: validCrn, id: validUuid })
    expect(next).toHaveBeenCalled()
    expect(mockRenderError).not.toHaveBeenCalled()
  })

  it('renders 404 and does not call next when crn is invalid', () => {
    const { req, res, next } = run({ crn: 'not-a-crn', id: validUuid })
    expect(mockRenderError).toHaveBeenCalledWith(404)
    expect(mockRenderErrorMiddleware).toHaveBeenCalledWith(req, res)
    expect(next).not.toHaveBeenCalled()
  })

  it('renders 404 and does not call next when id is not a valid UUID', () => {
    const { req, res, next } = run({ crn: validCrn, id: 'not-a-uuid' })
    expect(mockRenderError).toHaveBeenCalledWith(404)
    expect(mockRenderErrorMiddleware).toHaveBeenCalledWith(req, res)
    expect(next).not.toHaveBeenCalled()
  })
})
