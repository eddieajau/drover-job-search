export type BusEventName = 'flagged' | 'descriptions-ready'
export type BusEvents = Record<BusEventName, [payload: { jobId: number }]>
