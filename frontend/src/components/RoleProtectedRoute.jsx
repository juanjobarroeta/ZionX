import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canAccessPage, getRoleInfo } from '../config/roles';

/**
 * RoleProtectedRoute - Protects routes based on user role
 * 
 * Usage:
 * <RoleProtectedRoute allowedRoles={['admin', 'account_manager']}>
 *   <SomePage />
 * </RoleProtectedRoute>
 * 
 * Or with section-based access:
 * <RoleProtectedRoute section="social_media">
 *   <ContentCalendar />
 * </RoleProtectedRoute>
 */
const RoleProtectedRoute = ({ 
  children, 
  allowedRoles = null, // Array of allowed role keys, e.g., ['admin', 'community_manager']
  section = null,      // Section key, e.g., 'social_media', 'hr', 'contabilidad'
  redirectTo = '/unauthorized'
}) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole') || 'user';
  
  // First check if user is authenticated
  if (!token) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Admin has access to everything
  if (userRole === 'admin') {
    return children;
  }
  
  // Check role-based access
  const roleInfo = getRoleInfo(userRole);
  
  // Check if role is in allowed roles list
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    console.warn(`Access denied: Role "${userRole}" not in allowed roles:`, allowedRoles);
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  
  // Check if user's role has access to the required section
  if (section && roleInfo?.sections && !roleInfo.sections.includes(section)) {
    console.warn(`Access denied: Role "${userRole}" doesn't have access to section "${section}"`);
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  
  // Check page-level access
  if (!canAccessPage(userRole, location.pathname)) {
    console.warn(`Access denied: Role "${userRole}" cannot access "${location.pathname}"`);
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  
  return children;
};

/**
 * Quick access components for common role groups
 */
export const AdminOnly = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['admin']}>
    {children}
  </RoleProtectedRoute>
);

export const ManagersOnly = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['admin', 'account_manager', 'hr_manager']}>
    {children}
  </RoleProtectedRoute>
);

export const ContentTeam = ({ children }) => (
  <RoleProtectedRoute section="social_media">
    {children}
  </RoleProtectedRoute>
);

export const FinanceTeam = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['admin', 'accountant', 'hr_manager']}>
    {children}
  </RoleProtectedRoute>
);

export default RoleProtectedRoute;

