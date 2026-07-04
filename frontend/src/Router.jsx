import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Public entry points stay eager for fast first paint.
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Unauthorized from "./pages/Unauthorized";
import RoleProtectedRoute from "./components/RoleProtectedRoute";

// Everything else is code-split — each route loads its own chunk on demand.
const MarketingDashboard = lazy(() => import("./pages/MarketingDashboard"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));
const CreateCustomer = lazy(() => import("./pages/CreateCustomer"));
const CustomerDirectoryClean = lazy(() => import("./pages/CustomerDirectoryClean"));
const PublicRegister = lazy(() => import("./pages/PublicRegister"));
const AdminPromotions = lazy(() => import("./pages/AdminPromotions"));
const AdminExpenses = lazy(() => import("./pages/AdminExpenses"));
const BriefsList = lazy(() => import("./pages/BriefsList"));
const CreativeBrief = lazy(() => import("./pages/CreativeBrief"));
const PublicCreativeBrief = lazy(() => import("./pages/PublicCreativeBrief"));
const PublicBriefStart = lazy(() => import("./pages/PublicBriefStart"));
const PublicClientApproval = lazy(() => import("./pages/PublicClientApproval"));
const InventoryRequest = lazy(() => import("./pages/InventoryRequest"));
const AdminInventoryViewer = lazy(() => import("./pages/AdminInventoryViewer"));
const ProductProfile = lazy(() => import("./pages/ProductProfile"));
const CreateUser = lazy(() => import("./pages/CreateUser"));
const BudgetManagement = lazy(() => import("./pages/BudgetManagement"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const TeamDashboardClean = lazy(() => import("./pages/TeamDashboardClean"));
const EmployeeDashboardClean = lazy(() => import("./pages/EmployeeDashboardClean"));
const SocialHub = lazy(() => import("./pages/SocialHub"));
const ContentPlanningCenter = lazy(() => import("./pages/ContentPlanningCenter"));
const ApprovalsHub = lazy(() => import("./pages/ApprovalsHub"));
const MyWork = lazy(() => import("./pages/MyWork"));
const ProjectManagement = lazy(() => import("./pages/ProjectManagement"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const CreateProject = lazy(() => import("./pages/CreateProject"));
const LeadsInbox = lazy(() => import("./pages/LeadsInbox"));
const LeadsCapture = lazy(() => import("./pages/LeadsCapture"));
const LeadsManage = lazy(() => import("./pages/LeadsManage"));
const LeadsAnalytics = lazy(() => import("./pages/LeadsAnalytics"));
const IncomeDashboard = lazy(() => import("./pages/IncomeDashboard"));
const SubscriptionsManager = lazy(() => import("./pages/SubscriptionsManager"));
const PaymentManagement = lazy(() => import("./pages/PaymentManagement"));
const InvoiceGenerator = lazy(() => import("./pages/InvoiceGenerator"));
const InvoicesManager = lazy(() => import("./pages/InvoicesManager"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const CfdiFiscal = lazy(() => import("./pages/CfdiFiscal"));
const PayrollManagement = lazy(() => import("./pages/PayrollManagement"));
const FinancialStatements = lazy(() => import("./pages/FinancialStatements"));
const PeopleManagement = lazy(() => import("./pages/PeopleManagement"));
const AddonsManager = lazy(() => import("./pages/AddonsManager"));
const IncomeReports = lazy(() => import("./pages/IncomeReports"));
const CustomerImport = lazy(() => import("./pages/CustomerImport"));
const NotificationHub = lazy(() => import("./pages/NotificationHub"));
const MessageHub = lazy(() => import("./pages/MessageHub"));
const SocialAccountsManager = lazy(() => import("./pages/SocialAccountsManager"));

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
        <Route path="/registro" element={<PublicRegister />} />
        <Route path="/brief-publico" element={<PublicBriefStart />} />
        <Route path="/public-brief/:token" element={<PublicCreativeBrief />} />
        <Route path="/client-approval/:token" element={<PublicClientApproval />} />

        {/* Core */}
        <Route path="/dashboard" element={<ProtectedRoute><MarketingDashboard /></ProtectedRoute>} />

        {/* CRM */}
        <Route path="/customer/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
        <Route path="/create-customer" element={<ProtectedRoute><CreateCustomer /></ProtectedRoute>} />
        <Route path="/crm" element={<ClientsRoute><CustomerDirectoryClean /></ClientsRoute>} />
        <Route path="/customers/import" element={<ProtectedRoute><CustomerImport /></ProtectedRoute>} />

        {/* Social Media */}
        <Route path="/social-hub" element={<SocialMediaRoute><SocialHub /></SocialMediaRoute>} />
        <Route path="/content-calendar" element={<SocialMediaRoute><ContentPlanningCenter /></SocialMediaRoute>} />
        <Route path="/approvals" element={<SocialMediaRoute><ApprovalsHub /></SocialMediaRoute>} />
        <Route path="/my-work" element={<ProtectedRoute><MyWork /></ProtectedRoute>} />
        <Route path="/social/accounts" element={<SocialMediaRoute><SocialAccountsManager /></SocialMediaRoute>} />
        <Route path="/social/callback" element={<SocialMediaRoute><SocialAccountsManager /></SocialMediaRoute>} />

        {/* Leads */}
        <Route path="/leads-inbox" element={<ProtectedRoute><LeadsInbox /></ProtectedRoute>} />
        <Route path="/leads-capture" element={<ProtectedRoute><LeadsCapture /></ProtectedRoute>} />
        <Route path="/leads-manage" element={<ProtectedRoute><LeadsManage /></ProtectedRoute>} />
        <Route path="/leads-analytics" element={<ProtectedRoute><LeadsAnalytics /></ProtectedRoute>} />

        {/* Income Management */}
        <Route path="/income" element={<FinanceRoute><IncomeDashboard /></FinanceRoute>} />
        <Route path="/income/subscriptions" element={<FinanceRoute><SubscriptionsManager /></FinanceRoute>} />
        <Route path="/income/payments" element={<FinanceRoute><PaymentManagement /></FinanceRoute>} />
        <Route path="/income/invoice-generator" element={<FinanceRoute><InvoiceGenerator /></FinanceRoute>} />
        <Route path="/income/invoices" element={<FinanceRoute><InvoicesManager /></FinanceRoute>} />
        <Route path="/income/invoices/:id" element={<FinanceRoute><InvoiceDetail /></FinanceRoute>} />
        <Route path="/income/cfdi" element={<FinanceRoute><CfdiFiscal /></FinanceRoute>} />
        <Route path="/income/addons" element={<FinanceRoute><AddonsManager /></FinanceRoute>} />
        <Route path="/income/reports" element={<FinanceRoute><IncomeReports /></FinanceRoute>} />

        {/* HR & Payroll */}
        <Route path="/people" element={<HRRoute><PeopleManagement /></HRRoute>} />
        <Route path="/hr/employees" element={<HRRoute><PeopleManagement /></HRRoute>} />
        <Route path="/hr/payroll" element={<HRRoute><PayrollManagement /></HRRoute>} />
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

        {/* Inventory */}
        <Route path="/inventory-request" element={<ProtectedRoute><InventoryRequest /></ProtectedRoute>} />
        <Route path="/inventory/:id" element={<ProtectedRoute><ProductProfile /></ProtectedRoute>} />
        <Route path="/admin/inventory-request" element={<AdminRoute><InventoryRequest /></AdminRoute>} />
        <Route path="/admin/inventory" element={<AdminRoute><AdminInventoryViewer /></AdminRoute>} />

        {/* Admin */}
        <Route path="/admin/promotions" element={<AdminRoute><AdminPromotions /></AdminRoute>} />
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
