// Shapes of the two pre-built files in public/ward-officer/ (see scripts/ward-officer/).
export type Lang = 'en' | 'mr'

export type Flag = {
  type: 'warranty' | 'utility' | 'overbill' | 'double'
  wo: string
  amount: number
  ratio?: number
  twin?: string
  why: string
  road: string
  roadName: string
  contractor: string
  date: string
  cost: number
  method: string
  heavyRainWeek: boolean
}

export type Complaint = {
  id: string
  at: string
  channel: string
  category: string
  text: string
  photo: string
  status: string
  locality: string
  upvotes: number
}

export type Road = {
  road: string
  name: string
  segment: number
  surface: string
  underWarranty: boolean
  busRoute: boolean
  score: number
  jobs: number
  reopens: number
  coldFails: number
  accidents: number
  fatal: number
  hospitals: string[]
  schools: number
  floodSpots: string[]
  ageYears: number
  spent: number
  method: string
  estCost: number
}

export type Ward = {
  code: string
  name: string
  office: string
  zone: string
  budget: number
  spent: number
  crews: number
  lowLying: number
  population: number
  jobs: number
  reopenRate: number
  slaMissRate: number
  shouldHavePaid: { total: number; workOrders: number; byType: Record<string, { count: number; amount: number }> }
  flags: Flag[]
  repeats: { count: number; examples: { closed: string; closedAt: string; again: string; againAt: string; kind: "road" | "water" | "manhole" | "other"; metres: number; locality: string; text: string; days: number }[] }
  complaints: {
    total: number
    open: number
    misfiled: number
    bounced: number
    oldestOpen: Complaint[]
    misfiledExamples: Complaint[]
    bouncedExamples: Complaint[]
  }
  contractors: { name: string; jobs: number; reopenRate: number; slaMissRate: number; avgCostVsRate: number | null; heavyRainShare: number }[]
  nextRupee: Road[]
}

export type Facts = { generatedFrom: string; overbillRatio: number; city: { spent: number; shouldHavePaid: number; flaggedWorkOrders: number }; wards: Ward[] }

export type Line = { en: string; mr: string; qc1: boolean; qc2: 'ok' | 'reworded' | 'needs context'; qc2Reason?: string }
export type AgentItem = Line & { key: string; action?: string }
export type AgentBlock = { summary: Line; items: AgentItem[] }
export type WardAgents = {
  triage?: AgentBlock
  auditor?: AgentBlock
  planner?: AgentBlock
  brief?: { morning: Line; corporator: Line }
}
export type Agents = {
  stats: { qc1Pass: number; qc1Fail: number; qc2Reworded: number; qc2Context: number }
  wards: Record<string, WardAgents>
}
