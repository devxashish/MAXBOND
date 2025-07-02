// src/utils/financeCalculator.js

export const calculateFinancialSummary = (
  expenses,
  transactions,
  externals,
  startingAmounts,
  employeeTransactions,
  period
) => {
  const now = Date.now() / 1000;
  let cutoffStart = now;
  
  if (period === "daily") {
    cutoffStart = now - 86400; // 1 day
  } else if (period === "weekly") {
    cutoffStart = now - 7 * 86400; // 7 days
  } else if (period === "monthly") {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    cutoffStart = firstDay.getTime() / 1000;
  }

  const filterData = (data) => {
    return data.filter(item => {
      const itemTime = item.timestamp?.seconds;
      return itemTime >= cutoffStart;
    });
  };

  const filteredExpenses = filterData(expenses);
  const filteredTransactions = filterData(transactions);
  const filteredExternals = filterData(externals);
  const filteredStarting = filterData(startingAmounts);
  const filteredEmpTxns = filterData(employeeTransactions);
  
  // Calculate totals
  const totalStart = filteredStarting.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + Number(e.cost || 0), 0);
  
  // Calculate credits and debits
  const creditTxn = filteredTransactions
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    
  const debitTxn = filteredTransactions
    .filter(t => t.type === "debit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    
  const creditExt = filteredExternals
    .filter(x => x.type === "credit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    
  const debitExt = filteredExternals
    .filter(x => x.type === "debit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    
  const creditEmp = filteredEmpTxns
    .filter(x => x.type === "credit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    
  const debitEmp = filteredEmpTxns
    .filter(x => x.type === "debit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
  
  // Calculate final totals
  const totalCredit = creditTxn + creditExt + creditEmp;
  const totalDebit = debitTxn + debitExt + debitEmp;
  const netBalance = totalStart + totalCredit - totalExpense - totalDebit;
  
  return {
    openingBalance: totalStart,
    totalIncome: totalCredit,
    totalExpenses: totalExpense + totalDebit,
    totalCredit,
    totalDebit,
    netBalance
  };
};