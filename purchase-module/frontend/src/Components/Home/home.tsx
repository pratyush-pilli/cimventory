// Updated home.tsx with proper division-based data filtering

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Tooltip,
  Badge,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Button,
  Avatar,
  IconButton,
  Card,
  CardContent,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import dayjs from "dayjs";
import axios from "axios";
import configuration from "../../configuration";
import "./home.scss";
import { PickersDayProps } from "@mui/x-date-pickers/PickersDay";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PendingIcon from "@mui/icons-material/Pending";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ReceiptIcon from "@mui/icons-material/Receipt";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import InventoryIcon from "@mui/icons-material/Inventory";
import StoreIcon from "@mui/icons-material/Store";
import WarningIcon from "@mui/icons-material/Warning";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PeopleIcon from "@mui/icons-material/People";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { useNavigate } from "react-router-dom";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from "@mui/lab";

// Register Chart.js components
Chart.register(...registerables);

// In home.tsx, ensure axios is configured to send cookies
const axiosConfig = {
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
};

const HomePage = () => {
  const [loading, setLoading] = useState(true);
  const [requisitionData, setRequisitionData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [userInfo, setUserInfo] = useState({
    username: "",
    name: "",
    email: "",
    division: null,
    division_name: "",
    role: "",
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
    myRequisitions: 0,
    myPending: 0,
    urgent: 0,
  });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [divisionUsers, setDivisionUsers] = useState([]);
  const [todaysActivity, setTodaysActivity] = useState([]);
  const [urgentRequisitions, setUrgentRequisitions] = useState([]);
  const navigate = useNavigate();

  // Extract complete user info from localStorage
  useEffect(() => {
    const storedUserInfo = localStorage.getItem("userInfo");
    if (storedUserInfo) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo);
        console.log("Parsed user info:", parsedInfo);

        const newUserInfo = {
          username: parsedInfo.username || "",
          name: parsedInfo.name || parsedInfo.full_name || "",
          email: parsedInfo.email || "",
          division: parsedInfo.division || null,
          division_name: parsedInfo.division_name || "Unknown Division",
          role: parsedInfo.role || "",
        };

        console.log("Setting userInfo to:", newUserInfo);
        setUserInfo(newUserInfo);
      } catch (error) {
        console.error("Failed to parse user info:", error);
      }
    }
  }, []);

  // Check if user is admin/developer (can see all data)
  const isAdminOrDeveloper = useMemo(() => {
    return userInfo.role === "Admin" || userInfo.role === "Developer";
  }, [userInfo.role]);

  // Fetch all necessary data with division filtering
  useEffect(() => {
    const fetchAllData = async () => {
      if (!userInfo.division && !isAdminOrDeveloper) {
        console.log(
          "No division found and not admin/developer, userInfo:",
          userInfo
        );
        return;
      }

      console.log(
        "Fetching data for division ID:",
        userInfo.division,
        "Division name:",
        userInfo.division_name,
        "Role:",
        userInfo.role,
        "Is Admin/Developer:",
        isAdminOrDeveloper
      );

      setLoading(true);
      try {
        let divisionRequisitionsResponse;

        // DIVISION-BASED FILTERING: Admin/Developer see all, others see only their division
        if (isAdminOrDeveloper) {
          console.log("Admin/Developer: Fetching all requisitions");
          divisionRequisitionsResponse = await axios.get(
            `${configuration.api_url}requisitions/`
          );
        } else {
          console.log(
            `Regular user: Fetching division ${userInfo.division} requisitions`
          );
          divisionRequisitionsResponse = await axios.get(
            `${configuration.api_url}requisitions/division/${userInfo.division}/`
          );
        }

        const [inventoryResponse, divisionUsersResponse] = await Promise.all([
          axios.get(`${configuration.api_url}inventory/`),
          axios.get(
            `${configuration.api_url}divisions/${userInfo.division}/users/`
          ),
        ]);

        // Handle different response formats
        let divisionRequisitions;
        if (isAdminOrDeveloper) {
          // For admin/developer, the response is directly an array
          divisionRequisitions = Array.isArray(
            divisionRequisitionsResponse.data
          )
            ? divisionRequisitionsResponse.data
            : divisionRequisitionsResponse.data.requisitions || [];
        } else {
          // For regular users, the response has a specific format
          const divisionData = divisionRequisitionsResponse.data;
          divisionRequisitions = divisionData.requisitions || [];

          console.log("Division-specific data received:", {
            count: divisionData.count,
            division_id: divisionData.division_id,
            division_name: divisionData.division_name,
            requisitions_count: divisionRequisitions.length,
          });
        }

        console.log(
          `Found ${divisionRequisitions.length} requisitions for ${
            isAdminOrDeveloper
              ? "all divisions (Admin/Developer view)"
              : `division ${userInfo.division_name}`
          }`
        );

        setRequisitionData(divisionRequisitions);
        setInventoryData(inventoryResponse.data);
        setDivisionUsers(divisionUsersResponse.data || []);

        // ENHANCED ANALYTICS: Calculate division-specific statistics
        const today = dayjs();

        // Filter for user's own requisitions
        const myRequisitions = divisionRequisitions.filter(
          (req) => req.submitted_by === userInfo.username
        );
        console.log(
          `Found ${myRequisitions.length} requisitions submitted by ${userInfo.username}`
        );

        // Find urgent requisitions (due within 7 days and pending)
        const urgentItems = divisionRequisitions.filter((req) => {
          const requiredBy = dayjs(req.required_by_date);
          const daysUntilRequired = requiredBy.diff(today, "days");
          return (
            daysUntilRequired <= 7 &&
            daysUntilRequired >= 0 &&
            req.status === "pending"
          );
        });
        console.log(`Found ${urgentItems.length} urgent requisitions`);

        // Find today's activity
        const todayActivity = divisionRequisitions.filter((req) =>
          dayjs(req.requisition_date).isSame(today, "day")
        );
        console.log(`Found ${todayActivity.length} requisitions created today`);

        // Calculate comprehensive statistics
        const calculatedStats = divisionRequisitions.reduce(
          (acc, req) => {
            acc.total++;
            const status = req.status?.toLowerCase() || "pending";

            // Count by status
            if (status === "approved") acc.approved++;
            else if (status === "rejected") acc.rejected++;
            else if (status === "draft") acc.draft++;
            else acc.pending++;

            // Count user's own requisitions
            if (req.submitted_by === userInfo.username) {
              acc.myRequisitions++;
              if (status === "pending") acc.myPending++;
            }

            return acc;
          },
          {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            draft: 0,
            myRequisitions: 0,
            myPending: 0,
            urgent: urgentItems.length,
          }
        );

        console.log("Calculated statistics:", calculatedStats);

        setStats(calculatedStats);
        setUrgentRequisitions(urgentItems);
        setTodaysActivity(todayActivity);

        // Enhanced calendar data - only for filtered requisitions
        const calendarEntries = divisionRequisitions.reduce((acc, req) => {
          const date = dayjs(req.required_by_date).format("YYYY-MM-DD");
          if (!acc[date]) acc[date] = [];
          acc[date].push(req);
          return acc;
        }, {});

        setCalendarData(
          Object.entries(calendarEntries).map(([date, items]) => ({
            date: dayjs(date),
            requisitions: items,
          }))
        );

        // Try to fetch purchase orders
        try {
          const poResponse = await axios.get(
            `${configuration.api_url}all-po-numbers/`,
            axiosConfig
          );
          setPurchaseOrders(poResponse.data);
        } catch (error) {
          console.log("Purchase orders endpoint might not exist yet:", error);
          setPurchaseOrders([]);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        if (error.response?.status === 401) {
          console.error("User not authenticated");
          // Redirect to login
          navigate("/");
        } else if (error.response?.status === 403) {
          console.error("Access denied - insufficient permissions");
        }
      } finally {
        setLoading(false);
      }
    };

    // Only run if userInfo has been properly set
    if (userInfo.username && (userInfo.division || isAdminOrDeveloper)) {
      fetchAllData();
    }
  }, [userInfo, isAdminOrDeveloper, navigate]);

  // Custom day component for calendar with requisition indicators
  const CustomDay = (props) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const date = dayjs(day);
    const dateStr = date.format("YYYY-MM-DD");

    const requisitionsForDate =
      calendarData.find((entry) => entry.date.format("YYYY-MM-DD") === dateStr)
        ?.requisitions || [];

    const approvedCount = requisitionsForDate.filter(
      (req) => req.status?.toLowerCase() === "approved"
    ).length;

    const pendingCount = requisitionsForDate.filter(
      (req) => req.status?.toLowerCase() === "pending"
    ).length;

    return (
      <Tooltip
        title={
          requisitionsForDate.length > 0
            ? `${requisitionsForDate.length} requisitions due (${approvedCount} approved, ${pendingCount} pending)`
            : "No requisitions due"
        }
        arrow
      >
        <Badge
          overlap="circular"
          badgeContent={
            requisitionsForDate.length > 0 ? requisitionsForDate.length : null
          }
          color={approvedCount > pendingCount ? "success" : "warning"}
        >
          <PickersDay
            {...other}
            outsideCurrentMonth={outsideCurrentMonth}
            day={day}
          />
        </Badge>
      </Tooltip>
    );
  };

  // ENHANCED: Monthly trend data with better insights
  const monthlyTrendData = useMemo(() => {
    const monthlyGroups = requisitionData.reduce((acc, req) => {
      const month = dayjs(req.created_at || req.requisition_date).format(
        "MMM YYYY"
      );
      if (!acc[month])
        acc[month] = { total: 0, approved: 0, pending: 0, rejected: 0 };

      acc[month].total++;
      const status = req.status?.toLowerCase() || "pending";
      acc[month][status]++;

      return acc;
    }, {});

    const months = Object.keys(monthlyGroups).sort((a, b) =>
      dayjs(a, "MMM YYYY").diff(dayjs(b, "MMM YYYY"))
    );

    return {
      labels: months,
      datasets: [
        {
          label: "Total Requisitions",
          data: months.map((m) => monthlyGroups[m].total),
          borderColor: "#2196f3",
          backgroundColor: "rgba(33, 150, 243, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
        {
          label: "Approved",
          data: months.map((m) => monthlyGroups[m].approved),
          borderColor: "#4caf50",
          backgroundColor: "rgba(76, 175, 80, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
        {
          label: "Pending",
          data: months.map((m) => monthlyGroups[m].pending),
          borderColor: "#ff9800",
          backgroundColor: "rgba(255, 152, 0, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [requisitionData]);

  // Top inventory items with low stock (more refined)
  const lowStockItems = useMemo(() => {
    return inventoryData
      .filter((item) => {
        const totalStock = parseFloat(
          item.available_stock || item.total_stock || 0
        );
        return totalStock <= 10;
      })
      .sort(
        (a, b) =>
          parseFloat(a.available_stock || a.total_stock || 0) -
          parseFloat(b.available_stock || b.total_stock || 0)
      )
      .slice(0, 5);
  }, [inventoryData]);

  // Navigate to different modules
  const navigateTo = (path) => {
    navigate(path);
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading your dashboard...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box className="home-page-container">
        {/* Enhanced Welcome Section with Division Info */}
        <Box className="welcome-section">
          <Typography variant="h4" className="welcome-title">
            Welcome, {userInfo.name || "User"}
          </Typography>
          <Typography variant="subtitle1" className="date-display">
            {dayjs().format("dddd, MMMM D, YYYY")} •{" "}
            {isAdminOrDeveloper
              ? `${userInfo.role} (All Divisions)`
              : `${
                  userInfo.division_name || `Division ${userInfo.division}`
                }`}{" "}
            • {userInfo.role}
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Division Scope Alert for Admins */}
          {isAdminOrDeveloper && (
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  Admin/Developer View: Showing data from all divisions
                </Typography>
                <Typography variant="body2">
                  You have access to requisitions from all divisions. Regular
                  users only see their division data.
                </Typography>
              </Alert>
            </Grid>
          )}

          {/* Urgent Actions Alert */}
          {urgentRequisitions.length > 0 && (
            <Grid item xs={12}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  <WarningIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                  {urgentRequisitions.length} requisitions require attention
                  (due within 7 days)
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => navigateTo("/approval-table")}
                >
                  View Urgent Items
                </Button>
              </Alert>
            </Grid>
          )}

          {/* Quick Actions */}
          <Grid item xs={12}>
            <Paper className="quick-access-panel">
              <Typography variant="h6" className="panel-title">
                Quick Access
              </Typography>
              <Box className="quick-actions">
                <Button
                  variant="contained"
                  className="action-button requisition"
                  startIcon={<AssignmentIcon />}
                  onClick={() => navigateTo("/requisition-form")}
                >
                  New Requisition
                </Button>
                <Button
                  variant="contained"
                  className="action-button inventory"
                  startIcon={<InventoryIcon />}
                  onClick={() => navigateTo("/inventory")}
                >
                  Inventory
                </Button>
                <Button
                  variant="contained"
                  className="action-button vendor"
                  startIcon={<StoreIcon />}
                  onClick={() => navigateTo("/vendor-data")}
                >
                  Vendors
                </Button>
                <Button
                  variant="contained"
                  className="action-button master"
                  startIcon={<ReceiptIcon />}
                  onClick={() => navigateTo("/master-table")}
                >
                  Master Sheet
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Enhanced Status Cards with Division-Specific Data */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#f5f9ff", height: "100%" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <AssignmentIcon sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="h6">My Requisitions</Typography>
                </Box>
                <Typography variant="h3">{stats.myRequisitions}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.myPending} pending approval
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={
                    stats.myRequisitions
                      ? (stats.myPending / stats.myRequisitions) * 100
                      : 0
                  }
                  sx={{ mt: 2, height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#fff8e1", height: "100%" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <PendingIcon sx={{ mr: 1, color: "warning.main" }} />
                  <Typography variant="h6">
                    {isAdminOrDeveloper ? "All Pending" : "Division Pending"}
                  </Typography>
                </Box>
                <Typography variant="h3">{stats.pending}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {isAdminOrDeveloper
                    ? "Across all divisions"
                    : `In ${
                        userInfo.division_name ||
                        `Division ${userInfo.division}`
                      }`}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.total ? (stats.pending / stats.total) * 100 : 0}
                  color="warning"
                  sx={{ mt: 2, height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#e8f5e9", height: "100%" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <CheckCircleIcon sx={{ mr: 1, color: "success.main" }} />
                  <Typography variant="h6">Approved</Typography>
                </Box>
                <Typography variant="h3">{stats.approved}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Success rate:{" "}
                  {stats.total
                    ? Math.round((stats.approved / stats.total) * 100)
                    : 0}
                  %
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.total ? (stats.approved / stats.total) * 100 : 0}
                  color="success"
                  sx={{ mt: 2, height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#ffebee", height: "100%" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <WarningIcon sx={{ mr: 1, color: "error.main" }} />
                  <Typography variant="h6">Urgent Items</Typography>
                </Box>
                <Typography variant="h3">{stats.urgent}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Due within 7 days
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={100}
                  color="error"
                  sx={{ mt: 2, height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Calendar View */}
          <Grid item xs={12} md={6}>
            <Paper className="calendar-container">
              <Typography variant="h6" className="panel-title">
                <CalendarTodayIcon sx={{ mr: 1 }} />
                Requisition Due Dates (
                {isAdminOrDeveloper
                  ? "All Divisions"
                  : userInfo.division_name || `Division ${userInfo.division}`}
                )
              </Typography>
              <DateCalendar
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                slots={{ day: CustomDay }}
              />
              <Box className="calendar-legend">
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Approved"
                  color="success"
                  size="small"
                />
                <Chip
                  icon={<PendingIcon />}
                  label="Pending"
                  color="warning"
                  size="small"
                />
              </Box>
            </Paper>
          </Grid>

          {/* Enhanced Recent Activity - Division Filtered */}
          <Grid item xs={12} md={6}>
            <Paper className="recent-activity">
              <Typography variant="h6" className="panel-title">
                <TrendingUpIcon sx={{ mr: 1 }} />
                Today's Activity
              </Typography>
              {todaysActivity.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Project</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {todaysActivity.slice(0, 5).map((req) => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <Typography variant="body2" noWrap>
                              {req.material_description?.substring(0, 30) ||
                                req.cimcon_part_number ||
                                `REQ-${req.id}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {req.project?.project_code || "N/A"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={req.status || "Pending"}
                              size="small"
                              color={
                                req.status?.toLowerCase() === "approved"
                                  ? "success"
                                  : req.status?.toLowerCase() === "rejected"
                                  ? "error"
                                  : "warning"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => navigateTo(`/edit-requisition`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 200,
                  }}
                >
                  <Typography color="text.secondary" gutterBottom>
                    No activity today
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AssignmentIcon />}
                    onClick={() => navigateTo("/requisition-form")}
                  >
                    Create New Requisition
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Low Stock Items */}
          <Grid item xs={12} md={6}>
            <Paper className="low-stock-container">
              <Typography variant="h6" className="panel-title">
                <InventoryIcon sx={{ mr: 1 }} />
                Critical Stock Levels
              </Typography>
              {lowStockItems.length > 0 ? (
                <List>
                  {lowStockItems.map((item) => (
                    <ListItem key={item.id} divider>
                      <ListItemText
                        primary={item.description || item.item_no}
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              Part No: {item.item_no} | Make:{" "}
                              {item.make || "N/A"}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Allocated: {item.allocated_stock || 0} |
                              Available:{" "}
                              {item.available_stock || item.total_stock || 0}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ textAlign: "right" }}>
                        <Chip
                          label={`${
                            item.available_stock || item.total_stock || 0
                          } left`}
                          color={
                            parseFloat(
                              item.available_stock || item.total_stock || 0
                            ) <= 5
                              ? "error"
                              : "warning"
                          }
                          size="small"
                        />
                      </Box>
                    </ListItem>
                  ))}
                  <Button
                    variant="text"
                    color="primary"
                    fullWidth
                    onClick={() => navigateTo("/inventory")}
                    sx={{ mt: 2 }}
                  >
                    View All Inventory
                  </Button>
                </List>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 200,
                  }}
                >
                  <Typography color="text.secondary">
                    No critical stock levels found
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Division Team Insights */}
          <Grid item xs={12} md={6}>
            <Paper className="team-insights">
              <Typography variant="h6" className="panel-title">
                <PeopleIcon sx={{ mr: 1 }} />
                {isAdminOrDeveloper
                  ? "Team Overview"
                  : `${
                      userInfo.division_name || `Division ${userInfo.division}`
                    } Team`}
              </Typography>
              <List>
                {divisionUsers.slice(0, 5).map((user) => (
                  <ListItem key={user.id}>
                    <Avatar sx={{ mr: 2 }}>
                      {user.name?.charAt(0) || user.username?.charAt(0) || "U"}
                    </Avatar>
                    <ListItemText
                      primary={user.name || user.username}
                      secondary={user.role}
                    />
                    <Chip
                      label={user.role}
                      size="small"
                      color={user.role === "Approver" ? "primary" : "default"}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Monthly Trend Chart - Division Specific */}
          <Grid item xs={12} md={8}>
            <Paper className="chart-container">
              <Typography variant="h6" className="panel-title">
                Monthly Trend -{" "}
                {isAdminOrDeveloper
                  ? "All Divisions"
                  : userInfo.division_name || `Division ${userInfo.division}`}
              </Typography>
              <Box sx={{ height: 300, position: "relative" }}>
                {monthlyTrendData.labels.length > 0 ? (
                  <Line
                    data={monthlyTrendData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: {
                        mode: "index",
                        intersect: false,
                      },
                      plugins: {
                        legend: {
                          position: "top",
                        },
                        tooltip: {
                          enabled: true,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: "Number of Requisitions",
                          },
                        },
                      },
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <Typography color="text.secondary">
                      No requisition data available
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Status Distribution */}
          <Grid item xs={12} md={4}>
            <Paper className="chart-container">
              <Typography variant="h6" className="panel-title">
                Status Distribution
              </Typography>
              <Box sx={{ height: 300, position: "relative" }}>
                {stats.total > 0 ? (
                  <Doughnut
                    data={{
                      labels: ["Approved", "Pending", "Rejected", "Draft"],
                      datasets: [
                        {
                          data: [
                            stats.approved,
                            stats.pending,
                            stats.rejected,
                            stats.draft,
                          ],
                          backgroundColor: [
                            "#4caf50",
                            "#ff9800",
                            "#f44336",
                            "#2196f3",
                          ],
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "right",
                        },
                      },
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <Typography color="text.secondary">
                      No status data available
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default HomePage;
