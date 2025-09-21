export interface Phase {
  id?: string
  name: string
  phase_type: 'og' | 'whitelist' | 'public' | 'custom'
  price: number
  startDate: Date | string
  endDate?: Date | string
  mint_limit?: number
  allowed_wallets?: string[]
}
