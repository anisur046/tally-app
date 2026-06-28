import { GROUP_MAP, LEDGER_SUBGROUPS, LEDGER_GROUPS } from './mockData';

// Calculate the net balance of a single ledger
export function getLedgerBalance(ledger, transactions) {
  let drTotal = 0;
  let crTotal = 0;

  // Add opening balance
  if (ledger.balanceType === 'Dr') {
    drTotal += ledger.openingBalance || 0;
  } else {
    crTotal += ledger.openingBalance || 0;
  }

  // Add transaction postings
  transactions.forEach((tx) => {
    if (tx.ledgerPostings) {
      tx.ledgerPostings.forEach((post) => {
        if (post.ledgerId === ledger.id) {
          if (post.type === 'Dr') {
            drTotal += Number(post.amount);
          } else if (post.type === 'Cr') {
            crTotal += Number(post.amount);
          }
        }
      });
    }
  });

  const primaryGroup = GROUP_MAP[ledger.subgroup] || LEDGER_GROUPS.ASSETS;

  // Determine standard normal balance type
  // Assets & Expenses are normally Debit
  // Liabilities & Incomes are normally Credit
  const isNormalDr = primaryGroup === LEDGER_GROUPS.ASSETS || primaryGroup === LEDGER_GROUPS.EXPENSES;

  if (isNormalDr) {
    const net = drTotal - crTotal;
    return {
      amount: Math.abs(net),
      type: net >= 0 ? 'Dr' : 'Cr',
      drTotal,
      crTotal
    };
  } else {
    const net = crTotal - drTotal;
    return {
      amount: Math.abs(net),
      type: net >= 0 ? 'Cr' : 'Dr',
      drTotal,
      crTotal
    };
  }
}

// Calculate closing stock and COGS using FIFO valuation
export function calculateInventoryValuation(stockItems, transactions) {
  const valuation = {};

  // Initialize with opening stock batches
  stockItems.forEach((item) => {
    valuation[item.id] = {
      item,
      batches: item.openingQty > 0 ? [{ qty: item.openingQty, rate: item.openingRate, date: 'Opening' }] : [],
      inwardsQty: item.openingQty || 0,
      inwardsVal: (item.openingQty || 0) * (item.openingRate || 0),
      outwardsQty: 0,
      outwardsVal: 0,
      cogs: 0
    };
  });

  // Sort transactions by date to ensure proper FIFO chronological sequence
  const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedTx.forEach((tx) => {
    if (!tx.items || tx.items.length === 0) return;

    if (tx.voucherType === 'Purchase') {
      tx.items.forEach((line) => {
        const val = valuation[line.stockItemId];
        if (!val) return;

        val.batches.push({
          qty: Number(line.qty),
          rate: Number(line.rate),
          date: tx.date
        });
        val.inwardsQty += Number(line.qty);
        val.inwardsVal += Number(line.qty) * Number(line.rate);
      });
    } else if (tx.voucherType === 'Sales') {
      tx.items.forEach((line) => {
        const val = valuation[line.stockItemId];
        if (!val) return;

        let qtyToConsume = Number(line.qty);
        let saleValue = Number(line.qty) * Number(line.rate);
        let costValue = 0;

        val.outwardsQty += qtyToConsume;
        val.outwardsVal += saleValue;

        // FIFO consumption
        while (qtyToConsume > 0 && val.batches.length > 0) {
          const firstBatch = val.batches[0];
          if (firstBatch.qty <= qtyToConsume) {
            costValue += firstBatch.qty * firstBatch.rate;
            qtyToConsume -= firstBatch.qty;
            val.batches.shift(); // Remove empty batch
          } else {
            costValue += qtyToConsume * firstBatch.rate;
            firstBatch.qty -= qtyToConsume;
            qtyToConsume = 0;
          }
        }

        // If sales exceed purchases (negative stock), value the excess at the current sale rate or purchase rate
        if (qtyToConsume > 0) {
          const fallbackRate = val.item.purchaseRate || 0;
          costValue += qtyToConsume * fallbackRate;
        }

        val.cogs += costValue;
      });
    }
  });

  // Compile final stock valuations
  const stockSummary = {};
  let totalClosingStockValue = 0;

  Object.keys(valuation).forEach((itemId) => {
    const val = valuation[itemId];
    const closingQty = val.batches.reduce((sum, b) => sum + b.qty, 0);
    const closingValue = val.batches.reduce((sum, b) => sum + (b.qty * b.rate), 0);

    totalClosingStockValue += closingValue;

    stockSummary[itemId] = {
      id: itemId,
      name: val.item.name,
      unit: val.item.unit,
      openingQty: val.item.openingQty || 0,
      openingVal: (val.item.openingQty || 0) * (val.item.openingRate || 0),
      inwardsQty: val.inwardsQty - (val.item.openingQty || 0),
      inwardsVal: val.inwardsVal - ((val.item.openingQty || 0) * (val.item.openingRate || 0)),
      outwardsQty: val.outwardsQty,
      outwardsVal: val.outwardsVal,
      closingQty,
      closingRate: closingQty > 0 ? (closingValue / closingQty) : val.item.purchaseRate || 0,
      closingVal: closingValue,
      cogs: val.cogs
    };
  });

  return {
    stockSummary,
    totalClosingStockValue
  };
}

// Generate Trial Balance report
export function getTrialBalance(ledgers, transactions) {
  let totalDr = 0;
  let totalCr = 0;

  const rows = ledgers.map((ledger) => {
    const bal = getLedgerBalance(ledger, transactions);
    const dr = bal.type === 'Dr' ? bal.amount : 0;
    const cr = bal.type === 'Cr' ? bal.amount : 0;
    totalDr += dr;
    totalCr += cr;

    return {
      id: ledger.id,
      name: ledger.name,
      subgroup: ledger.subgroup,
      dr,
      cr
    };
  });

  return {
    rows,
    totalDr,
    totalCr,
    isBalanced: Math.abs(totalDr - totalCr) < 0.01
  };
}

// Generate Profit & Loss Statement
export function getProfitAndLoss(ledgers, transactions, stockItems) {
  // 1. Get Inventory Closing Stock
  const { stockSummary, totalClosingStockValue } = calculateInventoryValuation(stockItems, transactions);

  let openingStockValue = stockItems.reduce((sum, item) => sum + (item.openingQty * item.openingRate), 0);

  // 2. Classify Sales & Purchases
  let salesTotal = 0;
  let purchasesTotal = 0;
  let directExpenses = 0;
  let directIncomes = 0;
  let indirectExpenses = [];
  let indirectIncomes = [];

  let indirectExpensesTotal = 0;
  let indirectIncomesTotal = 0;

  ledgers.forEach((ledger) => {
    const bal = getLedgerBalance(ledger, transactions);
    if (ledger.subgroup === LEDGER_SUBGROUPS.SALES) {
      salesTotal += bal.amount;
    } else if (ledger.subgroup === LEDGER_SUBGROUPS.PURCHASE) {
      purchasesTotal += bal.amount;
    } else if (ledger.subgroup === LEDGER_SUBGROUPS.DIRECT_EXPENSES) {
      directExpenses += bal.amount;
    } else if (ledger.subgroup === LEDGER_SUBGROUPS.INDIRECT_EXPENSES) {
      indirectExpenses.push({ name: ledger.name, amount: bal.amount });
      indirectExpensesTotal += bal.amount;
    } else if (ledger.subgroup === LEDGER_SUBGROUPS.INDIRECT_INCOMES) {
      indirectIncomes.push({ name: ledger.name, amount: bal.amount });
      indirectIncomesTotal += bal.amount;
    }
  });

  // Trading Account Calculations
  const costOfGoodsSold = openingStockValue + purchasesTotal + directExpenses - totalClosingStockValue;
  const grossProfit = salesTotal - costOfGoodsSold;

  // Net Profit
  const netProfit = grossProfit + indirectIncomesTotal - indirectExpensesTotal;

  return {
    openingStockValue,
    purchasesTotal,
    directExpenses,
    salesTotal,
    closingStockValue: totalClosingStockValue,
    costOfGoodsSold,
    grossProfit,
    indirectExpenses,
    indirectExpensesTotal,
    indirectIncomes,
    indirectIncomesTotal,
    netProfit
  };
}

// Generate Balance Sheet
export function getBalanceSheet(ledgers, transactions, stockItems) {
  const { totalClosingStockValue } = calculateInventoryValuation(stockItems, transactions);
  const pl = getProfitAndLoss(ledgers, transactions, stockItems);
  const netProfit = pl.netProfit;

  const assetsList = [];
  const liabilitiesList = [];

  let totalAssets = 0;
  let totalLiabilities = 0;

  // Add Closing Stock first to Assets
  assetsList.push({ name: 'Closing Stock (Valued at FIFO)', amount: totalClosingStockValue, subgroup: 'Stock-in-Hand' });
  totalAssets += totalClosingStockValue;

  ledgers.forEach((ledger) => {
    const bal = getLedgerBalance(ledger, transactions);
    if (bal.amount === 0 && ledger.openingBalance === 0) return;

    const primaryGroup = GROUP_MAP[ledger.subgroup];

    if (primaryGroup === LEDGER_GROUPS.ASSETS) {
      // Exclude zero-balance customers/banks if they are completely empty
      assetsList.push({ name: ledger.name, amount: bal.amount, subgroup: ledger.subgroup });
      totalAssets += bal.amount;
    } else if (primaryGroup === LEDGER_GROUPS.LIABILITIES) {
      liabilitiesList.push({ name: ledger.name, amount: bal.amount, subgroup: ledger.subgroup });
      totalLiabilities += bal.amount;
    }
  });

  // Add Net Profit to Liabilities (under reserves/surplus)
  liabilitiesList.push({ name: 'Profit & Loss A/c (Net Profit)', amount: netProfit, subgroup: 'Reserves & Surplus', isProfitShare: true });
  totalLiabilities += netProfit;

  return {
    assetsList,
    liabilitiesList,
    totalAssets,
    totalLiabilities,
    isBalanced: Math.abs(totalAssets - totalLiabilities) < 0.01
  };
}
