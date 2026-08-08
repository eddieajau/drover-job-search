import type { AnalysisStage } from 'workers'

export type BusEventName = 'kick'
export type BusEvents = Record<BusEventName, [payload: { stage: AnalysisStage }]>
