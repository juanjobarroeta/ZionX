import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MarketingDashboard from "./pages/MarketingDashboard";
import AdminPanel from "./pages/AdminPanel";
import CustomerPage from "./pages/CustomerPage";
import CustomerProfile from "./pages/CustomerProfile";
import CreateCustomer from "./pages/CreateCustomer";
import CustomerDirectory from "./pages/CustomerDirectory";
import CustomerDirectoryClean from "./pages/CustomerDirectoryClean";
import PublicRegister from "./pages/PublicRegister";
import AdminPromotions from "./pages/AdminPromotions";
import AdminExpenses from "./pages/AdminExpenses";
import BriefsList from "./pages/BriefsList";
import CreativeBrief from "./pages/CreativeBrief";
import PublicCreativeBrief from "./pages/PublicCreativeBrief";
import PublicBriefStart from "./pages/PublicBriefStart";
import PublicClientApproval from "./pages/PublicClientApproval";
import InventoryRequest from "./pages/InventoryRequest";
import AdminApprovals from "./pages/AdminApprovals";
import AdminInventoryViewer from "./pages/AdminInventoryViewer";
import ProductProfile from "./pages/ProductProfile";
import CreateUser from "./pages/CreateUser";
import UserManagement from "./pages/UserManagement";
import StoreDashboard from "./pages/StoreDashboard";
import BudgetManagement from "./pages/BudgetManagement";
import TeamManagement from "./pages/TeamManagement";
import TeamDashboard from "./pages/TeamDashboard";
import TeamDashboardClean from "./pages/TeamDashboardClean";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeDashboardClean from "./pages/EmployeeDashboardClean";
import SocialHub from "./pages/SocialHub";
import ContentPlanningCenter from "./pages/ContentPlanningCenter";

// Project Management
import ProjectManagement from "./pages/ProjectManagement";
import ProjectDetails from "./pages/ProjectDetails";
import CreateProject from "./pages/CreateProject";

// Leads & WhatsApp
import LeadsInbox from "./pages/LeadsInbox";
import LeadsCapture from "./pages/LeadsCapture";
import LeadsManage from "./pages/LeadsManage";
import LeadsAnalytics from "./pages/LeadsAnalytics";

// Income Management
import IncomeDashboard from "./pages/IncomeDashboard";
import SubscriptionsManager from "./pages/SubscriptionsManager";
import PaymentManagement from "./pages/PaymentManagement";
import InvoiceGenerator from "./pages/InvoiceGenerator";
import InvoicesManager from "./pages/InvoicesManager";
import InvoiceDetail from "./pages/InvoiceDetail";

// HR & Payroll
import EmployeeManagement from "./pages/EmployeeManagement";
import PayrollManagement from "./pages/PayrollManagement";
import FinancialStatements from "./pages/FinancialStatements";
import PeopleManagement from "./pages/PeopleManagement";
import AddonsManager from "./pages/AddonsManager";
import IncomeReports from "./pages/IncomeReports";
import CustomerImport from "./pages/CustomerImport";

// Notifications & Messaging
import NotificationHub from "./pages/NotificationHub";
import MessageHub from "./pages/MessageHub";

// Social Media Integration
import SocialAccountsManager from "./pages/SocialAccountsManager";

// Role-based protection
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import Unauthorized from "./pages/Unauthorized";

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
    <Routes>
      {/* Public Routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/registro" element={<PublicRegister />} />
      <Route path="/brief-publico" element={<PublicBriefStart />} />
      <Route path="/public-brief/:token" element={<PublicCreativeBrief />} />
      <Route path="/client-approval/:token" element={<PublicClientApproval />} />

      {/* Core */}
      <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><MarketingDashboard /></ProtectedRoute>} />
      <Route path="/dashboard-old" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {/* CRM */}
      <Route path="/customer/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
      <Route path="/create-customer" element={<ProtectedRoute><CreateCustomer /></ProtectedRoute>} />
      <Route path="/crm" element={<ClientsRoute><CustomerDirectoryClean /></ClientsRoute>} />
      <Route path="/crm-old" element={<ClientsRoute><CustomerDirectory /></ClientsRoute>} />
      <Route path="/customers/import" element={<ProtectedRoute><CustomerImport /></ProtectedRoute>} />

      {/* Social Media */}
      <Route path="/social-hub" element={<SocialMediaRoute><SocialHub /></SocialMediaRoute>} />
      <Route path="/content-calendar" element={<SocialMediaRoute><ContentPlanningCenter /></SocialMediaRoute>} />
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
      <Route path="/team-dashboard-old" element={<ProtectedRoute><TeamDashboard /></ProtectedRoute>} />
      <Route path="/employee/:employeeId" element={<ProtectedRoute><EmployeeDashboardClean /></ProtectedRoute>} />
      <Route path="/employee-old/:employeeId" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />

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
      <Route path="/admin/inventory" element={<AdminInventoryViewer />} />

      {/* Admin */}
      <Route path="/admin/promotions" element={<AdminRoute><AdminPromotions /></AdminRoute>} />
      <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
      <Route path="/admin/budgets" element={<AdminRoute><BudgetManagement /></AdminRoute>} />
      <Route path="/admin/aprobaciones" element={<AdminRoute><AdminApprovals /></AdminRoute>} />
      <Route path="/admin/create-user" element={<AdminRoute><CreateUser /></AdminRoute>} />
      <Route path="/admin/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
      <Route path="/dashboard/store-dashboard" element={<AdminRoute><StoreDashboard /></AdminRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  </Router>
);

export default AppRouter;
