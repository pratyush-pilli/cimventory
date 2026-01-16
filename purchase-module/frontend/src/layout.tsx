// src/Components/Layout.tsx
import React, { useState, useEffect } from "react";
import {
  Outlet,
  useNavigate,
  useLocation,
  Route,
  Link,
} from "react-router-dom";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Drawer,
  Tooltip,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People"; // Represents vendors/partnerships
import LogoutIcon from "@mui/icons-material/Logout";
import BuildIcon from "@mui/icons-material/Build";
import {
  KeyboardArrowDown,
  Assignment,
  Storage,
  Menu as MenuIcon,
  AccountCircle as AccountCircleIcon,
  Store,
} from "@mui/icons-material";
import "./layout.css";
import roleBasedAccess from "./config/roleConfig";
import POApproval from "./Components/PurchaseOrder/Approval/POApproval";
import axios from "axios";

interface Module {
  id: string;
  title: string;
  icon: React.ReactNode;
  submodules: {
    id: string;
    title: string;
    path: string;
  }[];
}

const modules: Module[] = [
  {
    id: "requisitions",
    title: "Requisitions",
    icon: <Assignment />,
    submodules: [
      {
        id: "generate",
        title: "New Indent",
        path: "/requisition-form",
      },
      { id: "edit", title: "Edit Indent", path: "/edit-requisition" },
      { id: "pending", title: "Approve Indent", path: "/approval-table" },
      {
        id: "itemGenerator",
        title: "Create Item",
        path: "/item-generator",
      },
    ],
  },
  {
    id: "store",
    title: "Store",
    icon: <Store />,
    submodules: [
      { id: "inward", title: "Inward", path: "/inward" },
      { id: "outward", title: "Outward", path: "/outward" },
      { id: "inventory", title: "Inventory", path: "/inventory" },
      {
        id: "invoice-tracker",
        title: "Invoice Tracker",
        path: "/invoice-tracker",
      },
      {
        id: "verification",
        title: "Verification",
        path: "/requisition-verification",
      },
      { id: "allocate", title: "Allocate Stock", path: "/allocate" },
      {
        id: "rejected",
        title: "Rejected Material",
        path: "/rejected-materials",
      },
      {
        id: "returnable",
        title: "Returnable Gate Pass",
        path: "/returnable",
      },
    ],
  },
  {
    id: "master",
    title: "Purchase",
    icon: <Storage />,
    submodules: [
      { id: "database", title: "Master Database", path: "/master-table" },
      { id: "database", title: "PO Database", path: "/PO" },
      { id: "po-approval", title: "PO Approval", path: "/po-approval" },
      { id: "po-edit", title: "PO Edit", path: "/po-edit" },
      { id: "po-line-items", title: "PO Line Items", path: "/po-line-items" },
    ],
  },
  {
    id: "vendor",
    title: "Vendor",
    icon: <PeopleIcon />,
    submodules: [
      {
        id: "registration",
        title: "Registration",
        path: "/vendor-registration",
      },
      { id: "approval", title: "Approval", path: "/vendor-approval" },
      { id: "edit", title: "Edit", path: "/vendor-edit" },
      { id: "database", title: "Database", path: "/vendor-data" },
    ],
  },
  {
    id: "components",
    title: "Components",
    icon: <BuildIcon />, // Assuming ComponentIcon is a valid icon component
    submodules: [
      { id: "database", title: "Item Master", path: "/item-data" },
      { id: "database", title: "Item Approval", path: "/item-approval" },
      { id: "database", title: "Item Submitter", path: "/item-submitter" },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    icon: <Storage />,
    submodules: [{ id: "admin", title: "Admin Dashboard", path: "/admin" }],
  },
];

const Layout = ({ handleVendorRegistrationOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [fullName, setFullName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState("");
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const displayName =
        userInfo.full_name ||
        (userInfo.first_name && userInfo.last_name
          ? `${userInfo.first_name} ${userInfo.last_name}`.trim()
          : userInfo.name || "User");
      setFullName(displayName);
      setUserRole(userInfo.role || "");
      setUserInfo(userInfo);
    } catch (error) {
      console.error("Error parsing user info:", error);
      setFullName("User");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    navigate("/");
  };

  const handleModuleClick = (moduleId: string) => {
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const handleSubmoduleClick = (path: string) => {
    navigate(path);
  };

  const isPathActive = (path: string) => location.pathname === path;
  const isModuleActive = (module: Module) => {
    // Check if any submodule path is currently active
    return module.submodules.some((sub) =>
      location.pathname.includes(sub.path)
    );
  };

  const getFilteredModules = () => {
    if (!userRole || !roleBasedAccess[userRole]) return [];

    if (userRole === "Admin" || userRole === "Developer") return modules;

    const allowedPaths = roleBasedAccess[userRole].allowedPaths;

    return modules
      .map((module) => ({
        ...module,
        submodules: module.submodules.filter((submodule) =>
          allowedPaths.includes(submodule.path)
        ),
      }))
      .filter((module) => module.submodules.length > 0);
  };

  return (
    <Box className="layout-container">
      <AppBar position="fixed" className="app-bar">
        <Toolbar className="toolbar">
          <div className="logo-container">
            <Link to="/home">
              <img src="/logo.png" alt="Purchase Module Logo" />
            </Link>
          </div>

          <div className="nav-content">
            <div className="user-info">
              <div className="user-name">{userInfo?.full_name || fullName}</div>
              <div className="user-avatar">
                {userInfo?.full_name
                  ? userInfo.full_name[0].toUpperCase()
                  : fullName?.[0].toUpperCase()}
              </div>
            </div>

            <Tooltip title="Logout">
              <IconButton className="logout-button" onClick={handleLogout}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </div>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}
        classes={{
          paper: `sidebar-paper ${isSidebarOpen ? "open" : "closed"}`,
        }}
      >
        <Box className="sidebar-content">
          <Box className="sidebar-header">
            <IconButton
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="toggle-button"
            >
              <MenuIcon />
            </IconButton>
          </Box>

          {getFilteredModules().map((module) => (
            <Box key={module.id} className="module-wrapper">
              <Box
                className={`module-item ${module.id} ${
                  expandedModule === module.id ? "expanded" : ""
                } ${isModuleActive(module) ? "active" : ""}`}
                onClick={() => handleModuleClick(module.id)}
              >
                <Box className="module-content">
                  <Box className={`icon-wrapper ${module.id}-icon`}>
                    {module.icon}
                  </Box>
                  {isSidebarOpen && (
                    <Box className="module-text">
                      <Typography variant="subtitle1" className="module-title">
                        {module.title}
                      </Typography>
                    </Box>
                  )}
                  {isSidebarOpen && (
                    <KeyboardArrowDown
                      className={`arrow-icon ${
                        expandedModule === module.id ? "expanded" : ""
                      }`}
                    />
                  )}
                </Box>
              </Box>
              {isSidebarOpen && (
                <Box
                  className={`submodule-container ${
                    expandedModule === module.id ? "expanded" : ""
                  }`}
                >
                  {module.submodules.map((submodule) => (
                    <Box
                      key={submodule.id}
                      className={`submodule-item ${module.id} ${
                        isPathActive(submodule.path) ? "active" : ""
                      }`}
                      onClick={() => handleSubmoduleClick(submodule.path)}
                    >
                      {submodule.title}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Drawer>

      <Box
        component="main"
        className={`main-content ${isSidebarOpen ? "sidebar-open" : ""}`}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
