import React, { lazy, Suspense } from "react";

/**
 * Lazy import that survives a deploy.
 *
 * Every build hashes its chunks. A browser that still has the previous
 * index.js asks for a chunk filename that no longer exists; the SPA rewrite
 * answers with index.html, and the dynamic import dies with "'text/html' is
 * not a valid JavaScript MIME type" — a white screen for anyone who left the
 * app open across a release (ZIONX-2).
 *
 * The fix is to reload once, which fetches the new index.html and its new
 * chunk names. A session flag keeps a genuinely broken chunk from looping:
 * the second failure is allowed to throw so it reaches Sentry and the error
 * boundary instead of reloading forever. A successful load clears the flag so
 * the next deploy gets its own reload.
 */
const RELOAD_FLAG = "zx.chunk-reloaded";
const lazyWithReload = (factory) =>
  lazy(() =>
    factory()
      .then((mod) => {
        sessionStorage.removeItem(RELOAD_FLAG);
        return mod;
      })
      .catch((err) => {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
          // Never resolves: the page is on its way out.
          return new Promise(() => {});
        }
        throw err;
      })
  );
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Public entry points stay eager for fast first paint.
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Unauthorized from "./pages/Unauthorized";
import RoleProtectedRoute from "./components/RoleProtectedRoute";

// Everything else is code-split — each route loads its own chunk on demand.
const MarketingDashboard = lazyWithReload(() => import("./pages/MarketingDashboard"));
const CustomerProfile = lazyWithReload(() => import("./pages/CustomerProfile"));
const CreateCustomer = lazyWithReload(() => import("./pages/CreateCustomer"));
const CustomerDirectoryClean = lazyWithReload(() => import("./pages/CustomerDirectoryClean"));
const AdminExpenses = lazyWithReload(() => import("./pages/AdminExpenses"));
const BriefsList = lazyWithReload(() => import("./pages/BriefsList"));
const CreativeBrief = lazyWithReload(() => import("./pages/CreativeBrief"));
const PublicCreativeBrief = lazyWithReload(() => import("./pages/PublicCreativeBrief"));
const PublicBriefStart = lazyWithReload(() => import("./pages/PublicBriefStart"));
const PublicClientApproval = lazyWithReload(() => import("./pages/PublicClientApproval"));
const PublicCapture = lazyWithReload(() => import("./pages/PublicCapture"));
const PublicLegal = lazyWithReload(() => import("./pages/PublicLegal"));
const CreateUser = lazyWithReload(() => import("./pages/CreateUser"));
const BudgetManagement = lazyWithReload(() => import("./pages/BudgetManagement"));
const TeamManagement = lazyWithReload(() => import("./pages/TeamManagement"));
const TeamDashboardClean = lazyWithReload(() => import("./pages/TeamDashboardClean"));
const EmployeeDashboardClean = lazyWithReload(() => import("./pages/EmployeeDashboardClean"));
const SocialHub = lazyWithReload(() => import("./pages/SocialHub"));
const Analytics = lazyWithReload(() => import("./pages/Analytics"));
const Connections = lazyWithReload(() => import("./pages/Connections"));
const PublicReport = lazyWithReload(() => import("./pages/PublicReport"));
const ContentPlanningCenter = lazyWithReload(() => import("./pages/ContentPlanningCenter"));
const PostDetail = lazyWithReload(() => import("./pages/PostDetail"));
const ApprovalsHub = lazyWithReload(() => import("./pages/ApprovalsHub"));
const MyWork = lazyWithReload(() => import("./pages/MyWork"));
const ProjectManagement = lazyWithReload(() => import("./pages/ProjectManagement"));
const ProjectDetails = lazyWithReload(() => import("./pages/ProjectDetails"));
const CreateProject = lazyWithReload(() => import("./pages/CreateProject"));
const FunnelBoard = lazyWithReload(() => import("./pages/FunnelBoard"));
const ClientDashboard = lazyWithReload(() => import("./pages/ClientDashboard"));
const LeadsInbox = lazyWithReload(() => import("./pages/LeadsInbox"));
const LeadsCapture = lazyWithReload(() => import("./pages/LeadsCapture"));
const LeadsManage = lazyWithReload(() => import("./pages/LeadsManage"));
const LeadsAnalytics = lazyWithReload(() => import("./pages/LeadsAnalytics"));
const IncomeDashboard = lazyWithReload(() => import("./pages/IncomeDashboard"));
const SubscriptionsManager = lazyWithReload(() => import("./pages/SubscriptionsManager"));
const PaymentManagement = lazyWithReload(() => import("./pages/PaymentManagement"));
const CobrosTracker = lazyWithReload(() => import("./pages/CobrosTracker"));
const InvoiceGenerator = lazyWithReload(() => import("./pages/InvoiceGenerator"));
const InvoicesManager = lazyWithReload(() => import("./pages/InvoicesManager"));
const BancosManager = lazyWithReload(() => import("./pages/BancosManager"));
const NominaFiscal = lazyWithReload(() => import("./pages/NominaFiscal"));
const EstadosFinancieros = lazyWithReload(() => import("./pages/EstadosFinancieros"));
const InvoiceDetail = lazyWithReload(() => import("./pages/InvoiceDetail"));
const PayrollManagement = lazyWithReload(() => import("./pages/PayrollManagement"));
const FinancialStatements = lazyWithReload(() => import("./pages/FinancialStatements"));
const PeopleManagement = lazyWithReload(() => import("./pages/PeopleManagement"));
const AddonsManager = lazyWithReload(() => import("./pages/AddonsManager"));
const IncomeReports = lazyWithReload(() => import("./pages/IncomeReports"));
const CustomerImport = lazyWithReload(() => import("./pages/CustomerImport"));
const NotificationHub = lazyWithReload(() => import("./pages/NotificationHub"));
const MessageHub = lazyWithReload(() => import("./pages/MessageHub"));
const SocialAccountsManager = lazyWithReload(() => import("./pages/SocialAccountsManager"));
const AdAccountsManager = lazyWithReload(() => import("./pages/AdAccountsManager"));
const TasksBoard = lazyWithReload(() => import("./pages/TasksBoard"));

const PageLoader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8E8E5", color: "#04111A", fontFamily: "'Bricolage', Helvetica, Arial, sans-serif", fontSize: 15, opacity: 0.55 }}>
    Cargando…
  </div>
);

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/auth" replace />;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload || !payload.id) throw new Error("Invalid token payload");
    // Client-portal users only ever get their portal + funnel — nothing else.
    const role = payload.role || localStorage.getItem("userRole");
    const clientAllowed = ["/portal", "/funnel"];
    if (role === "client" && !clientAllowed.includes(window.location.pathname)) {
      return <Navigate to="/portal" replace />;
    }
    return children;
  } catch {
    return <Navigate to="/auth" replace />;
  }
};

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/auth" replace />;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userRole = localStorage.getItem("userRole");
    if (payload.role !== "admin" && userRole !== "admin") return <Navigate to="/unauthorized" replace />;
    return children;
  } catch {
    return <Navigate to="/auth" replace />;
  }
};

// Section-based route wrappers
const SocialMediaRoute = ({ children }) => (
  <RoleProtectedRoute section="social_media" redirectTo="/unauthorized">
    {children}
  </RoleProtectedRoute>
);

const ClientsRoute = ({ children }) => (
  <RoleProtectedRoute section="clients" redirectTo="/unauthorized">
    {children}
  </RoleProtectedRoute>
);

const FinanceRoute = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['admin', 'accountant']} redirectTo="/unauthorized">
    {children}
  </RoleProtectedRoute>
);

const HRRoute = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['admin', 'hr_manager', 'accountant']} redirectTo="/unauthorized">
    {children}
  </RoleProtectedRoute>
);

const AppRouter = () => (
  <Router>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/brief-publico" element={<PublicBriefStart />} />
        <Route path="/public-brief/:token" element={<PublicCreativeBrief />} />
        <Route path="/client-approval/:token" element={<PublicClientApproval />} />
        <Route path="/capturar/:token" element={<PublicCapture />} />
        <Route path="/reporte/:token" element={<PublicReport />} />
        <Route path="/privacy" element={<PublicLegal kind="privacy" />} />
        <Route path="/data-deletion" element={<PublicLegal kind="deletion" />} />

        {/* Core */}
        <Route path="/dashboard" element={<ProtectedRoute><MarketingDashboard /></ProtectedRoute>} />

        {/* CRM */}
        <Route path="/customer/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
        <Route path="/create-customer" element={<ProtectedRoute><CreateCustomer /></ProtectedRoute>} />
        <Route path="/crm" element={<ClientsRoute><CustomerDirectoryClean /></ClientsRoute>} />
        <Route path="/customers/import" element={<ProtectedRoute><CustomerImport /></ProtectedRoute>} />

        {/* Social Media */}
        <Route path="/social-hub" element={<SocialMediaRoute><SocialHub /></SocialMediaRoute>} />
        <Route path="/social-analytics" element={<SocialMediaRoute><Analytics /></SocialMediaRoute>} />
        <Route path="/conexiones" element={<SocialMediaRoute><Connections /></SocialMediaRoute>} />
        <Route path="/content-calendar" element={<SocialMediaRoute><ContentPlanningCenter /></SocialMediaRoute>} />
        <Route path="/post/:id" element={<SocialMediaRoute><PostDetail /></SocialMediaRoute>} />
        <Route path="/approvals" element={<SocialMediaRoute><ApprovalsHub /></SocialMediaRoute>} />
        <Route path="/my-work" element={<ProtectedRoute><MyWork /></ProtectedRoute>} />
        <Route path="/tareas" element={<ProtectedRoute><TasksBoard /></ProtectedRoute>} />
        <Route path="/social/accounts" element={<SocialMediaRoute><SocialAccountsManager /></SocialMediaRoute>} />
        <Route path="/social/callback" element={<SocialMediaRoute><SocialAccountsManager /></SocialMediaRoute>} />
        <Route path="/ads/accounts" element={<SocialMediaRoute><AdAccountsManager /></SocialMediaRoute>} />

        {/* Leads / CRM */}
        <Route path="/portal" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
        <Route path="/funnel" element={<ProtectedRoute><FunnelBoard /></ProtectedRoute>} />
        <Route path="/leads-inbox" element={<ProtectedRoute><LeadsInbox /></ProtectedRoute>} />
        <Route path="/leads-capture" element={<ProtectedRoute><LeadsCapture /></ProtectedRoute>} />
        <Route path="/leads-manage" element={<ProtectedRoute><LeadsManage /></ProtectedRoute>} />
        <Route path="/leads-analytics" element={<ProtectedRoute><LeadsAnalytics /></ProtectedRoute>} />

        {/* Income Management */}
        <Route path="/income" element={<FinanceRoute><IncomeDashboard /></FinanceRoute>} />
        <Route path="/income/subscriptions" element={<FinanceRoute><SubscriptionsManager /></FinanceRoute>} />
        <Route path="/income/cobros" element={<FinanceRoute><CobrosTracker /></FinanceRoute>} />
        <Route path="/income/payments" element={<FinanceRoute><PaymentManagement /></FinanceRoute>} />
        <Route path="/income/invoice-generator" element={<FinanceRoute><InvoiceGenerator /></FinanceRoute>} />
        <Route path="/income/invoices" element={<FinanceRoute><InvoicesManager /></FinanceRoute>} />
        <Route path="/income/invoices/:id" element={<FinanceRoute><InvoiceDetail /></FinanceRoute>} />
        {/* CFDIs merged into Facturas — keep the old path as a redirect. */}
        <Route path="/income/cfdi" element={<Navigate to="/income/invoices" replace />} />
        <Route path="/income/addons" element={<FinanceRoute><AddonsManager /></FinanceRoute>} />
        <Route path="/income/reports" element={<FinanceRoute><IncomeReports /></FinanceRoute>} />
        <Route path="/bancos" element={<FinanceRoute><BancosManager /></FinanceRoute>} />
        <Route path="/finance/estados" element={<FinanceRoute><EstadosFinancieros /></FinanceRoute>} />

        {/* HR & Payroll */}
        <Route path="/people" element={<HRRoute><PeopleManagement /></HRRoute>} />
        <Route path="/hr/employees" element={<HRRoute><PeopleManagement /></HRRoute>} />
        <Route path="/hr/payroll" element={<HRRoute><PayrollManagement /></HRRoute>} />
        <Route path="/hr/nomina-fiscal" element={<HRRoute><NominaFiscal /></HRRoute>} />
        <Route path="/hr/financials" element={<HRRoute><FinancialStatements /></HRRoute>} />
        <Route path="/payroll" element={<HRRoute><PayrollManagement /></HRRoute>} />

        {/* Notifications & Messaging */}
        <Route path="/notifications" element={<ProtectedRoute><NotificationHub /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessageHub /></ProtectedRoute>} />

        {/* Team Management */}
        <Route path="/team-management" element={<HRRoute><TeamManagement /></HRRoute>} />
        <Route path="/team-dashboard" element={<ProtectedRoute><TeamDashboardClean /></ProtectedRoute>} />
        <Route path="/employee/:employeeId" element={<ProtectedRoute><EmployeeDashboardClean /></ProtectedRoute>} />

        {/* Projects */}
        <Route path="/projects" element={<ProtectedRoute><ProjectManagement /></ProtectedRoute>} />
        <Route path="/projects/new" element={<ProtectedRoute><CreateProject /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />

        {/* Creative Briefs */}
        <Route path="/briefs" element={<ProtectedRoute><BriefsList /></ProtectedRoute>} />
        <Route path="/briefs/new" element={<ProtectedRoute><CreativeBrief /></ProtectedRoute>} />
        <Route path="/briefs/:id" element={<ProtectedRoute><CreativeBrief /></ProtectedRoute>} />


        {/* Admin */}
        <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
        <Route path="/admin/budgets" element={<AdminRoute><BudgetManagement /></AdminRoute>} />
        <Route path="/admin/create-user" element={<AdminRoute><CreateUser /></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Suspense>
  </Router>
);

export default AppRouter;
