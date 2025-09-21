export interface Phase {
  id?: string
  name: string
  phase_type: 'og' | 'whitelist' | 'public' | 'custom'
  price: number
  startDate: string
  endDate?: string
  mint_limit?: number
  allowed_wallets?: string[]
}
