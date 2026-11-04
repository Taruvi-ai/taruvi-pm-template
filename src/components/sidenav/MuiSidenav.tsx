import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import Dashboard from "@mui/icons-material/Dashboard";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";

import {
  useMenu,
  useLogout,
  useTranslate,
  useWarnAboutChange,
} from "@refinedev/core";

import { MenuItem } from "./MenuItem";
import { MobileBottomNav } from "./MobileBottomNav";
import "./sidenav.css";
import { modalConfirm } from "../dialogs/globalDialogs";
import { useIsAdmin } from "../../hooks/useIsAdmin";

const DRAWER_WIDTH_EXPANDED = 240;
const DRAWER_WIDTH_COLLAPSED = 72;
const MAX_LABEL_EXPANDED = 40;
const MAX_LABEL_COLLAPSED = 10;

const truncateLabel = (text: string, expanded: boolean) => {
  if (expanded) {
    return text.length > MAX_LABEL_EXPANDED ? text.slice(0, MAX_LABEL_EXPANDED) + "…" : text;
  }
  const spaceIdx = text.indexOf(" ");
  if (spaceIdx === -1) {
    return text.length > MAX_LABEL_COLLAPSED ? text.slice(0, MAX_LABEL_COLLAPSED) + "…" : text;
  }
  const line1 = text.slice(0, spaceIdx);
  const rest = text.slice(spaceIdx + 1);
  const line2 = rest.length > MAX_LABEL_COLLAPSED ? rest.slice(0, MAX_LABEL_COLLAPSED) + "…" : rest;
  return line1 + "\n" + line2;
};

interface MuiSidenavProps {
  meta?: Record<string, unknown>;
}

export const MuiSidenav: React.FC<MuiSidenavProps> = ({ meta }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslate();

  const { menuItems: allMenuItems, selectedKey } = useMenu({ meta });
  const { isAdmin } = useIsAdmin();
  const menuItems = useMemo(
    () => allMenuItems.filter((item) => isAdmin || !item.meta?.adminOnly),
    [allMenuItems, isAdmin]
  );
  const { mutate: mutateLogout } = useLogout();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  const handleNavigate = useCallback(
    (route: string) => {
      navigate(route);
    },
    [navigate]
  );

  const handleLogout = useCallback(async () => {
    if (warnWhen) {
      const shouldLogout = await modalConfirm(
        t(
          "warnWhenUnsavedChanges",
          "Are you sure you want to leave? You have unsaved changes."
        ),
        "Unsaved Changes"
      );
      if (shouldLogout) {
        setWarnWhen(false);
        mutateLogout();
      }
    } else {
      mutateLogout();
    }
  }, [warnWhen, setWarnWhen, mutateLogout, t]);

  const handleOpenGuide = useCallback(() => {
    window.open("/user-guide/index.html", "_blank", "noopener,noreferrer");
  }, []);

  const isDashboardSelected = location.pathname === "/";
  const drawerWidth = expanded ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED;

  const dashboardButton = (
    <ListItemButton
      onClick={() => handleNavigate("/")}
      selected={isDashboardSelected}
      sx={{
        minHeight: 48,
        flexDirection: expanded ? "row" : "column",
        justifyContent: expanded ? "initial" : "center",
        alignItems: "center",
        borderRadius: expanded ? 1 : 0,
        mx: expanded ? 1 : 0,
        mb: 0.5,
        py: expanded ? 1 : 1.5,
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: expanded ? 2 : 0,
          justifyContent: "center",
        }}
      >
        <Dashboard />
      </ListItemIcon>
      <ListItemText
        primary={truncateLabel(t("dashboard.title", "Dashboard"), expanded)}
        sx={{
          m: 0,
          mt: expanded ? 0 : 0.5,
          textAlign: expanded ? "left" : "center",
        }}
        primaryTypographyProps={{
          fontSize: expanded ? 14 : 10,
          fontWeight: isDashboardSelected ? 600 : 500,
          noWrap: expanded,
          whiteSpace: expanded ? "nowrap" : "pre",
        }}
      />
    </ListItemButton>
  );

  const guideButton = (
    <ListItemButton
      onClick={handleOpenGuide}
      sx={{
        minHeight: 48,
        flexDirection: expanded ? "row" : "column",
        justifyContent: expanded ? "initial" : "center",
        alignItems: "center",
        borderRadius: expanded ? 1 : 0,
        mx: expanded ? 1 : 0,
        mb: 0.5,
        py: expanded ? 1 : 1.5,
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: expanded ? 2 : 0,
          justifyContent: "center",
        }}
      >
        <MenuBookOutlined />
      </ListItemIcon>
      <ListItemText
        primary={truncateLabel("User Guide", expanded)}
        sx={{
          m: 0,
          mt: expanded ? 0 : 0.5,
          textAlign: expanded ? "left" : "center",
        }}
        primaryTypographyProps={{
          fontSize: expanded ? 14 : 10,
          fontWeight: 500,
          noWrap: expanded,
          whiteSpace: expanded ? "nowrap" : "pre",
        }}
      />
    </ListItemButton>
  );

  return (
    <>
      {/* Desktop Sidenav */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            position: "fixed",
            top: "var(--nav-height, 60px)",
            left: 0,
            height: "calc(100vh - var(--nav-height, 60px))",
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: 1,
            borderColor: "divider",
            transition: "width 0.2s ease-in-out",
            overflowX: "hidden",
            zIndex: 1200,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {/* Toggle Button */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: expanded ? "flex-end" : "center",
              p: 1,
            }}
          >
            <IconButton onClick={handleToggle}>
              {expanded ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          </Box>

          <Divider />

          {/* Menu Items */}
          <List sx={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden", py: 1 }}>
            {/* Dashboard */}
            {dashboardButton}

            {/* Resource Menu Items */}
            {menuItems.map((item) => (
              <MenuItem
                key={item.key || item.name}
                item={item}
                selectedKey={selectedKey || location.pathname}
                expanded={expanded}
                onNavigate={handleNavigate}
              />
            ))}
          </List>

          <Box sx={{ pb: 1 }}>
            <Divider />
            <List sx={{ py: 1 }}>
              {guideButton}
            </List>
          </Box>
        </Box>
      </Drawer>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        menuItems={menuItems}
        selectedKey={selectedKey || location.pathname}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
    </>
  );
};
