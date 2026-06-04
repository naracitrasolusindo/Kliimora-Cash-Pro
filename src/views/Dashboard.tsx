import React, { useEffect, useState } from 'react';
import { Typography, Grid, Paper, Box, Avatar, Chip } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { getDb } from '../lib/db';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalKas: 0,
    totalPiutang: 0,
    totalAset: 0,
    labaBersihBulanIni: 0,
    momGrowth: 0,
    marginLaba: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const db = await getDb();
        
        const kas = await db.select<any[]>(`
          SELECT SUM(a.initial_balance) + COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as total
          FROM accounts a LEFT JOIN journal_lines jl ON a.id = jl.account_id
          WHERE a.code LIKE '1101%'
        `);

        const piutang = await db.select<any[]>(`
          SELECT SUM(a.initial_balance) + COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as total
          FROM accounts a LEFT JOIN journal_lines jl ON a.id = jl.account_id
          WHERE a.code LIKE '1102%'
        `);

        const aset = await db.select<any[]>(`
          SELECT SUM(a.initial_balance) + COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as total
          FROM accounts a LEFT JOIN journal_lines jl ON a.id = jl.account_id
          WHERE a.code LIKE '1%'
        `);

        const currentMonthDate = new Date();
        const currentMonth = currentMonthDate.toISOString().substring(0, 7) + '%';
        
        const lastMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
        const lastMonthStr = lastMonthDate.toISOString().substring(0, 7) + '%';
        
        const incomeMonth = await db.select<any[]>(`
          SELECT COALESCE(SUM(jl.credit) - SUM(jl.debit), 0) as total
          FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id
          WHERE a.type = 'revenue' AND je.date LIKE $1 AND je.is_closing = 0
        `, [currentMonth]);

        const expenseMonth = await db.select<any[]>(`
          SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) as total
          FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id
          WHERE a.type = 'expense' AND je.date LIKE $1 AND je.is_closing = 0
        `, [currentMonth]);

        const incomeLastMonth = await db.select<any[]>(`
          SELECT COALESCE(SUM(jl.credit) - SUM(jl.debit), 0) as total
          FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id
          WHERE a.type = 'revenue' AND je.date LIKE $1 AND je.is_closing = 0
        `, [lastMonthStr]);

        const expenseLastMonth = await db.select<any[]>(`
          SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) as total
          FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id
          WHERE a.type = 'expense' AND je.date LIKE $1 AND je.is_closing = 0
        `, [lastMonthStr]);

        const netIncome = (incomeMonth[0]?.total || 0) - (expenseMonth[0]?.total || 0);
        const netIncomeLastMonth = (incomeLastMonth[0]?.total || 0) - (expenseLastMonth[0]?.total || 0);
        
        let momGrowth = 0;
        if (netIncomeLastMonth !== 0) {
          momGrowth = ((netIncome - netIncomeLastMonth) / Math.abs(netIncomeLastMonth)) * 100;
        } else if (netIncome > 0) {
          momGrowth = 100;
        }

        const marginLaba = (incomeMonth[0]?.total || 0) > 0 ? (netIncome / incomeMonth[0].total) * 100 : 0;

        setStats({
          totalKas: kas[0]?.total || 0,
          totalPiutang: piutang[0]?.total || 0,
          totalAset: aset[0]?.total || 0,
          labaBersihBulanIni: netIncome,
          momGrowth,
          marginLaba,
        });

        const expensesTop = await db.select<any[]>(`
          SELECT a.name as name, COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) as value
          FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id
          WHERE a.type = 'expense' AND je.date LIKE $1 AND je.is_closing = 0
          GROUP BY a.id ORDER BY value DESC LIMIT 5
        `, [currentMonth]);
        
        setExpenseData(expensesTop.filter(e => e.value > 0));

        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - i, 1);
          months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString('id-ID', { month: 'short' }) + ' ' + d.getFullYear() });
        }

        const newChartData = [];
        for (const m of months) {
          const monthStr = m.month.toString().padStart(2, '0');
          const likeStr = `${m.year}-${monthStr}%`;
          
          const inc = await db.select<any[]>(`SELECT COALESCE(SUM(jl.credit) - SUM(jl.debit), 0) as total FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id WHERE a.type = 'revenue' AND je.date LIKE $1 AND je.is_closing = 0`, [likeStr]);
          const exp = await db.select<any[]>(`SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) as total FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id WHERE a.type = 'expense' AND je.date LIKE $1 AND je.is_closing = 0`, [likeStr]);

          newChartData.push({
            name: m.label,
            Pendapatan: inc[0]?.total || 0,
            Pengeluaran: exp[0]?.total || 0,
            Laba: (inc[0]?.total || 0) - (exp[0]?.total || 0)
          });
        }
        setChartData(newChartData);

      } catch (err) {
        console.error(err);
      }
    }
    loadStats();
  }, []);

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="800" color="text.primary">Dashboard</Typography>
        <Typography variant="subtitle1" color="text.secondary">Ringkasan Sistem Keuangan Anda</Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', bgcolor: 'background.paper' }}>
            <Avatar sx={{ bgcolor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', width: 50, height: 50, mr: 2 }}>
              <AccountBalanceWalletIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">Total Kas & Bank</Typography>
              <Typography variant="h6" fontWeight="800">{formatRupiah(stats.totalKas)}</Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', bgcolor: 'background.paper' }}>
            <Avatar sx={{ bgcolor: 'rgba(33, 150, 243, 0.1)', color: '#2196f3', width: 50, height: 50, mr: 2 }}>
              <PointOfSaleIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">Total Piutang</Typography>
              <Typography variant="h6" fontWeight="800">{formatRupiah(stats.totalPiutang)}</Typography>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', bgcolor: 'background.paper' }}>
            <Avatar sx={{ bgcolor: 'rgba(255, 152, 0, 0.1)', color: '#ff9800', width: 50, height: 50, mr: 2 }}>
              <BusinessCenterIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">Total Aset</Typography>
              <Typography variant="h6" fontWeight="800">{formatRupiah(stats.totalAset)}</Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center', 
            borderRadius: 3, 
            boxShadow: '0 10px 30px rgba(33, 203, 243, 0.3)', 
            background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)',
            color: 'white'
          }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', width: 50, height: 50, mr: 2 }}>
              <TrendingUpIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.9 }} fontWeight={600} textTransform="uppercase">Laba Bulan Ini</Typography>
              <Typography variant="h6" fontWeight="800" sx={{ lineHeight: 1.2 }}>{formatRupiah(stats.labaBersihBulanIni)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.2)', px: 0.8, py: 0.2, borderRadius: 1 }}>
                  {stats.momGrowth >= 0 ? <ArrowUpwardIcon sx={{ fontSize: 14, mr: 0.3 }} /> : <ArrowDownwardIcon sx={{ fontSize: 14, mr: 0.3 }} />}
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                    {Math.abs(stats.momGrowth).toFixed(1)}%
                  </Typography>
                </Box>
                <Chip size="small" label={`NPM: ${stats.marginLaba.toFixed(1)}%`} sx={{ ml: 1, height: 20, fontSize: '0.65rem', bgcolor: 'rgba(0,0,0,0.2)', color: 'white', fontWeight: 'bold' }} />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', mb: 3 }}>
            <Typography variant="h6" fontWeight="700" color="text.primary" gutterBottom>Tren Laba Bersih (6 Bulan Terakhir)</Typography>
            <Box sx={{ height: 300, mt: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLaba" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2196f3" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2196f3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#666' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `Rp ${(value/1000000).toFixed(0)}M`} tick={{ fill: '#666' }} />
                  <Tooltip formatter={(value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value)} />
                  <Area type="monotone" dataKey="Laba" stroke="#2196f3" strokeWidth={3} fillOpacity={1} fill="url(#colorLaba)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}>
            <Typography variant="h6" fontWeight="700" color="text.primary" gutterBottom>Pendapatan vs Pengeluaran</Typography>
            <Box sx={{ height: 300, mt: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#666' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `Rp ${(value/1000000).toFixed(0)}M`} tick={{ fill: '#666' }} />
                  <Tooltip formatter={(value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value)} cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="Pendapatan" fill="#4caf50" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Pengeluaran" fill="#f44336" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', height: '100%' }}>
            <Typography variant="h6" fontWeight="700" color="text.primary" gutterBottom>Top 5 Pengeluaran Bulan Ini</Typography>
            {expenseData.length === 0 ? (
              <Box sx={{ display: 'flex', height: 250, alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">Belum ada pengeluaran.</Typography>
              </Box>
            ) : (
              <Box sx={{ height: 300, mt: 2, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {expenseData.map((entry, index) => {
                        const COLORS = ['#f44336', '#ff9800', '#ffc107', '#2196f3', '#9c27b0'];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatRupiah(value)} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
