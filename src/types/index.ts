export interface Phase {
  id?: string
  name: string
  phase_type: 'og' | 'whitelist' | 'public' | 'custom'
  price: number
  start_time: string
  end_time?: string
  mint_limit?: number
  allowed_wallets?: string[]
}
