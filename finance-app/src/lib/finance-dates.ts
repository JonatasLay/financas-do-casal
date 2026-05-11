import { addMonths, endOfMonth, format, isWithinInterval, setDate, startOfMonth } from 'date-fns'

export function parseLocalDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function monthRange(date: Date) {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  }
}

export function isDateInMonth(date: Date, month: Date) {
  const range = monthRange(month)
  return isWithinInterval(date, range)
}

export function getCreditCardPaymentDate(transactionDate: string, dueDay?: number | null, closingDay?: number | null) {
  const purchaseDate = parseLocalDate(transactionDate)
  const closeDay = closingDay ? Math.max(1, Math.min(closingDay, endOfMonth(purchaseDate).getDate())) : null
  const paymentMonth = closeDay && purchaseDate.getDate() <= closeDay
    ? startOfMonth(purchaseDate)
    : addMonths(startOfMonth(purchaseDate), 1)
  const safeDueDay = Math.max(1, Math.min(dueDay || 10, endOfMonth(paymentMonth).getDate()))
  return setDate(paymentMonth, safeDueDay)
}

export function toSqlDate(date: Date) {
  return format(date, 'yyyy-MM-dd')
}
