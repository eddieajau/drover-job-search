import type { AnalysisTopic } from 'workers'

export type BusEventName = 'kick'
export type BusEvents = Record<BusEventName, [payload: { topic: AnalysisTopic }]>
