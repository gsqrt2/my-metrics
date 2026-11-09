const percent = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

// A % change for axes, tooltips and summaries: "+2%", "−3.8%".
export const formatPercent = (value: number) => `${percent.format(value)}%`
