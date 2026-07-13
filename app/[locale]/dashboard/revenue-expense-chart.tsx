'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

type ChartPoint = {
  expense: number;
  label: string;
  revenue: number;
};

type RevenueExpenseChartProps = {
  points: ChartPoint[];
};

const chartWidth = 560;
const chartHeight = 220;
const padding = {
  bottom: 34,
  left: 20,
  right: 20,
  top: 28
};

function buildPath(values: number[], maxValue: number) {
  const usableWidth = chartWidth - padding.left - padding.right;
  const usableHeight = chartHeight - padding.top - padding.bottom;

  return values
    .map((value, index) => {
      const x = padding.left + (usableWidth / Math.max(values.length - 1, 1)) * index;
      const y = padding.top + usableHeight - (Number(value || 0) / maxValue) * usableHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function RevenueExpenseChart({points}: RevenueExpenseChartProps) {
  const t = useTranslations('dashboard.chart');
  const [showRevenue, setShowRevenue] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const maxValue = useMemo(() => Math.max(1, ...points.flatMap((point) => [point.revenue, point.expense])), [points]);
  const revenuePath = buildPath(
    points.map((point) => point.revenue),
    maxValue
  );
  const expensePath = buildPath(
    points.map((point) => point.expense),
    maxValue
  );

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <button className={showRevenue ? 'inline-flex items-center gap-1.5 text-[#00796b]' : 'inline-flex items-center gap-1.5 text-[var(--muted)]'} onClick={() => setShowRevenue((value) => !value)} type="button">
            <span className={showRevenue ? 'h-2.5 w-2.5 rounded-sm bg-[#00796b]' : 'h-2.5 w-2.5 rounded-sm bg-[#cfd8d4]'} />
            {t('revenue')}
          </button>
          <button className={showExpense ? 'inline-flex items-center gap-1.5 text-[#ba1a1a]' : 'inline-flex items-center gap-1.5 text-[var(--muted)]'} onClick={() => setShowExpense((value) => !value)} type="button">
            <span className={showExpense ? 'h-2.5 w-2.5 rounded-sm bg-[#ba1a1a]' : 'h-2.5 w-2.5 rounded-sm bg-[#cfd8d4]'} />
            {t('expenses')}
          </button>
        </div>
      </div>
      <div className="px-4 pb-4">
        <svg aria-label={t('ariaLabel')} className="h-[250px] w-full" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
          <line stroke="#d7e0dc" strokeWidth="1" x1={padding.left} x2={chartWidth - padding.right} y1={chartHeight - padding.bottom} y2={chartHeight - padding.bottom} />
          {showRevenue ? <path d={revenuePath} fill="none" stroke="#00796b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /> : null}
          {showExpense ? <path d={expensePath} fill="none" stroke="#ba1a1a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /> : null}
          {points.map((point, index) => {
            const x = padding.left + ((chartWidth - padding.left - padding.right) / Math.max(points.length - 1, 1)) * index;

            return (
              <text fill="#17211f" fontSize="10" fontWeight="600" key={point.label} textAnchor="middle" x={x} y={chartHeight - 8}>
                {point.label}
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
