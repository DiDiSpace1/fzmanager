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
  left: 58,
  right: 16,
  top: 16
};

function niceMaximum(value: number) {
  if (value <= 0) {
    return 100;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * magnitude;
}

function pointPosition(value: number, index: number, count: number, maxValue: number) {
  const usableWidth = chartWidth - padding.left - padding.right;
  const usableHeight = chartHeight - padding.top - padding.bottom;

  return {
    x: padding.left + (usableWidth / Math.max(count - 1, 1)) * index,
    y: padding.top + usableHeight - (Number(value || 0) / maxValue) * usableHeight
  };
}

function buildPath(values: number[], maxValue: number) {
  return values
    .map((value, index) => {
      const {x, y} = pointPosition(value, index, values.length, maxValue);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(values: number[], maxValue: number) {
  if (!values.length) {
    return '';
  }

  const baseline = chartHeight - padding.bottom;
  const firstX = pointPosition(values[0], 0, values.length, maxValue).x;
  const lastX = pointPosition(values[values.length - 1], values.length - 1, values.length, maxValue).x;
  return `${buildPath(values, maxValue)} L ${lastX.toFixed(1)} ${baseline} L ${firstX.toFixed(1)} ${baseline} Z`;
}

function formatAxisValue(value: number) {
  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(value >= 10000 ? 0 : 1))} k€`;
  }

  return `${Math.round(value)} €`;
}

export function RevenueExpenseChart({points}: RevenueExpenseChartProps) {
  const t = useTranslations('dashboard.chart');
  const [showRevenue, setShowRevenue] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const maxValue = useMemo(() => niceMaximum(Math.max(0, ...points.flatMap((point) => [point.revenue, point.expense]))), [points]);
  const axisTicks = useMemo(() => Array.from({length: 5}, (_, index) => (maxValue / 4) * index).reverse(), [maxValue]);
  const revenueValues = points.map((point) => point.revenue);
  const expenseValues = points.map((point) => point.expense);
  const revenuePath = buildPath(
    revenueValues,
    maxValue
  );
  const expensePath = buildPath(
    expenseValues,
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
        <svg aria-label={t('ariaLabel')} className="h-[250px] w-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
          <defs>
            <linearGradient id="revenue-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#00796b" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#00796b" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="expense-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {axisTicks.map((tick, index) => {
            const usableHeight = chartHeight - padding.top - padding.bottom;
            const y = padding.top + (usableHeight / 4) * index;

            return (
              <g key={tick}>
                <line stroke={index === axisTicks.length - 1 ? '#b9c7c2' : '#dce5e1'} strokeDasharray={index === axisTicks.length - 1 ? undefined : '3 4'} strokeWidth="1" x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} />
                <text fill="#66736f" fontSize="9" textAnchor="end" x={padding.left - 9} y={y + 3}>
                  {formatAxisValue(tick)}
                </text>
              </g>
            );
          })}
          <line stroke="#b9c7c2" strokeWidth="1" x1={padding.left} x2={padding.left} y1={padding.top} y2={chartHeight - padding.bottom} />
          {showRevenue ? <path d={buildAreaPath(revenueValues, maxValue)} fill="url(#revenue-area)" /> : null}
          {showExpense ? <path d={buildAreaPath(expenseValues, maxValue)} fill="url(#expense-area)" /> : null}
          {showRevenue ? <path d={revenuePath} fill="none" stroke="#00796b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /> : null}
          {showExpense ? <path d={expensePath} fill="none" stroke="#ba1a1a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /> : null}
          {points.map((point, index) => {
            const revenuePosition = pointPosition(point.revenue, index, points.length, maxValue);
            const expensePosition = pointPosition(point.expense, index, points.length, maxValue);

            return (
              <g key={point.label}>
                {showRevenue ? <circle cx={revenuePosition.x} cy={revenuePosition.y} fill="#ffffff" r="3.5" stroke="#00796b" strokeWidth="2.5"><title>{`${t('revenue')}: ${formatAxisValue(point.revenue)}`}</title></circle> : null}
                {showExpense ? <circle cx={expensePosition.x} cy={expensePosition.y} fill="#ffffff" r="3.5" stroke="#ba1a1a" strokeWidth="2.5"><title>{`${t('expenses')}: ${formatAxisValue(point.expense)}`}</title></circle> : null}
                <text fill="#53615e" fontSize="10" fontWeight="600" textAnchor="middle" x={revenuePosition.x} y={chartHeight - 9}>
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
