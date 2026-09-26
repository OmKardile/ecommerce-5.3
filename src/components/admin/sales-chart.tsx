'use client';

// 30-day sales chart (recharts) — pine/brass palette consistent with the ops console.

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR } from '@/lib/money';

export interface DailySalesPoint {
  date: string;
  orders: number;
  valuePaise: number;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function SalesChart({ data, height = 280 }: { data: DailySalesPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }} role="img" aria-label="Daily sales for the last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6e1d6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: '#7c7568' }}
            axisLine={{ stroke: '#e6e1d6' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            yAxisId="value"
            tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11, fill: '#7c7568' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 11, fill: '#a15c07' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'Sales') return formatINR(Number(value));
              return [String(value), 'Orders'];
            }}
            labelFormatter={(l) => shortDate(String(l))}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e6e1d6',
              fontSize: 12,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          />
          <Bar yAxisId="orders" dataKey="orders" name="Orders" fill="#b45309" fillOpacity={0.35} barSize={6} radius={[2, 2, 0, 0]} />
          <Area
            yAxisId="value"
            type="monotone"
            dataKey="valuePaise"
            name="Sales"
            stroke="#1a3c34"
            strokeWidth={2}
            fill="#1a3c34"
            fillOpacity={0.1}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
