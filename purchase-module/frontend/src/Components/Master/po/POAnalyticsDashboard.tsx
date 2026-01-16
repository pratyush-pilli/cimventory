import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  AttachMoney,
  Assessment,
  Speed,
  Business,
  Assignment,
  CheckCircle,
  Warning,
  Timeline,
  Insights,
  AccountBalance,
  LocalShipping,
  Star,
} from "@mui/icons-material";
import axios from "axios";
import dayjs from "dayjs";
import configuration from "../../../configuration";

type POInwardStatus = "open" | "partially_inwarded" | "completed";
type POStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "ordered"
  | "delivered"
  | "cancelled";

interface PurchaseOrderData {
  po_number: string;
  po_date: string;
  vendor_name: string;
  project_code: string;
  total_amount: number;
  status: POStatus;
  inward_status: POInwardStatus;
  approval_status: boolean;
  approval_date: string | null;
  created_at: string;
  line_items: any[];
}

interface AnalyticsData {
  totalPOs: number;
  totalValue: number;
  completedPOs: number;
  openPOs: number;
  partiallyInwardedPOs: number;
  averageTurnAroundTime: number;
  vendorAnalytics: VendorAnalytics[];
  projectAnalytics: ProjectAnalytics[];
  monthlyTrends: MonthlyTrend[];
  statusDistribution: StatusDistribution[];
}

interface VendorAnalytics {
  vendor_name: string;
  total_pos: number;
  total_value: number;
  avg_turnaround: number;
  completion_rate: number;
}

interface ProjectAnalytics {
  project_code: string;
  total_pos: number;
  total_value: number;
  completion_rate: number;
  avg_amount_per_po: number;
}

interface MonthlyTrend {
  month: string;
  total_pos: number;
  total_value: number;
  completed_pos: number;
}

interface StatusDistribution {
  status: string;
  count: number;
  value: number;
}

const POAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // Color schemes for charts
  const COLORS = {
    primary: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"],
    status: {
      completed: "#10b981",
      open: "#3b82f6", 
      partially_inwarded: "#f59e0b",
      approved: "#10b981",
      pending_approval: "#f59e0b",
      rejected: "#ef4444",
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedTimeFrame]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all PO data (same as in POFilter component)
      const response = await axios.get(
        `${configuration.api_url}/project-codes-with-po-details/`
      );

      // Process and enrich data with inward status
      const enrichedPOs = await Promise.all(
        response.data.map(async (po: any) => {
          try {
            const statusResponse = await axios.get(
              `${configuration.api_url}/po-inward-status/${po.po_number}/`
            );
            return {
              ...po,
              inward_status: statusResponse.data?.status || "open",
              line_items: po.line_items || [],
            };
          } catch (error) {
            return {
              ...po,
              inward_status: "open" as POInwardStatus,
              line_items: po.line_items || [],
            };
          }
        })
      );

      // Filter only approved POs
      const approvedPOs = enrichedPOs.filter(po => po.approval_status === true);
      
      // Apply time frame filter
      let filteredPOs = approvedPOs;
      if (selectedTimeFrame !== "all") {
        const now = dayjs();
        const filterDate = selectedTimeFrame === "6months" 
          ? now.subtract(6, "months")
          : selectedTimeFrame === "1year"
          ? now.subtract(1, "year")
          : now.subtract(3, "months");
        
        filteredPOs = approvedPOs.filter(po => 
          dayjs(po.po_date).isAfter(filterDate)
        );
      }

      // Calculate analytics
      const analytics = calculateAnalytics(filteredPOs);
      setAnalyticsData(analytics);

    } catch (error) {
      console.error("Error fetching analytics data:", error);
      setError("Failed to fetch analytics data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAnalytics = (pos: PurchaseOrderData[]): AnalyticsData => {
    const totalPOs = pos.length;
    const totalValue = pos.reduce((sum, po) => sum + po.total_amount, 0);
    
    // Status counts
    const completedPOs = pos.filter(po => po.inward_status === "completed").length;
    const openPOs = pos.filter(po => po.inward_status === "open").length;
    const partiallyInwardedPOs = pos.filter(po => po.inward_status === "partially_inwarded").length;

    // Calculate average turnaround time for completed POs
    const completedPOsWithDates = pos.filter(po => 
      po.inward_status === "completed" && po.approval_date
    );
    
    const totalTurnAroundTime = completedPOsWithDates.reduce((sum, po) => {
      const approvalDate = dayjs(po.approval_date);
      const completionDate = dayjs(); // Using current date as completion date
      return sum + completionDate.diff(approvalDate, "days");
    }, 0);

    const averageTurnAroundTime = completedPOsWithDates.length > 0 
      ? Math.round(totalTurnAroundTime / completedPOsWithDates.length)
      : 0;

    // Vendor Analytics
    const vendorMap = new Map<string, {
      total_pos: number;
      total_value: number;
      completed_pos: number;
      turnaround_times: number[];
    }>();

    pos.forEach(po => {
      const vendor = po.vendor_name;
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, {
          total_pos: 0,
          total_value: 0,
          completed_pos: 0,
          turnaround_times: []
        });
      }
      
      const vendorData = vendorMap.get(vendor)!;
      vendorData.total_pos += 1;
      vendorData.total_value += po.total_amount;
      
      if (po.inward_status === "completed") {
        vendorData.completed_pos += 1;
        if (po.approval_date) {
          const turnaroundDays = dayjs().diff(dayjs(po.approval_date), "days");
          vendorData.turnaround_times.push(turnaroundDays);
        }
      }
    });

    const vendorAnalytics: VendorAnalytics[] = Array.from(vendorMap.entries())
      .map(([vendor_name, data]) => ({
        vendor_name,
        total_pos: data.total_pos,
        total_value: data.total_value,
        completion_rate: (data.completed_pos / data.total_pos) * 100,
        avg_turnaround: data.turnaround_times.length > 0
          ? data.turnaround_times.reduce((a, b) => a + b, 0) / data.turnaround_times.length
          : 0
      }))
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, 10);

    // Project Analytics
    const projectMap = new Map<string, {
      total_pos: number;
      total_value: number;
      completed_pos: number;
    }>();

    pos.forEach(po => {
      const project = po.project_code;
      if (!projectMap.has(project)) {
        projectMap.set(project, {
          total_pos: 0,
          total_value: 0,
          completed_pos: 0
        });
      }
      
      const projectData = projectMap.get(project)!;
      projectData.total_pos += 1;
      projectData.total_value += po.total_amount;
      
      if (po.inward_status === "completed") {
        projectData.completed_pos += 1;
      }
    });

    const projectAnalytics: ProjectAnalytics[] = Array.from(projectMap.entries())
      .map(([project_code, data]) => ({
        project_code,
        total_pos: data.total_pos,
        total_value: data.total_value,
        completion_rate: (data.completed_pos / data.total_pos) * 100,
        avg_amount_per_po: data.total_value / data.total_pos
      }))
      .sort((a, b) => b.total_value - a.total_value);

    // Monthly Trends (last 12 months)
    const monthlyMap = new Map<string, {
      total_pos: number;
      total_value: number;
      completed_pos: number;
    }>();

    for (let i = 11; i >= 0; i--) {
      const month = dayjs().subtract(i, "months").format("MMM YYYY");
      monthlyMap.set(month, {
        total_pos: 0,
        total_value: 0,
        completed_pos: 0
      });
    }

    pos.forEach(po => {
      const month = dayjs(po.po_date).format("MMM YYYY");
      if (monthlyMap.has(month)) {
        const monthData = monthlyMap.get(month)!;
        monthData.total_pos += 1;
        monthData.total_value += po.total_amount;
        
        if (po.inward_status === "completed") {
          monthData.completed_pos += 1;
        }
      }
    });

    const monthlyTrends: MonthlyTrend[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        total_pos: data.total_pos,
        total_value: data.total_value,
        completed_pos: data.completed_pos
      }));

    // Status Distribution
    const statusMap = new Map<string, { count: number; value: number }>();
    
    pos.forEach(po => {
      const status = po.inward_status;
      if (!statusMap.has(status)) {
        statusMap.set(status, { count: 0, value: 0 });
      }
      const statusData = statusMap.get(status)!;
      statusData.count += 1;
      statusData.value += po.total_amount;
    });

    const statusDistribution: StatusDistribution[] = Array.from(statusMap.entries())
      .map(([status, data]) => ({
        status,
        count: data.count,
        value: data.value
      }));

    return {
      totalPOs,
      totalValue,
      completedPOs,
      openPOs,
      partiallyInwardedPOs,
      averageTurnAroundTime,
      vendorAnalytics,
      projectAnalytics,
      monthlyTrends,
      statusDistribution
    };
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalyticsData();
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100000).toFixed(2)}L`; // Format in Lakhs
  };

  const formatLargeCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)}Cr`;
    }
    return `₹${(amount / 100000).toFixed(2)}L`;
  };

  if (loading && !analyticsData) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" action={
          <Button onClick={fetchAnalyticsData} size="small">Retry</Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!analyticsData) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">No data available</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#1e293b" }}>
            Purchase Order Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive insights and performance metrics
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Time Frame</InputLabel>
            <Select
              value={selectedTimeFrame}
              label="Time Frame"
              onChange={(e) => setSelectedTimeFrame(e.target.value)}
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="3months">Last 3 Months</MenuItem>
              <MenuItem value="6months">Last 6 Months</MenuItem>
              <MenuItem value="1year">Last Year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={handleRefresh}
            disabled={refreshing}
            startIcon={refreshing ? <CircularProgress size={16} /> : <Timeline />}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </Stack>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {analyticsData.totalPOs.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Purchase Orders
                  </Typography>
                </Box>
                <Assignment />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", color: "white" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {formatLargeCurrency(analyticsData.totalValue)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total PO Value
                  </Typography>
                </Box>
                <AttachMoney />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", color: "white" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {Math.round((analyticsData.completedPOs / analyticsData.totalPOs) * 100)}%
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Completion Rate
                  </Typography>
                </Box>
                <CheckCircle />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", color: "white" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {analyticsData.averageTurnAroundTime}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Avg. Turnaround (Days)
                  </Typography>
                </Box>
                <Speed />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts and Analytics Sections */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <Assessment />
                Status Distribution
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: "#10b981", borderRadius: "50%" }} />
                    <Typography variant="body2">Completed</Typography>
                  </Box>
                  <Chip 
                    label={`${analyticsData.completedPOs} (${Math.round((analyticsData.completedPOs / analyticsData.totalPOs) * 100)}%)`}
                    size="small" 
                    sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}
                  />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: "#3b82f6", borderRadius: "50%" }} />
                    <Typography variant="body2">Open</Typography>
                  </Box>
                  <Chip 
                    label={`${analyticsData.openPOs} (${Math.round((analyticsData.openPOs / analyticsData.totalPOs) * 100)}%)`}
                    size="small" 
                    sx={{ bgcolor: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}
                  />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: "#f59e0b", borderRadius: "50%" }} />
                    <Typography variant="body2">Partially Inwarded</Typography>
                  </Box>
                  <Chip 
                    label={`${analyticsData.partiallyInwardedPOs} (${Math.round((analyticsData.partiallyInwardedPOs / analyticsData.totalPOs) * 100)}%)`}
                    size="small" 
                    sx={{ bgcolor: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                PO Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={analyticsData.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    label={(entry) => `${entry.status.replace('_', ' ').toUpperCase()}: ${entry.count}`}
                  >
                    {analyticsData.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly Trends */}
      <Card elevation={3} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
            <TrendingUp />
            Monthly Trends
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" orientation="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'total_value' ? formatCurrency(Number(value)) : value,
                  name === 'total_pos' ? 'Total POs' : 
                  name === 'completed_pos' ? 'Completed POs' : 'Total Value'
                ]}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="total_pos"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Total POs"
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="completed_pos"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.6}
                name="Completed POs"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="total_value"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ r: 4 }}
                name="Total Value"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Vendor and Project Analytics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Top Vendors */}
        <Grid item xs={12} lg={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <Business />
                Top Vendors by Value
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.vendorAnalytics.slice(0, 8)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis dataKey="vendor_name" type="category" width={120} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Total Value"]} />
                  <Bar dataKey="total_value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Projects */}
        <Grid item xs={12} lg={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <AccountBalance />
                Project Performance
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.projectAnalytics.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="project_code" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Total Value"]} />
                  <Bar dataKey="total_value" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Tables */}
      <Grid container spacing={3}>
        {/* Vendor Performance Table */}
        <Grid item xs={12} lg={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <Star />
                Vendor Performance Details
              </Typography>
              <TableContainer component={Paper} elevation={1}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: "#f1f5f9" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Vendor</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>POs</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Value</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Completion %</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Avg TAT</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyticsData.vendorAnalytics.slice(0, 10).map((vendor, index) => (
                      <TableRow key={vendor.vendor_name} hover>
                        <TableCell>{vendor.vendor_name}</TableCell>
                        <TableCell align="right">{vendor.total_pos}</TableCell>
                        <TableCell align="right">{formatCurrency(vendor.total_value)}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${Math.round(vendor.completion_rate)}%`}
                            size="small"
                            color={vendor.completion_rate >= 80 ? "success" : vendor.completion_rate >= 60 ? "warning" : "error"}
                          />
                        </TableCell>
                        <TableCell align="right">{Math.round(vendor.avg_turnaround)} days</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Project Analytics Table */}
        <Grid item xs={12} lg={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <Insights />
                Project Insights
              </Typography>
              <TableContainer component={Paper} elevation={1}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: "#f1f5f9" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>POs</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Total Value</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Avg/PO</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Completion %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyticsData.projectAnalytics.slice(0, 10).map((project, index) => (
                      <TableRow key={project.project_code} hover>
                        <TableCell>{project.project_code}</TableCell>
                        <TableCell align="right">{project.total_pos}</TableCell>
                        <TableCell align="right">{formatCurrency(project.total_value)}</TableCell>
                        <TableCell align="right">{formatCurrency(project.avg_amount_per_po)}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${Math.round(project.completion_rate)}%`}
                            size="small"
                            color={project.completion_rate >= 80 ? "success" : project.completion_rate >= 60 ? "warning" : "error"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Key Insights Section */}
      <Card elevation={3} sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
            <Insights />
            Key Insights & Recommendations
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: "#f0f9ff", borderRadius: 2, border: "1px solid #bae6fd" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "#0369a1" }}>
                  Performance Highlights
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "#10b981", width: 32, height: 32 }}>
                        <CheckCircle />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={`${Math.round((analyticsData.completedPOs / analyticsData.totalPOs) * 100)}% completion rate achieved`}
                      secondary={`${analyticsData.completedPOs} out of ${analyticsData.totalPOs} POs completed`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "#3b82f6", width: 32, height: 32 }}>
                        <Speed />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={`Average turnaround time: ${analyticsData.averageTurnAroundTime} days`}
                      secondary={analyticsData.averageTurnAroundTime <= 30 ? "Excellent performance" : "Room for improvement"}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "#8b5cf6", width: 32, height: 32 }}>
                        <AttachMoney />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={`Total procurement value: ${formatLargeCurrency(analyticsData.totalValue)}`}
                      secondary={`Average PO value: ${formatCurrency(analyticsData.totalValue / analyticsData.totalPOs)}`}
                    />
                  </ListItem>
                </List>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: "#fefce8", borderRadius: 2, border: "1px solid #fde047" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "#a16207" }}>
                  Actionable Recommendations
                </Typography>
                <List dense>
                  {analyticsData.openPOs > analyticsData.completedPOs && (
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: "#f59e0b", width: 32, height: 32 }}>
                          <Warning />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary="High number of open POs"
                        secondary={`${analyticsData.openPOs} POs need attention for completion`}
                      />
                    </ListItem>
                  )}
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "#06b6d4", width: 32, height: 32 }}>
                        <TrendingUp />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="Top performing vendor"
                      secondary={`${analyticsData.vendorAnalytics[0]?.vendor_name} with ${Math.round(analyticsData.vendorAnalytics[0]?.completion_rate || 0)}% completion rate`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "#84cc16", width: 32, height: 32 }}>
                        <LocalShipping />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="Focus on procurement efficiency"
                      secondary={`Monitor ${analyticsData.partiallyInwardedPOs} partially inwarded POs`}
                    />
                  </ListItem>
                </List>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default POAnalyticsDashboard;
