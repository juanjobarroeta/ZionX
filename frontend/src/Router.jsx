import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MarketingDashboard from "./pages/MarketingDashboard";
import AdminPanel from "./pages/AdminPanel";
import CustomerPage from "./pages/CustomerPage";
import CustomerProfile from "./pages/CustomerProfile";
import FinancialProducts from "./pages/FinancialProducts";
import CreateLoan from "./pages/CreateLoan";
import CreateCustomer from "./pages/CreateCustomer";
import LoanApprovals from "./pages/LoanApprovals";
import AccountingEntries from "./pages/AccountingEntries";
import RegisterPayment from "./pages/RegisterPayment";
import LoanStatement from "./pages/LoanStatement";
import CustomerDirectory from "./pages/CustomerDirectory";
import CustomerDirectoryClean from "./pages/CustomerDirectoryClean";
import PublicRegister from "./pages/PublicRegister";
import AdminPromotions from "./pages/AdminPromotions";
import AdminExpenses from "./pages/AdminExpenses";
import ProfitSummary from "./pages/ProfitSummary";
import BalanceSheet from "./pages/BalanceSheet";
import InventoryRequest from "./pages/InventoryRequest"; // fixed export
import AdminApprovals from "./pages/AdminApprovals";
import AdminInventoryViewer from "./pages/AdminInventoryViewer";
import AdminManualEntry from "./pages/AdminManualEntry";
import Tesoreria from "./pages/Tesorería";
import ReclassifyPayment from "./pages/ReclassifyPayment";
import IncomeStatement from "./pages/IncomeStatement";

import AssignIMEI from "./pages/AssignIMEI";
import GenerateContract from "./pages/GenerateContract";
import LoanQuotes from "./pages/LoanQuotes";
import AccountBalances from "./pages/AccountBalances";
import LoanRequest from "./pages/LoanRequest";
import InvestigationsDashboard from "./pages/InvestigationsDashboard";
import InvestigationStepper from "./pages/InvestigationStepper";
import OverdueLoans from "./pages/OverdueLoans";
import LoansDashboard from "./pages/LoansDashboard";

import LoanDetails from "./pages/LoanDetails";
import LoanResolution from "./pages/LoanResolution";
import UnifiedLoanSystem from "./pages/UnifiedLoanSystem";
import LoanStatusManager from "./pages/LoanStatusManager";
import LoanApplicationDetails from "./components/LoanApplicationDetails";
import CollectionsDashboard from "./pages/CollectionsDashboard";
import ProductProfile from "./pages/ProductProfile";
import CreateUser from "./pages/CreateUser";
import StoreDashboard from "./pages/StoreDashboard";
import BudgetManagement from "./pages/BudgetManagement";
import AccountingHub from "./pages/AccountingHub";
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
      <Route path="/investigation" element={<LoanRequest />} />
      <Route path="/investigation-stepper" element={<InvestigationStepper />} />
      <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
      <Route path="/customer/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
      <Route path="/financial-products" element={<ProtectedRoute><FinancialProducts /></ProtectedRoute>} />
      <Route path="/create-loan" element={<ProtectedRoute><CreateLoan /></ProtectedRoute>} />
      <Route path="/create-customer" element={<ProtectedRoute><CreateCustomer /></ProtectedRoute>} />
      <Route path="/admin/loans" element={<AdminRoute><LoanApprovals /></AdminRoute>} />
      <Route
        path="/admin/loan-applications/:id"
        element={
          <AdminRoute>
            <LoanApplicationDetails />
          </AdminRoute>
        }
      />
      {/* Accounting - Finance team */}
      <Route path="/accounting" element={<FinanceRoute><AccountingEntries /></FinanceRoute>} />

      <Route path="/register-payment" element={<ProtectedRoute><RegisterPayment /></ProtectedRoute>} />
      <Route path="/loans/:id/statement" element={<ProtectedRoute><LoanStatement /></ProtectedRoute>} />
      <Route path="/loans/:loan_id/details" element={<ProtectedRoute><LoanDetails /></ProtectedRoute>} />
      <Route path="/loans/:loan_id/resolution" element={<AdminRoute><LoanResolution /></AdminRoute>} />
      <Route path="/loans/:loan_id/status" element={<ProtectedRoute><LoanStatusManager /></ProtectedRoute>} />
      <Route path="/loans/unified" element={<ProtectedRoute><UnifiedLoanSystem /></ProtectedRoute>} />
      <Route path="/loans/unified/:loan_id" element={<ProtectedRoute><UnifiedLoanSystem /></ProtectedRoute>} />
      {/* CRM Routes - Account managers and above */}
      <Route path="/crm" element={<ClientsRoute><CustomerDirectoryClean /></ClientsRoute>} />
      <Route path="/crm-old" element={<ClientsRoute><CustomerDirectory /></ClientsRoute>} />
      {/* Social Media Routes - accessible to content team */}
      <Route path="/social-hub" element={<SocialMediaRoute><SocialHub /></SocialMediaRoute>} />
      <Route path="/content-calendar" element={<SocialMediaRoute><ContentPlanningCenter /></SocialMediaRoute>} />
      
      {/* Leads & WhatsApp Routes */}
      <Route path="/leads-inbox" element={<ProtectedRoute><LeadsInbox /></ProtectedRoute>} />
      <Route path="/leads-capture" element={<ProtectedRoute><LeadsCapture /></ProtectedRoute>} />
      <Route path="/leads-manage" element={<ProtectedRoute><LeadsManage /></ProtectedRoute>} />
      <Route path="/leads-analytics" element={<ProtectedRoute><LeadsAnalytics /></ProtectedRoute>} />
      
      {/* Income Management Routes - Finance team only */}
      <Route path="/income" element={<FinanceRoute><IncomeDashboard /></FinanceRoute>} />
      <Route path="/income/subscriptions" element={<FinanceRoute><SubscriptionsManager /></FinanceRoute>} />
      <Route path="/income/payments" element={<FinanceRoute><PaymentManagement /></FinanceRoute>} />
      <Route path="/income/invoice-generator" element={<FinanceRoute><InvoiceGenerator /></FinanceRoute>} />
      <Route path="/income/invoices" element={<FinanceRoute><InvoicesManager /></FinanceRoute>} />
      <Route path="/income/addons" element={<FinanceRoute><AddonsManager /></FinanceRoute>} />
      <Route path="/income/reports" element={<FinanceRoute><IncomeReports /></FinanceRoute>} />

      {/* HR & Payroll Routes - HR team only */}
      <Route path="/people" element={<HRRoute><PeopleManagement /></HRRoute>} />
      <Route path="/hr/employees" element={<HRRoute><PeopleManagement /></HRRoute>} />
      <Route path="/hr/payroll" element={<HRRoute><PayrollManagement /></HRRoute>} />
      <Route path="/hr/financials" element={<HRRoute><FinancialStatements /></HRRoute>} />
      <Route path="/payroll" element={<HRRoute><PayrollManagement /></HRRoute>} />
      <Route path="/customers/import" element={<ProtectedRoute><CustomerImport /></ProtectedRoute>} />
      
      {/* Notifications & Messaging Routes */}
      <Route path="/notifications" element={<ProtectedRoute><NotificationHub /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><MessageHub /></ProtectedRoute>} />
      
      {/* Social Media Integration Routes */}
      <Route path="/social/accounts" element={<SocialMediaRoute><SocialAccountsManager /></SocialMediaRoute>} />
      <Route path="/social/callback" element={<SocialMediaRoute><SocialAccountsManager /></SocialMediaRoute>} />
      
      {/* Team Management - Managers only */}
      <Route path="/team-management" element={<HRRoute><TeamManagement /></HRRoute>} />
      <Route path="/team-dashboard" element={<ProtectedRoute><TeamDashboardClean /></ProtectedRoute>} />
      <Route path="/team-dashboard-old" element={<ProtectedRoute><TeamDashboard /></ProtectedRoute>} />
      <Route path="/employee/:employeeId" element={<ProtectedRoute><EmployeeDashboardClean /></ProtectedRoute>} />
      <Route path="/employee-old/:employeeId" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />
      <Route path="/registro" element={<PublicRegister />} />
      <Route path="/admin/promotions" element={<AdminRoute><AdminPromotions /></AdminRoute>} />
      <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
      <Route path="/loans" element={<ProtectedRoute><LoansDashboard /></ProtectedRoute>} />
      <Route path="/admin/budgets" element={<AdminRoute><BudgetManagement /></AdminRoute>} />
      <Route path="/admin/profit" element={<AdminRoute><ProfitSummary /></AdminRoute>} />
      <Route path="/admin/balance-sheet" element={<AdminRoute><BalanceSheet /></AdminRoute>} />
      <Route path="/admin/inventory-request" element={<AdminRoute><InventoryRequest /></AdminRoute>} />
      <Route path="/admin/account-balances" element={<AdminRoute><AccountBalances /></AdminRoute>} />
      <Route path="/admin/inventory" element={<AdminInventoryViewer />} />
      <Route
        path="/admin/aprobaciones"
        element={
          <AdminRoute>
            <AdminApprovals />
          </AdminRoute>
        }
      />
      <Route
        path="/inventory-request"
        element={
          <ProtectedRoute>
            <InventoryRequest />
          </ProtectedRoute>
        }
      />
      <Route path="/inventory/:id" element={<ProtectedRoute><ProductProfile /></ProtectedRoute>} />
      <Route
        path="/balance-sheet"
        element={
          <FinanceRoute>
            <BalanceSheet />
          </FinanceRoute>
        }
      />
      <Route path="/admin/manual-entry" element={<FinanceRoute><AdminManualEntry /></FinanceRoute>} />
      <Route path="/admin/tesoreria" element={<FinanceRoute><Tesoreria /></FinanceRoute>} />

      <Route
        path="/income-statement"
        element={
          <FinanceRoute>
            <IncomeStatement />
          </FinanceRoute>
        }
      />
      <Route path="/admin/assign-imei" element={<AdminRoute><AssignIMEI /></AdminRoute>} />
      <Route path="/admin/generate-contract" element={<AdminRoute><GenerateContract /></AdminRoute>} />
      <Route path="/loan-quotes" element={<ProtectedRoute><LoanQuotes /></ProtectedRoute>} />
      <Route path="/admin/investigations" element={<AdminRoute><InvestigationsDashboard /></AdminRoute>} />
      <Route path="/admin/overdue-loans" element={<AdminRoute><OverdueLoans /></AdminRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><MarketingDashboard /></ProtectedRoute>} />
      <Route path="/dashboard-old" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      
      {/* Project Management Routes */}
      <Route path="/projects" element={<ProtectedRoute><ProjectManagement /></ProtectedRoute>} />
      <Route path="/projects/new" element={<ProtectedRoute><CreateProject /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
      
      <Route path="/dashboard/store-dashboard" element={<AdminRoute><StoreDashboard /></AdminRoute>} />
      <Route path="/admin/reclassify-payment" element={<AdminRoute><ReclassifyPayment /></AdminRoute>} />
      <Route path="/accounting-hub" element={<FinanceRoute><AccountingHub /></FinanceRoute>} />
      <Route
        path="/admin/collections"
        element={
          <AdminRoute>
            <CollectionsDashboard />
          </AdminRoute>
        }
      />
      <Route path="/admin/create-user" element={<AdminRoute><CreateUser /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  </Router>
);


     
export default AppRouter;