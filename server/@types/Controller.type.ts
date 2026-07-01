import HmppsAuthClient from '../data/hmppsAuthClient'
import { Route } from './Route.type'

export type Controller<T extends readonly string[], TResponse, TArgs = any> = {
  [K in T[number]]: (hmppsAuthClient?: HmppsAuthClient) => Route<Promise<TResponse>, TArgs>
}
