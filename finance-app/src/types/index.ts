// ============================================================
// TIPOS PRINCIPAIS DO APP
// ============================================================

export type TransactionType = 'receita' | 'despesa' | 'fatura' | 'transferencia'
export type TransactionStatus = 'realizado' | 'pendente' | 'agendado'
export type BankType = 'conta' | 'credito' | 'debito' | 'dinheiro' | 'investimento'
export type CategoryType = 'receita' | 'despesa' | 'ambos'

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  household_id: string
  name: string
  avatar_color: string
  avatar_emoji: string
  created_at: string
}

export interface Category {
  id: string
  household_id: string
  name: string
  type: CategoryType
  icon: string
  color: string
  is_default: boolean
}

export interface Bank {
  id: string
  household_id: string
  name: string
  type: BankType
  color: string
  icon: string
  is_default: boolean
}

export interface Transaction {
  id: string
  household_id: string
  created_by: string
  date: string
  description: string
  amount: number
  type: TransactionType
  category_id: string | null
  bank_id: string | null
  status: TransactionStatus
  notes: string | null
  is_recurring: boolean
  month: string
  year: number
  created_at: string
  // joins
  category?: Category
  bank?: Bank
  profile?: Profile
}

export interface Goal {
  id: string
  household_id: string
  name: string
  description: string | null
  target_amount: number
  current_amount: number
  icon: string
  color: string
  deadline: string | null
  monthly_contribution: number
  is_completed: boolean
  created_at: string
}

export interface GoalContribution {
  id: string
  goal_id: string
  household_id: string
  created_by: string
  amount: number
  date: string
  notes: string | null
}

export interface Budget {
  id: string
  household_id: string
  category_id: string
  month: number
  year: number
  amount: number
  category?: Category
}

// ============================================================
// TIPOS PARA IA
// ============================================================

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface AIContext {
  current_month_income: number
  current_month_expenses: number
  current_month_balance: number
  top_expense_categories: { name: string; amount: number; icon: string }[]
  goals: { name: string; target: number; current: number; icon: string }[]
  monthly_history: { month: string; income: number; expenses: number }[]
  profiles: { name: string }[]
}

// ============================================================
// TIPOS PARA DASHBOARD
// ============================================================

export interface MonthSummary {
  month: string
  year: number
  total_income: number
  total_expenses: number
  balance: number
  by_category: { category: Category; total: number }[]
  transactions: Transaction[]
}

export interface DashboardData {
  current_month: MonthSummary
  previous_months: MonthSummary[]
  goals: Goal[]
  recent_transactions: Transaction[]
  ai_daily_tip?: string
}

// ============================================================
// TIPOS PARA FORMULÁRIOS
// ============================================================

export interface TransactionFormData {
  date: string
  description: string
  amount: number
  type: TransactionType
  category_id: string
  bank_id: string
  status: TransactionStatus
  notes?: string
  is_recurring: boolean
}

export interface GoalFormData {
  name: string
  description?: string
  target_amount: number
  icon: string
  color: string
  deadline?: string
  monthly_contribution: number
}
