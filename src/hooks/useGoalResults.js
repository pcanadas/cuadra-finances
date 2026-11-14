import { useMemo } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useAccountStore from '../store/useAccountStore'
import useGoalStore from '../store/useGoalStore'
import useApunteStore from '../store/useApunteStore'
import { evaluateGoals } from '../insights/goals'
import { forStats } from '../utils/shared'

/** Planes de ahorro y metas evaluados con los datos actuales (ver insights/goals.js). */
export default function useGoalResults() {
  const transactions = useTransactionStore((s) => s.transactions)
  const categories = useCategoryStore((s) => s.categories)
  const accounts = useAccountStore((s) => s.accounts)
  const goals = useGoalStore((s) => s.goals)
  const apuntes = useApunteStore((s) => s.apuntes)
  return useMemo(() => evaluateGoals({
    goals,
    transactions: forStats(transactions, apuntes),
    transferCatIds: new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id)),
    ingresoCatIds: new Set(categories.filter((c) => c.esIngreso).map((c) => c.id)),
    defaultAccountId: accounts[0]?.id ?? null,
  }), [goals, transactions, apuntes, categories, accounts])
}
