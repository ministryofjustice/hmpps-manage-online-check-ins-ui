import httpMocks from 'node-mocks-http'
import restrictRestartToStoppedCheckins from './restrictRestartToStoppedCheckins'
import { AppResponse } from '../models/Locals'

const crn = 'X778160'
const id = '19a88188-6013-43a7-bb4d-6e338516818f'

const run = (status: string) => {
  const req = httpMocks.createRequest({ params: { crn, id } })
  const res = { redirect: jest.fn(), locals: { offenderCheckinsByCRNResponse: { status } } } as unknown as AppResponse
  const next = jest.fn()
  restrictRestartToStoppedCheckins(req, res, next)
  return { res, next }
}

describe('restrictRestartToStoppedCheckins', () => {
  it('lets a restart of stopped check ins continue', () => {
    const { res, next } = run('INACTIVE')
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it.each(['VERIFIED', 'INITIAL'])('sends %s check ins to the manage page', status => {
    const { res, next } = run(status)
    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}`)
    expect(next).not.toHaveBeenCalled()
  })
})
