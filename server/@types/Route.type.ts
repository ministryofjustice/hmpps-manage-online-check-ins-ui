import type { Request, Response, NextFunction } from 'express'

export type Route<T, TArgs = unknown> = (req: Request, res: Response, next?: NextFunction, args?: TArgs) => T
