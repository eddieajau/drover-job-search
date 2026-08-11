import type { AnalysisTopic } from 'workers'

export type Topic = AnalysisTopic | 'slice_resume'
export type BusEventName = 'kick'
export type BusEvents = Record<BusEventName, [payload: { topic: Topic }]>
