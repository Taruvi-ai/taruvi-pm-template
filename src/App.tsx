import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  ErrorComponent,
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/mui";
import Navkit from '@taruvi/navkit';
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import routerProvider, {
  DocumentTitleHandler,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import { taruviClient } from "./taruviClient";
import {
  taruviDataProvider,
  taruviAuthProvider,
  taruviStorageProvider,
  taruviFunctionsProvider,
  taruviAppProvider,
  taruviUserProvider,
  taruviAnalyticsProvider,
  // taruviAccessControlProvider, // Uncomment to enable Cerbos-based access control
} from "./providers/refineProviders";
import { CustomSider } from "./components/sidenav";
import { LoginRedirect } from "./components/auth/LoginRedirect";
import { GlobalDialogsHost } from "./components/dialogs/globalDialogs";
import { ColorModeContextProvider, ColorModeContext } from "./contexts/color-mode";
import { AppSettingsProvider } from "./contexts/app-settings";
import { useContext, useRef, useEffect } from "react";
import { Home } from "./pages/home";
import { MyAssignments } from "./pages/assignments";
import { ProjectList, ProjectCreate, ProjectEdit, ProjectShow, ProjectDashboard } from "./pages/projects";
import { CalendarView } from "./pages/calendar";
import { OrganizationAdmin } from "./pages/admin";
import FolderIcon from "@mui/icons-material/Folder";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CorporateFareIcon from "@mui/icons-material/CorporateFare";
import { patchTaruviUserApps404 } from "./utils/patchTaruviSdk";

patchTaruviUserApps404(taruviClient);

const AppContent = () => {
  const { setMode } = useContext(ColorModeContext);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current) {
      const height = navRef.current.offsetHeight;
      document.documentElement.style.setProperty('--nav-height', `${height}px`);
    }
  }, []);
  return (
    <>
      <div
        ref={navRef}
        data-nav-container
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1300,
          width: '100%',
        }}
      >
        <Navkit
          client={taruviClient}
          getTheme={(theme) => setMode(theme)}
        />
      </div>
      <RefineSnackbarProvider>
            <DevtoolsProvider>
              <Refine
                dataProvider={{
                  default: taruviDataProvider,
                  storage: taruviStorageProvider,
                  functions: taruviFunctionsProvider,
                  app: taruviAppProvider,
                  user: taruviUserProvider,
                  analytics: taruviAnalyticsProvider,
                }}
                notificationProvider={useNotificationProvider}
                routerProvider={routerProvider}
                authProvider={taruviAuthProvider}
                // accessControlProvider={taruviAccessControlProvider} // Uncomment to enable Cerbos-based access control
                resources={[
                  {
                    name: "assignments",
                    list: "/assignments",
                    meta: {
                      label: "My Assignments",
                      icon: <AssignmentIcon />,
                    },
                  },
                  {
                    name: "projects",
                    list: "/projects",
                    create: "/projects/create",
                    edit: "/projects/edit/:id",
                    show: "/projects/show/:id",
                    meta: {
                      canDelete: true,
                      label: "Projects",
                      icon: <FolderIcon />,
                    },
                  },
                  {
                    name: "calendar",
                    list: "/calendar",
                    meta: {
                      label: "Calendar View",
                      icon: <CalendarMonthIcon />,
                    },
                  },
                  {
                    name: "organization",
                    list: "/admin/organization",
                    meta: {
                      label: "Organization",
                      icon: <CorporateFareIcon />,
                      // Hidden from the sidebar unless the user has the Super Admin role.
                      adminOnly: true,
                    },
                  },
                ]}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: false,
                  projectId: "obEpHJ-M7JimA-31GF1J",
                }}
              >
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-inner"
                        fallback={<LoginRedirect />}
                      >
                        <ThemedLayout Header={() => null} Sider={CustomSider} initialSiderCollapsed={true}>
                          <Box sx={{ ml: { xs: 0, md: '72px' }, transition: 'margin-left 0.2s ease-in-out' }}>
                            <Outlet />
                          </Box>
                        </ThemedLayout>
                      </Authenticated>
                    }
                  >
                    <Route index element={<Home />} />
                    <Route path="/projects">
                      <Route index element={<ProjectList />} />
                      <Route path="create" element={<ProjectCreate />} />
                      <Route path="edit/:id" element={<ProjectEdit />} />
                      <Route path="show/:id" element={<ProjectShow />} />
                      <Route path="dashboard/:id" element={<ProjectDashboard />} />
                    </Route>
                    <Route path="/calendar" element={<CalendarView />} />
                    <Route path="/assignments" element={<MyAssignments />} />
                    <Route path="/admin/organization" element={<OrganizationAdmin />} />
                    <Route path="*" element={<ErrorComponent />} />
                  </Route>
                </Routes>

                <RefineKbar />
                <GlobalDialogsHost />
                <DocumentTitleHandler
                  handler={() => "Taruvi Projects"}
                />
              </Refine>
              <DevtoolsPanel />
            </DevtoolsProvider>
          </RefineSnackbarProvider>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <AppSettingsProvider>
            <CssBaseline />
            <GlobalStyles styles={{ 
              html: { WebkitFontSmoothing: "auto" },
              // Remove padding from Navkit header
              '.MuiPaper-root.MuiAppBar-root': { 
                padding: '0 !important',
                minHeight: 'auto !important',
              },
            }} />
            <AppContent />
          </AppSettingsProvider>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
