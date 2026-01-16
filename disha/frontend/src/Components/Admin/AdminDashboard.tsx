import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Switch,
  FormControlLabel,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Badge,
  ListItemIcon,
  AlertTitle,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Assignment as AssignmentIcon,
  ShoppingCart as ShoppingCartIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Launch as LaunchIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import axios from "axios";
import configuration from "../../configuration";
import { useNavigate } from "react-router-dom";
import roleBasedAccess from "../../config/roleConfig";

interface DashboardStats {
  // User Statistics
  total_users: number;
  active_users: number;
  inactive_users: number;
  recent_users: number;
  users_by_role: {
    requisitors: number;
    approvers: number;
    purchasers: number;
  };

  // Division Statistics
  total_divisions: number;
  divisions_with_users: number;

  // Project Statistics
  total_projects: number;
  active_projects: number;
  recent_projects: number;

  // Requisition Statistics
  total_requisitions: number;
  pending_requisitions: number;
  approved_requisitions: number;
  rejected_requisitions: number;
  recent_requisitions: number;

  // Purchase Order Statistics
  total_purchase_orders: number;
  pending_pos: number;
  approved_pos: number;
  rejected_pos: number;
  recent_pos: number;

  // Financial Statistics
  total_po_value: number;
  monthly_po_value: number;
  avg_po_value: number;

  // Vendor Statistics
  total_vendors: number;
  approved_vendors: number;
  pending_vendors: number;
  rejected_vendors: number;

  // Item Statistics
  total_items: number;
  recent_items: number;
  total_item_requests: number;
  pending_item_requests: number;
  approved_item_requests: number;
  rejected_item_requests: number;

  // Inventory Statistics
  total_inventory_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  total_inventory_value: number;

  // Inward/Outward Statistics
  total_inward_entries: number;
  recent_inward: number;
  total_outward_entries: number;
  recent_outward: number;

  // Charts Data
  material_groups: Array<{ material_group: string; count: number }>;
  top_projects: Array<{
    project_code: string;
    client_project_name: string;
    req_count: number;
  }>;
  top_vendors: Array<{
    vendor_name: string;
    po_count: number;
    total_value: number;
  }>;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  division_id: number | null;
  division_name: string | null;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  last_login_date: string | null;
  user_requisitions: number;
  user_pos: number;
}

interface Division {
  id: number;
  division_name: string;
  user_count: number;
  active_user_count?: number;
  project_count?: number;
  requisition_count?: number;
  users?: Array<{
    id: number;
    username: string;
    full_name: string;
    role: string;
    is_active: boolean;
  }>;
}

interface SystemAlert {
  type: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  action_url?: string;
}

interface RoleChoice {
  value: string;
  label: string;
}

interface Role {
  role_name: string;
  description: string;
  allowedPaths: string[] | "all";
}

interface RoleStats {
  total_users: number;
  active_users: number;
  recent_users: number;
  total_requisitions: number;
  total_pos: number;
  last_activity: string | null;
}

interface ModuleStats {
  name: string;
  accessible_by: string[];
  user_count: number;
}

interface RoleManagementData {
  roles: { [key: string]: Role };
  role_stats: { [key: string]: RoleStats };
  module_stats: { [key: string]: ModuleStats };
  available_modules: { [key: string]: string };
}

interface AlertDetail {
  id: string;
  type: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  timestamp: string;
  priority: "low" | "medium" | "high" | "critical";
  category: string;
  affected_items?: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
  }>;
  recommendations?: string[];
  action_required: boolean;
  action_url?: string;
  metadata?: {
    [key: string]: any;
  };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [roleChoices, setRoleChoices] = useState<RoleChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [divisionDialogOpen, setDivisionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [totalUserPages, setTotalUserPages] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userDivisionFilter, setUserDivisionFilter] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [roleData, setRoleData] = useState<RoleManagementData | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    role_name: "",
    description: "",
    allowed_paths: [] as string[],
  });
  const [alertDetailDialogOpen, setAlertDetailDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);
  const [alertDetail, setAlertDetail] = useState<AlertDetail | null>(null);
  const [alertDetailLoading, setAlertDetailLoading] = useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Form states
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "Requisitor",
    division_id: "",
    password: "",
    is_active: true,
    is_staff: false,
    is_superuser: false,
  });

  const [divisionForm, setDivisionForm] = useState({
    division_name: "",
  });

  // Get current user from localStorage
  const getCurrentUser = () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      return {
        username: userInfo.username || "",
        role: userInfo.role || "",
        division_name: userInfo.division_name || "",
        first_name: userInfo.first_name || "",
        last_name: userInfo.last_name || "",
        email: userInfo.email || "",
      };
    } catch (error) {
      return {
        username: "",
        role: "",
        division_name: "",
        first_name: "",
        last_name: "",
        email: "",
      };
    }
  };

  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 2) {
      fetchUsers();
    }
  }, [
    activeTab,
    userPage,
    userSearch,
    userRoleFilter,
    userDivisionFilter,
    userStatusFilter,
  ]);

  useEffect(() => {
    if (activeTab === 4) {
      fetchRoleData();
    }
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all admin data in parallel
      const [statsResponse, divisionsResponse, systemResponse] =
        await Promise.all([
          axios.get(`${configuration.api_url}api/admin/dashboard-stats/`),
          axios.get(`${configuration.api_url}api/admin/divisions/`),
          axios.get(`${configuration.api_url}api/admin/system-overview/`),
        ]);

      setStats(statsResponse.data);
      setDivisions(divisionsResponse.data.divisions || []);
      setAlerts(systemResponse.data.alerts || []);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      enqueueSnackbar("Failed to load admin dashboard", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({
        page: userPage.toString(),
        page_size: "25",
        search: userSearch,
        role: userRoleFilter,
        division: userDivisionFilter,
        status: userStatusFilter,
      });

      const response = await axios.get(
        `${configuration.api_url}api/admin/users/?${params}`
      );
      setUsers(response.data.users || []);
      setRoleChoices(response.data.role_choices || []);
      setTotalUserPages(response.data.pagination?.total_pages || 1);
    } catch (error) {
      console.error("Error fetching users:", error);
      enqueueSnackbar("Failed to load users", { variant: "error" });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchRoleData = async () => {
    try {
      const response = await axios.get(
        `${configuration.api_url}api/admin/roles/`
      );
      setRoleData(response.data);
    } catch (error) {
      console.error("Error fetching role data:", error);
      enqueueSnackbar("Failed to load role data", { variant: "error" });
    }
  };

  const handleCreateUser = async () => {
    try {
      await axios.post(
        `${configuration.api_url}api/admin/users/create/`,
        userForm
      );
      enqueueSnackbar("User created successfully", { variant: "success" });
      setUserDialogOpen(false);
      resetUserForm();
      fetchUsers();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || "Failed to create user", {
        variant: "error",
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      await axios.put(
        `${configuration.api_url}api/admin/users/${selectedUser.id}/update/`,
        userForm
      );
      enqueueSnackbar("User updated successfully", { variant: "success" });
      setUserDialogOpen(false);
      setSelectedUser(null);
      resetUserForm();
      fetchUsers();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || "Failed to update user", {
        variant: "error",
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(
        `${configuration.api_url}api/admin/users/${userId}/delete/`
      );
      enqueueSnackbar("User deleted successfully", { variant: "success" });
      fetchUsers();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || "Failed to delete user", {
        variant: "error",
      });
    }
  };

  const handleCreateDivision = async () => {
    try {
      await axios.post(
        `${configuration.api_url}api/admin/divisions/create/`,
        divisionForm
      );
      enqueueSnackbar("Division created successfully", { variant: "success" });
      setDivisionDialogOpen(false);
      setDivisionForm({ division_name: "" });
      fetchDashboardData();
    } catch (error: any) {
      enqueueSnackbar(
        error.response?.data?.error || "Failed to create division",
        { variant: "error" }
      );
    }
  };

  const resetUserForm = () => {
    setUserForm({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      role: "Requisitor",
      division_id: "",
      password: "",
      is_active: true,
      is_staff: false,
      is_superuser: false,
    });
  };

  const openEditUser = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      division_id: user.division_id?.toString() || "",
      password: "",
      is_active: user.is_active,
      is_staff: user.is_staff,
      is_superuser: user.is_superuser,
    });
    setUserDialogOpen(true);
  };

  const handleRefresh = () => {
    fetchDashboardData();
    if (activeTab === 2) {
      fetchUsers();
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Approver":
        return "primary";
      case "Requisitor":
        return "secondary";
      case "Purchaser":
        return "success";
      case "Admin":
        return "warning";
      default:
        return "default";
    }
  };

  const handleBackToDashboard = () => {
    navigate("/home");
  };

  const openEditRole = (role: Role, roleName: string) => {
    console.log("Opening edit role:", role, "with name:", roleName); // Debug log

    // Check if role has the expected structure
    if (!role) {
      console.error("Invalid role object:", role);
      enqueueSnackbar("Invalid role data", { variant: "error" });
      return;
    }

    // Create a complete role object with the role_name
    const completeRole = {
      ...role,
      role_name: roleName,
    };

    setSelectedRole(completeRole);
    setRoleForm({
      role_name: roleName,
      description: role.description || "",
      allowed_paths: role.allowedPaths === "all" ? [] : role.allowedPaths || [],
    });
    setRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedRole || !selectedRole.role_name) {
      console.error("No selected role or invalid role name");
      enqueueSnackbar("No role selected for update", { variant: "error" });
      return;
    }

    console.log("Updating role:", selectedRole.role_name, roleForm); // Debug log

    try {
      await axios.put(
        `${configuration.api_url}api/admin/roles/${selectedRole.role_name}/update/`,
        roleForm
      );
      enqueueSnackbar("Role updated successfully", { variant: "success" });
      setRoleDialogOpen(false);
      setSelectedRole(null);
      resetRoleForm();
      fetchRoleData();
    } catch (error: any) {
      console.error("Error updating role:", error);
      enqueueSnackbar(error.response?.data?.error || "Failed to update role", {
        variant: "error",
      });
    }
  };

  const handleCreateRole = async () => {
    try {
      await axios.post(
        `${configuration.api_url}api/admin/roles/create/`,
        roleForm
      );
      enqueueSnackbar("Role created successfully", { variant: "success" });
      setRoleDialogOpen(false);
      resetRoleForm();
      fetchRoleData();
    } catch (error: any) {
      console.error("Error creating role:", error);
      enqueueSnackbar(error.response?.data?.error || "Failed to create role", {
        variant: "error",
      });
    }
  };

  const handleDeleteRole = async (roleName: string) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;

    try {
      await axios.delete(
        `${configuration.api_url}api/admin/roles/${roleName}/delete/`
      );
      enqueueSnackbar("Role deleted successfully", { variant: "success" });
      fetchRoleData();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || "Failed to delete role", {
        variant: "error",
      });
    }
  };

  const resetRoleForm = () => {
    setRoleForm({
      role_name: "",
      description: "",
      allowed_paths: [],
    });
  };

  const handleAlertClick = async (alert: SystemAlert) => {
    setSelectedAlert(alert);
    setAlertDetailDialogOpen(true);
    setAlertDetailLoading(true);

    try {
      // Fetch detailed information for the alert
      const response = await axios.get(
        `${configuration.api_url}api/admin/alert-details/${alert.title
          .toLowerCase()
          .replace(/\s+/g, "-")}/`
      );
      setAlertDetail(response.data);
    } catch (error) {
      console.error("Error fetching alert details:", error);
      // Create a fallback detail object
      setAlertDetail({
        id: alert.title.toLowerCase().replace(/\s+/g, "-"),
        type: alert.type,
        title: alert.title,
        message: alert.message,
        timestamp: new Date().toISOString(),
        priority: "medium",
        category: "System",
        action_required: !!alert.action_url,
        action_url: alert.action_url,
        recommendations: [
          "Review the system logs for more information",
          "Check related modules for potential issues",
          "Contact system administrator if problem persists",
        ],
      });
    } finally {
      setAlertDetailLoading(false);
    }
  };

  const handleAlertAction = (alert: SystemAlert) => {
    if (alert.action_url) {
      // Navigate to the specific page or open in new tab
      if (alert.action_url.startsWith("/")) {
        navigate(alert.action_url);
      } else {
        window.open(alert.action_url, "_blank");
      }
    }
    setAlertDetailDialogOpen(false);
  };

  const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    trend?: number;
  }> = ({ title, value, icon, color, subtitle, trend }) => (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" fontWeight="bold" color={color}>
              {value?.toLocaleString() || 0}
            </Typography>
            <Typography variant="h6" color="textSecondary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
            {trend !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUpIcon
                  fontSize="small"
                  color={trend > 0 ? "success" : "error"}
                />
                <Typography
                  variant="body2"
                  color={trend > 0 ? "success.main" : "error.main"}
                  ml={0.5}
                >
                  {trend > 0 ? "+" : ""}
                  {trend}%
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>{icon}</Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex" }}>
      {/* Navigation Sidebar */}
      <Box
        sx={{
          width: 280,
          bgcolor: "primary.main",
          color: "white",
          p: 3,
          minHeight: "100vh",
        }}
      >
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
          Admin Panel
        </Typography>

        {currentUser.username && (
          <Box sx={{ mb: 3 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)" }}>
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="body2">{currentUser.username}</Typography>
                <Chip
                  label={currentUser.role}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontSize: "0.7rem",
                  }}
                />
              </Box>
            </Box>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.7)", mt: 1, display: "block" }}
            >
              {currentUser.division_name}
            </Typography>
          </Box>
        )}

        <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", mb: 2 }} />

        <List>
          {[
            { text: "Dashboard", icon: <DashboardIcon /> },
            { text: "System Overview", icon: <AssessmentIcon /> },
            { text: "User Management", icon: <PeopleIcon /> },
            { text: "Division Management", icon: <BusinessIcon /> },
            { text: "Role Management", icon: <SecurityIcon /> },
          ].map((item, index) => (
            <ListItem
              key={item.text}
              onClick={() => setActiveTab(index)}
              sx={{
                bgcolor:
                  activeTab === index ? "rgba(255,255,255,0.2)" : "transparent",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.1)",
                },
                borderRadius: 1,
                mb: 1,
                cursor: "pointer",
              }}
            >
              <ListItemIcon sx={{ color: "white" }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  "& .MuiListItemText-primary": {
                    color: "white",
                    fontWeight: 500,
                  },
                }}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, bgcolor: "#f5f5f5", minHeight: "100vh" }}>
        {/* Header */}
        <Box
          sx={{
            bgcolor: "white",
            borderBottom: 1,
            borderColor: "divider",
            p: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleBackToDashboard}
              sx={{ mr: 2 }}
            >
              Back to Dashboard
            </Button>
            <Typography variant="h6">
              CIMCON Purchase Module - Administration
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3 }}>
          {/* System Alerts */}
          {alerts.length > 0 && (
            <Box mb={3}>
              {alerts.map((alert, index) => (
                <Alert
                  key={index}
                  severity={alert.type}
                  sx={{
                    mb: 1,
                    cursor: "pointer",
                    "&:hover": {
                      boxShadow: 2,
                      transform: "translateY(-1px)",
                      transition: "all 0.2s ease-in-out",
                    },
                  }}
                  onClick={() => handleAlertClick(alert)}
                  action={
                    <Box display="flex" gap={1}>
                      {/* {alert.action_url && (
                        // <Button
                        //   color="inherit"
                        //   size="small"
                        //   onClick={(e) => {
                        //     e.stopPropagation();
                        //     handleAlertAction(alert);
                        //   }}
                        //   startIcon={<LaunchIcon />}
                        // >
                        //   View
                        // </Button>
                      )} */}
                      <Button
                        color="inherit"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAlertClick(alert);
                        }}
                        startIcon={<VisibilityIcon />}
                      >
                        Details
                      </Button>
                    </Box>
                  }
                >
                  <AlertTitle>{alert.title}</AlertTitle>
                  {alert.message}
                </Alert>
              ))}
            </Box>
          )}

          {/* Dashboard Overview */}
          {activeTab === 0 && stats && (
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Dashboard Overview
              </Typography>

              {/* Main Stats Cards */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Users"
                    value={stats.total_users || 0}
                    icon={<PeopleIcon />}
                    color="#1976d2"
                    subtitle={`${stats.active_users || 0} active`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Divisions"
                    value={stats.total_divisions || 0}
                    icon={<BusinessIcon />}
                    color="#388e3c"
                    subtitle={`${stats.divisions_with_users || 0} with users`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Projects"
                    value={stats.total_projects || 0}
                    icon={<AssignmentIcon />}
                    color="#f57c00"
                    subtitle={`${stats.active_projects || 0} active`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Purchase Orders"
                    value={stats.total_purchase_orders || 0}
                    icon={<ShoppingCartIcon />}
                    color="#7b1fa2"
                    subtitle={`${stats.pending_pos || 0} pending`}
                  />
                </Grid>
              </Grid>

              {/* Secondary Stats */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Requisitions"
                    value={stats.total_requisitions || 0}
                    icon={<AssignmentIcon />}
                    color="#d32f2f"
                    subtitle={`${stats.pending_requisitions || 0} pending`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Items"
                    value={stats.total_items || 0}
                    icon={<InventoryIcon />}
                    color="#1976d2"
                    subtitle={`${stats.low_stock_items || 0} low stock`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Vendors"
                    value={stats.total_vendors || 0}
                    icon={<BusinessIcon />}
                    color="#388e3c"
                    subtitle={`${stats.approved_vendors || 0} approved`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="PO Value"
                    value={
                      Math.round((stats.total_po_value || 0) / 100000) / 10
                    }
                    icon={<ReceiptIcon />}
                    color="#f57c00"
                    subtitle="Cr (Total)"
                  />
                </Grid>
              </Grid>

              {/* User Role Distribution */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Users by Role
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="primary">
                          {stats.users_by_role?.requisitors || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Requisitors
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="secondary">
                          {stats.users_by_role?.approvers || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Approvers
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="success.main">
                          {stats.users_by_role?.purchasers || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Purchasers
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="warning.main">
                          {stats.total_users -
                            (stats.users_by_role?.requisitors || 0) -
                            (stats.users_by_role?.approvers || 0) -
                            (stats.users_by_role?.purchasers || 0) || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Others
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Top Projects */}
              {stats.top_projects && stats.top_projects.length > 0 && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top Projects by Requisitions
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Project Code</TableCell>
                            <TableCell>Project Name</TableCell>
                            <TableCell align="right">Requisitions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stats.top_projects
                            .slice(0, 5)
                            .map((project, index) => (
                              <TableRow key={index}>
                                <TableCell>{project.project_code}</TableCell>
                                <TableCell>
                                  {project.client_project_name}
                                </TableCell>
                                <TableCell align="right">
                                  {project.req_count}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}

          {/* System Overview */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                System Overview
              </Typography>

              {/* Pending Items that need attention */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card
                    sx={{
                      bgcolor: stats?.pending_requisitions
                        ? "#fff3e0"
                        : "white",
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="h4" color="warning.main">
                            {stats?.pending_requisitions || 0}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Pending Requisitions
                          </Typography>
                        </Box>
                        <WarningIcon color="warning" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card
                    sx={{ bgcolor: stats?.pending_pos ? "#ffebee" : "white" }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="h4" color="error.main">
                            {stats?.pending_pos || 0}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Pending POs
                          </Typography>
                        </Box>
                        <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card
                    sx={{
                      bgcolor: stats?.low_stock_items ? "#fff3e0" : "white",
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="h4" color="warning.main">
                            {stats?.low_stock_items || 0}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Low Stock Items
                          </Typography>
                        </Box>
                        <InventoryIcon color="warning" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card
                    sx={{
                      bgcolor: stats?.pending_item_requests
                        ? "#e3f2fd"
                        : "white",
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="h4" color="info.main">
                            {stats?.pending_item_requests || 0}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Pending Item Requests
                          </Typography>
                        </Box>
                        <InfoIcon color="info" sx={{ fontSize: 40 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Activity Overview */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Activity (Last 7 Days)
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="h5" color="primary">
                          {stats?.recent_requisitions || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          New Requisitions
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="h5" color="secondary">
                          {stats?.recent_pos || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          New Purchase Orders
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="h5" color="success.main">
                          {stats?.recent_inward || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Inward Entries
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="h5" color="warning.main">
                          {stats?.recent_outward || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Outward Entries
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* User Management */}
          {activeTab === 2 && (
            <Box>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Typography variant="h4" fontWeight="bold">
                  User Management
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setUserDialogOpen(true)}
                >
                  Add New User
                </Button>
              </Box>

              {/* User Filters */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Search Users"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Role</InputLabel>
                        <Select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          label="Role"
                        >
                          <MenuItem value="">All Roles</MenuItem>
                          {roleChoices.map((role) => (
                            <MenuItem key={role.value} value={role.value}>
                              {role.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Division</InputLabel>
                        <Select
                          value={userDivisionFilter}
                          onChange={(e) =>
                            setUserDivisionFilter(e.target.value)
                          }
                          label="Division"
                        >
                          <MenuItem value="">All Divisions</MenuItem>
                          {divisions.map((division) => (
                            <MenuItem
                              key={division.id}
                              value={division.id.toString()}
                            >
                              {division.division_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={userStatusFilter}
                          onChange={(e) => setUserStatusFilter(e.target.value)}
                          label="Status"
                        >
                          <MenuItem value="">All</MenuItem>
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="inactive">Inactive</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Users Table */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Users ({users.length})
                  </Typography>
                  {usersLoading ? (
                    <LinearProgress />
                  ) : (
                    <>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>User</TableCell>
                              <TableCell>Email</TableCell>
                              <TableCell>Role</TableCell>
                              <TableCell>Division</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Activity</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {users.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell>
                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    gap={1}
                                  >
                                    <Avatar sx={{ width: 32, height: 32 }}>
                                      <PersonIcon />
                                    </Avatar>
                                    <Box>
                                      <Typography
                                        variant="body2"
                                        fontWeight="bold"
                                      >
                                        {user.full_name ||
                                          `${user.first_name} ${user.last_name}`}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="textSecondary"
                                      >
                                        @{user.username}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={user.role}
                                    color={getRoleColor(user.role) as any}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  {user.division_name || "N/A"}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={
                                      user.is_active ? "Active" : "Inactive"
                                    }
                                    color={user.is_active ? "success" : "error"}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {user.user_requisitions} reqs,{" "}
                                    {user.user_pos} POs
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                  >
                                    Last: {user.last_login_date || "Never"}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Tooltip title="Edit User">
                                    <IconButton
                                      size="small"
                                      onClick={() => openEditUser(user)}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete User">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteUser(user.id)}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {totalUserPages > 1 && (
                        <Box display="flex" justifyContent="center" mt={2}>
                          <Pagination
                            count={totalUserPages}
                            page={userPage}
                            onChange={(e, page) => setUserPage(page)}
                            color="primary"
                          />
                        </Box>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Division Management */}
          {activeTab === 3 && (
            <Box>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Typography variant="h4" fontWeight="bold">
                  Division Management
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setDivisionDialogOpen(true)}
                >
                  Add New Division
                </Button>
              </Box>

              <Grid container spacing={3}>
                {divisions.map((division) => (
                  <Grid item xs={12} md={6} lg={4} key={division.id}>
                    <Card>
                      <CardContent>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={2}
                        >
                          <Typography variant="h6">
                            {division.division_name}
                          </Typography>
                          <Badge
                            badgeContent={division.user_count}
                            color="primary"
                          >
                            <GroupIcon />
                          </Badge>
                        </Box>

                        <Stack spacing={1}>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">
                              Total Users:
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {division.user_count || 0}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">
                              Active Users:
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {division.active_user_count || 0}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">Projects:</Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {division.project_count || 0}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">
                              Requisitions:
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {division.requisition_count || 0}
                            </Typography>
                          </Box>
                        </Stack>

                        {division.users && division.users.length > 0 && (
                          <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>
                              Recent Users:
                            </Typography>
                            <List dense>
                              {division.users.slice(0, 3).map((user) => (
                                <ListItem key={user.id} sx={{ px: 0 }}>
                                  <ListItemAvatar>
                                    <Avatar sx={{ width: 24, height: 24 }}>
                                      <PersonIcon fontSize="small" />
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={
                                      <Box
                                        display="flex"
                                        alignItems="center"
                                        gap={1}
                                      >
                                        <Typography variant="body2">
                                          {user.full_name}
                                        </Typography>
                                        <Chip
                                          label={user.role}
                                          color={getRoleColor(user.role) as any}
                                          size="small"
                                        />
                                      </Box>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Role Management */}
          {activeTab === 4 && roleData && (
            <Box>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Typography variant="h4" fontWeight="bold">
                  Role Management
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setRoleDialogOpen(true)}
                >
                  Add New Role
                </Button>
              </Box>

              {/* Role Statistics Overview */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {Object.entries(roleData.role_stats)
                  .filter(([roleName]) => roleName !== "Developer")
                  .map(([roleName, stats]) => {
                    const role = roleData.roles[roleName];
                    console.log(`Role data for ${roleName}:`, role); // Debug log

                    return (
                      <Grid item xs={12} sm={6} md={4} key={roleName}>
                        <Card>
                          <CardContent>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={2}
                            >
                              <Typography variant="h6">{roleName}</Typography>
                              <Chip
                                label={`${stats.total_users} users`}
                                color="primary"
                                size="small"
                              />
                            </Box>
                            <Stack spacing={1}>
                              <Box
                                display="flex"
                                justifyContent="space-between"
                              >
                                <Typography variant="body2">
                                  Active Users:
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {stats.active_users}
                                </Typography>
                              </Box>
                              <Box
                                display="flex"
                                justifyContent="space-between"
                              >
                                <Typography variant="body2">
                                  Requisitions:
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {stats.total_requisitions}
                                </Typography>
                              </Box>
                              <Box
                                display="flex"
                                justifyContent="space-between"
                              >
                                <Typography variant="body2">
                                  Purchase Orders:
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {stats.total_pos}
                                </Typography>
                              </Box>
                            </Stack>
                            <Box mt={2}>
                              <Button
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => {
                                  console.log(
                                    "Clicking edit for role:",
                                    roleName,
                                    role
                                  );
                                  if (role) {
                                    openEditRole(role, roleName);
                                  } else {
                                    console.error(
                                      "Role not found for:",
                                      roleName
                                    );
                                    enqueueSnackbar(
                                      `Role data not found for ${roleName}`,
                                      { variant: "error" }
                                    );
                                  }
                                }}
                              >
                                Edit Role
                              </Button>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
              </Grid>

              {/* Module Access Matrix */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Module Access Matrix
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Module</TableCell>
                          {Object.keys(roleData.roles)
                            .filter((roleName) => roleName !== "Developer")
                            .map((roleName) => (
                              <TableCell key={roleName} align="center">
                                {roleName}
                              </TableCell>
                            ))}
                          <TableCell align="center">Total Users</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(roleData.module_stats).map(
                          ([modulePath, moduleData]) => (
                            <TableRow key={modulePath}>
                              <TableCell>{moduleData.name}</TableCell>
                              {Object.keys(roleData.roles)
                                .filter((roleName) => roleName !== "Developer")
                                .map((roleName) => (
                                  <TableCell key={roleName} align="center">
                                    {roleData.roles[roleName].allowedPaths ===
                                      "all" ||
                                    moduleData.accessible_by.includes(
                                      roleName
                                    ) ? (
                                      <Chip
                                        label="✓"
                                        color="success"
                                        size="small"
                                      />
                                    ) : (
                                      <Chip
                                        label="✗"
                                        color="error"
                                        size="small"
                                      />
                                    )}
                                  </TableCell>
                                ))}
                              <TableCell align="center">
                                <Chip
                                  label={moduleData.user_count}
                                  color="primary"
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Role Details */}
              <Grid container spacing={3}>
                {Object.entries(roleData.roles)
                  .filter(([roleName]) => roleName !== "Developer")
                  .map(([roleName, role]) => {
                    console.log(`Role details for ${roleName}:`, role); // Debug log

                    return (
                      <Grid item xs={12} md={6} key={roleName}>
                        <Card>
                          <CardContent>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={2}
                            >
                              <Typography variant="h6">{roleName}</Typography>
                              <Box>
                                <Tooltip title="Edit Role">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      console.log(
                                        "Clicking edit for role:",
                                        roleName,
                                        role
                                      );
                                      if (role) {
                                        openEditRole(role, roleName);
                                      } else {
                                        console.error(
                                          "Invalid role data for:",
                                          roleName
                                        );
                                        enqueueSnackbar(
                                          `Invalid role data for ${roleName}`,
                                          { variant: "error" }
                                        );
                                      }
                                    }}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                {roleName !== "Admin" && (
                                  <Tooltip title="Delete Role">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteRole(roleName)}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>

                            <Typography
                              variant="body2"
                              color="textSecondary"
                              mb={2}
                            >
                              {role?.description || "No description available"}
                            </Typography>

                            <Typography variant="subtitle2" gutterBottom>
                              Accessible Modules:
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                              {role?.allowedPaths === "all" ? (
                                <Chip
                                  label="All Modules"
                                  color="success"
                                  size="small"
                                />
                              ) : (
                                (role?.allowedPaths || []).map((path) => (
                                  <Chip
                                    key={path}
                                    label={
                                      roleData.available_modules[
                                        path.replace("/", "")
                                      ] || path
                                    }
                                    color="primary"
                                    size="small"
                                  />
                                ))
                              )}
                            </Box>

                            {roleData.role_stats[roleName] && (
                              <Box mt={2}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Statistics:
                                </Typography>
                                <Typography variant="body2">
                                  {roleData.role_stats[roleName].total_users}{" "}
                                  total users,{" "}
                                  {roleData.role_stats[roleName].active_users}{" "}
                                  active
                                </Typography>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
              </Grid>
            </Box>
          )}

          {/* User Dialog */}
          <Dialog
            open={userDialogOpen}
            onClose={() => {
              setUserDialogOpen(false);
              setSelectedUser(null);
              resetUserForm();
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {selectedUser ? "Edit User" : "Create New User"}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({ ...userForm, username: e.target.value })
                    }
                    disabled={!!selectedUser}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm({ ...userForm, email: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={userForm.first_name}
                    onChange={(e) =>
                      setUserForm({ ...userForm, first_name: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={userForm.last_name}
                    onChange={(e) =>
                      setUserForm({ ...userForm, last_name: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={userForm.role}
                      onChange={(e) =>
                        setUserForm({ ...userForm, role: e.target.value })
                      }
                      label="Role"
                      required
                    >
                      {roleChoices.map((role) => (
                        <MenuItem key={role.value} value={role.value}>
                          {role.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Division</InputLabel>
                    <Select
                      value={userForm.division_id}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          division_id: e.target.value,
                        })
                      }
                      label="Division"
                    >
                      <MenuItem value="">No Division</MenuItem>
                      {divisions.map((division) => (
                        <MenuItem
                          key={division.id}
                          value={division.id.toString()}
                        >
                          {division.division_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {!selectedUser && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={userForm.password}
                      onChange={(e) =>
                        setUserForm({ ...userForm, password: e.target.value })
                      }
                      required
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userForm.is_active}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            is_active: e.target.checked,
                          })
                        }
                      />
                    }
                    label="Active User"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userForm.is_staff}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            is_staff: e.target.checked,
                          })
                        }
                      />
                    }
                    label="Staff User"
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setUserDialogOpen(false);
                  setSelectedUser(null);
                  resetUserForm();
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={selectedUser ? handleUpdateUser : handleCreateUser}
              >
                {selectedUser ? "Update User" : "Create User"}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Division Dialog */}
          <Dialog
            open={divisionDialogOpen}
            onClose={() => setDivisionDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Create New Division</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Division Name"
                    value={divisionForm.division_name}
                    onChange={(e) =>
                      setDivisionForm({ division_name: e.target.value })
                    }
                    required
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDivisionDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleCreateDivision}>
                Create Division
              </Button>
            </DialogActions>
          </Dialog>

          {/* Role Dialog */}
          <Dialog
            open={roleDialogOpen}
            onClose={() => {
              setRoleDialogOpen(false);
              setSelectedRole(null);
              resetRoleForm();
            }}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {selectedRole
                ? `Edit Role: ${selectedRole.role_name}`
                : "Create New Role"}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Role Name"
                    value={roleForm.role_name}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, role_name: e.target.value })
                    }
                    disabled={!!selectedRole}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, description: e.target.value })
                    }
                    multiline
                    rows={2}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Module Permissions
                  </Typography>
                  <FormControl component="fieldset">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={roleForm.allowed_paths.length === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // If checking "All Modules", clear the specific paths
                              setRoleForm({ ...roleForm, allowed_paths: [] });
                            } else {
                              // If unchecking "All Modules", set some default paths
                              setRoleForm({
                                ...roleForm,
                                allowed_paths: ["/home", "/inventory"],
                              });
                            }
                          }}
                        />
                      }
                      label="All Modules (Admin Access)"
                    />
                  </FormControl>

                  {roleForm.allowed_paths.length !== 0 && (
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary" mb={2}>
                        Select specific modules this role can access:
                      </Typography>
                      <Grid container spacing={1}>
                        {roleData &&
                          Object.entries(roleData.available_modules).map(
                            ([path, name]) => (
                              <Grid item xs={6} sm={4} key={path}>
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={roleForm.allowed_paths.includes(
                                        `/${path}`
                                      )}
                                      onChange={(e) => {
                                        const newPaths = e.target.checked
                                          ? [
                                              ...roleForm.allowed_paths,
                                              `/${path}`,
                                            ]
                                          : roleForm.allowed_paths.filter(
                                              (p) => p !== `/${path}`
                                            );
                                        setRoleForm({
                                          ...roleForm,
                                          allowed_paths: newPaths,
                                        });
                                      }}
                                    />
                                  }
                                  label={name}
                                />
                              </Grid>
                            )
                          )}
                      </Grid>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setRoleDialogOpen(false);
                  setSelectedRole(null);
                  resetRoleForm();
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={selectedRole ? handleUpdateRole : handleCreateRole}
                disabled={!roleForm.role_name || !roleForm.description}
              >
                {selectedRole ? "Update Role" : "Create Role"}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Alert Detail Dialog */}
          <Dialog
            open={alertDetailDialogOpen}
            onClose={() => {
              setAlertDetailDialogOpen(false);
              setSelectedAlert(null);
              setAlertDetail(null);
            }}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="h6">Alert Details</Typography>
                <IconButton
                  onClick={() => {
                    setAlertDetailDialogOpen(false);
                    setSelectedAlert(null);
                    setAlertDetail(null);
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              {alertDetailLoading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : alertDetail ? (
                <Box>
                  {/* Alert Header */}
                  <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <Alert severity={alertDetail.type} sx={{ flexGrow: 1 }}>
                      <AlertTitle>{alertDetail.title}</AlertTitle>
                      {alertDetail.message}
                    </Alert>
                    <Chip
                      label={alertDetail.priority.toUpperCase()}
                      color={
                        alertDetail.priority === "critical"
                          ? "error"
                          : alertDetail.priority === "high"
                          ? "warning"
                          : alertDetail.priority === "medium"
                          ? "info"
                          : "success"
                      }
                      size="small"
                    />
                  </Box>

                  {/* Alert Information */}
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Alert Information
                          </Typography>
                          <Stack spacing={2}>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2" color="textSecondary">
                                Category:
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {alertDetail.category}
                              </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2" color="textSecondary">
                                Priority:
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {alertDetail.priority.toUpperCase()}
                              </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2" color="textSecondary">
                                Timestamp:
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {new Date(
                                  alertDetail.timestamp
                                ).toLocaleString()}
                              </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2" color="textSecondary">
                                Action Required:
                              </Typography>
                              <Chip
                                label={
                                  alertDetail.action_required ? "Yes" : "No"
                                }
                                color={
                                  alertDetail.action_required
                                    ? "warning"
                                    : "success"
                                }
                                size="small"
                              />
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Recommendations
                          </Typography>
                          {alertDetail.recommendations &&
                          alertDetail.recommendations.length > 0 ? (
                            <List dense>
                              {alertDetail.recommendations.map((rec, index) => (
                                <ListItem key={index} sx={{ px: 0 }}>
                                  <ListItemIcon>
                                    <InfoIcon color="info" fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText primary={rec} />
                                </ListItem>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" color="textSecondary">
                              No specific recommendations available.
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Affected Items */}
                    {alertDetail.affected_items &&
                      alertDetail.affected_items.length > 0 && (
                        <Grid item xs={12}>
                          <Card>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                Affected Items
                              </Typography>
                              <TableContainer>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>ID</TableCell>
                                      <TableCell>Name</TableCell>
                                      <TableCell>Type</TableCell>
                                      <TableCell>Status</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {alertDetail.affected_items.map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell>{item.id}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.type}</TableCell>
                                        <TableCell>
                                          <Chip
                                            label={item.status}
                                            color={
                                              item.status === "active"
                                                ? "success"
                                                : item.status === "pending"
                                                ? "warning"
                                                : item.status === "error"
                                                ? "error"
                                                : "default"
                                            }
                                            size="small"
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
                      )}

                    {/* Metadata */}
                    {alertDetail.metadata &&
                      Object.keys(alertDetail.metadata).length > 0 && (
                        <Grid item xs={12}>
                          <Card>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                Additional Information
                              </Typography>
                              <Grid container spacing={2}>
                                {Object.entries(alertDetail.metadata).map(
                                  ([key, value]) => (
                                    <Grid item xs={12} sm={6} key={key}>
                                      <Box
                                        display="flex"
                                        justifyContent="space-between"
                                      >
                                        <Typography
                                          variant="body2"
                                          color="textSecondary"
                                        >
                                          {key.replace(/_/g, " ").toUpperCase()}
                                          :
                                        </Typography>
                                        <Typography
                                          variant="body2"
                                          fontWeight="bold"
                                        >
                                          {typeof value === "object"
                                            ? JSON.stringify(value)
                                            : String(value)}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  )
                                )}
                              </Grid>
                            </CardContent>
                          </Card>
                        </Grid>
                      )}
                  </Grid>
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No detailed information available for this alert.
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setAlertDetailDialogOpen(false);
                  setSelectedAlert(null);
                  setAlertDetail(null);
                }}
              >
                Close
              </Button>
              {/* {alertDetail?.action_url && (
                <Button
                  variant="contained"
                  startIcon={<LaunchIcon />}
                  onClick={() => handleAlertAction(selectedAlert!)}
                >
                  Take Action
                </Button>
              )} */}
            </DialogActions>
          </Dialog>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminDashboard;
