import safeBackUrl from './safeBackUrl'
import config from '../config'

describe('utils/safeBackUrl', () => {
  it.each([
    '/case/X123456/activity-log?page=1',
    'appointments',
    `${config.managePeopleOnProbation.link}/case/X123456/activity-log?page=1`,
    `${config.ingressUrl}/case/X123456/appointments`,
  ])('allows %s', back => {
    expect(safeBackUrl(back)).toEqual(back)
  })

  it.each([
    'https://evil.example.com/case/X123456',
    '//evil.example.com',
    '/\\evil.example.com',
    '/\t/evil.example.com',
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'http:evil.example.com',
    'http:/evil.example.com',
    'HTTPS:evil.example.com',
    ' http:evil.example.com',
    'https:/manage-people-on-probation-dev.hmpps.service.justice.gov.uk.evil.example.com',
    'data:text/html,<script>alert(1)</script>',
    `${config.managePeopleOnProbation.link}.evil.example.com/`,
    '',
  ])('rejects %j', back => {
    expect(safeBackUrl(back)).toBeUndefined()
  })

  it.each([undefined, ['/a', '/b'], { a: '/b' }])('rejects non-string value %j', back => {
    expect(safeBackUrl(back)).toBeUndefined()
  })
})
