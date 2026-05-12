export type TransactionType   = 'receita' | 'despesa' | 'fatura' | 'transferencia'
export type TransactionStatus = 'realizado' | 'pendente' | 'agendado'
export type ResponsibleParty  = 'casal' | 'sogra'
export type PaymentMethod     = 'credito' | 'debito' | 'boleto' | 'pix' | 'dinheiro' | 'transferencia' | 'outro'
export type BankType          = 'conta' | 'credito' | 'debito' | 'dinheiro' | 'investimento'
export type CategoryType      = 'receita' | 'despesa' | 'ambos'
export type SavingsType       = 'poupança' | 'cdb' | 'lci' | 'lca' | 'tesouro' | 'fundo' | 'outro'
export type InvestmentType    = 'acao' | 'fii' | 'etf' | 'cripto' | 'renda_fixa' | 'fundo' | 'outro'
export type InvestmentTxType  = 'compra' | 'venda' | 'dividendo'

export interface Household { id: string; name: string; created_at: string }

export interface Profile {
  id: string; household_id: string; name: string
  email?: string | null; role?: 'admin' | 'member'; avatar_color: string; avatar_emoji: string; avatar_url?: string | null; created_at: string
}

export interface Category {
  id: string; household_id: string; name: string
  type: CategoryType; icon: string; color: string; is_default: boolean
}

export interface Bank {
  id: string; household_id: string; name: string
  type: BankType; color: string; icon: string; is_default: boolean
  limit_amount?: number | null
  due_day?: number | null
  closing_day?: number | null
  opening_day?: number | null
  current_balance?: number | null
  balance_tracking_started_at?: string | null
}

export interface Transaction {
  id: string; household_id: string; created_by: string; date: string
  description: string; amount: number; type: TransactionType
  category_id: string | null; bank_id: string | null; status: TransactionStatus
  notes: string | null; is_recurring: boolean; month: string; year: number; created_at: string
  recurring_group_id?: string | null
  recurring_index?: number | null
  recurring_total?: number | null
  responsible_party?: ResponsibleParty
  is_reimbursed?: boolean
  payment_method?: PaymentMethod
  category?: Category; bank?: Bank; profile?: Profile
}

export interface Goal {
  id: string; household_id: string; name: string; description: string | null
  target_amount: number; current_amount: number; icon: string; color: string
  deadline: string | null; monthly_contribution: number; is_completed: boolean; created_at: string
}

export interface GoalContribution {
  id: string; goal_id: string; household_id: string; created_by: string
  amount: number; date: string; notes: string | null
}

export interface Budget {
  id: string; household_id: string; category_id: string
  month: number; year: number; amount: number; category?: Category
}

export interface HouseholdInvite {
  id: string; household_id: string; email: string; role: 'admin' | 'member'
  status: 'pending' | 'accepted' | 'revoked'; invited_by: string | null
  accepted_by: string | null; created_at: string; accepted_at: string | null
}

export interface Savings {
  id: string; household_id: string; name: string; institution: string | null
  type: SavingsType; current_amount: number; target_amount: number | null
  interest_rate: number | null; icon: string; color: string; notes: string | null
  created_at: string; updated_at: string
}

export interface SavingsHistory {
  id: string; savings_id: string; household_id: string
  amount: number; date: string; notes: string | null; created_at: string
}

export interface Investment {
  id: string; household_id: string; name: string; ticker: string | null
  type: InvestmentType; quantity: number; avg_price: number; current_price: number
  total_invested: number; icon: string; color: string; notes: string | null
  created_at: string; updated_at: string
}

export interface InvestmentTransaction {
  id: string; investment_id: string; household_id: string; type: InvestmentTxType
  quantity: number | null; price: number | null; amount: number; date: string; notes: string | null
}

export interface AIMessage { role: 'user' | 'assistant'; content: string; timestamp?: string }

export interface AIContext {
  current_month_income: number
  current_month_expenses: number
  current_month_balance: number
  planned_month_income?: number
  planned_month_expenses?: number
  projected_month_balance?: number
  cash_balance?: number
  bank_balances?: { name: string; type: string; balance: number }[]
  credit_card_bills?: { name: string; due_day: number | null; closing_day: number | null; amount: number }[]
  monthly_overview?: {
    month: string
    year: number
    income: number
    planned_income: number
    direct_expenses: number
    planned_direct_expenses: number
    card_invoice: number
    projected_balance: number
  }[]
  recent_transactions?: {
    id: string
    date: string
    description: string
    amount: number
    type: string
    status: string
    bank?: string | null
    category?: string | null
  }[]
  top_expense_categories: { name: string; amount: number; icon: string }[]
  goals: { name: string; target: number; current: number; icon: string }[]
  monthly_history: { month: string; income: number; expenses: number }[]
  profiles: { name: string }[]
  savings?: { name: string; type: string; amount: number; rate: number | null }[]
  investments?: { name: string; type: string; invested: number; current: number; pl: number }[]
  total_patrimony?: number
}

export interface MonthSummary {
  month: string; year: number; total_income: number; total_expenses: number; balance: number
  by_category: { category: Category; total: number }[]; transactions: Transaction[]
}

export interface DashboardData {
  current_month: MonthSummary; previous_months: MonthSummary[]
  goals: Goal[]; recent_transactions: Transaction[]; ai_daily_tip?: string
}

export interface TransactionFormData {
  date: string; description: string; amount: number; type: TransactionType
  category_id: string; bank_id: string; status: TransactionStatus; notes?: string; is_recurring: boolean; payment_method?: PaymentMethod
}

export interface GoalFormData {
  name: string; description?: string; target_amount: number
  icon: string; color: string; deadline?: string; monthly_contribution: number
}
