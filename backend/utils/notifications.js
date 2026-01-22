/**
 * Notification Helper Utilities
 * Use these functions to create notifications throughout the app
 */

/**
 * Create a notification for a user
 * @param {Object} pool - Database pool
 * @param {Object} options - Notification options
 */
async function createNotification(pool, {
  userId,
  title,
  message,
  type = 'info',
  icon = null,
  linkType = null,
  linkId = null,
  linkUrl = null,
  fromUserId = null
}) {
  try {
    await pool.query(`
      INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, link_url, from_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [userId, title, message, type, icon, linkType, linkId, linkUrl, fromUserId]);
    
    console.log(`🔔 Notification sent to user ${userId}: ${title}`);
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

/**
 * Broadcast a notification to multiple users
 * @param {Object} pool - Database pool
 * @param {Array} userIds - Array of user IDs
 * @param {Object} options - Notification options
 */
async function broadcastNotification(pool, userIds, {
  title,
  message,
  type = 'info',
  icon = null,
  linkType = null,
  linkId = null,
  linkUrl = null,
  fromUserId = null
}) {
  try {
    const insertPromises = userIds.map(userId => 
      pool.query(`
        INSERT INTO notifications (user_id, title, message, type, icon, link_type, link_id, link_url, from_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [userId, title, message, type, icon, linkType, linkId, linkUrl, fromUserId])
    );
    
    await Promise.all(insertPromises);
    console.log(`📢 Broadcast notification to ${userIds.length} users: ${title}`);
    return true;
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    return false;
  }
}

/**
 * Notify all admins
 * @param {Object} pool - Database pool
 * @param {Object} options - Notification options
 */
async function notifyAdmins(pool, options) {
  try {
    const admins = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true");
    const adminIds = admins.rows.map(a => a.id);
    
    if (adminIds.length > 0) {
      await broadcastNotification(pool, adminIds, options);
    }
    return true;
  } catch (error) {
    console.error('Error notifying admins:', error);
    return false;
  }
}

/**
 * Notify all active users
 * @param {Object} pool - Database pool
 * @param {Object} options - Notification options
 */
async function notifyAllUsers(pool, options) {
  try {
    const users = await pool.query("SELECT id FROM users WHERE is_active = true");
    const userIds = users.rows.map(u => u.id);
    
    if (userIds.length > 0) {
      await broadcastNotification(pool, userIds, options);
    }
    return true;
  } catch (error) {
    console.error('Error notifying all users:', error);
    return false;
  }
}

// Pre-defined notification templates
const NotificationTemplates = {
  // Customer notifications
  newCustomer: (customerName, customerId) => ({
    title: 'Nuevo cliente registrado',
    message: `Se ha registrado un nuevo cliente: ${customerName}`,
    type: 'success',
    icon: '👤',
    linkType: 'customer',
    linkId: customerId,
    linkUrl: `/customer/${customerId}`
  }),
  
  // Payment notifications
  paymentReceived: (amount, customerName) => ({
    title: 'Pago recibido',
    message: `Se recibió un pago de $${amount.toLocaleString()} de ${customerName}`,
    type: 'success',
    icon: '💰',
    linkType: 'payment',
    linkUrl: '/income/payments'
  }),
  
  // Invoice notifications
  invoiceCreated: (invoiceNumber, amount) => ({
    title: 'Nueva factura creada',
    message: `Factura ${invoiceNumber} por $${amount.toLocaleString()} ha sido creada`,
    type: 'info',
    icon: '📄',
    linkType: 'invoice',
    linkUrl: '/income/invoices'
  }),
  
  invoiceOverdue: (invoiceNumber, customerName) => ({
    title: 'Factura vencida',
    message: `La factura ${invoiceNumber} de ${customerName} está vencida`,
    type: 'warning',
    icon: '⚠️',
    linkType: 'invoice',
    linkUrl: '/income/invoices'
  }),
  
  // Task notifications
  taskAssigned: (taskName, assignedBy) => ({
    title: 'Nueva tarea asignada',
    message: `${assignedBy} te asignó una tarea: ${taskName}`,
    type: 'task',
    icon: '📋',
    linkType: 'task',
    linkUrl: '/team-dashboard'
  }),
  
  taskCompleted: (taskName, completedBy) => ({
    title: 'Tarea completada',
    message: `${completedBy} completó la tarea: ${taskName}`,
    type: 'success',
    icon: '✅',
    linkType: 'task',
    linkUrl: '/team-dashboard'
  }),
  
  // Payroll notifications
  payrollProcessed: (periodName, totalAmount) => ({
    title: 'Nómina procesada',
    message: `La nómina "${periodName}" ha sido procesada por $${totalAmount.toLocaleString()}`,
    type: 'success',
    icon: '💵',
    linkType: 'payroll',
    linkUrl: '/hr/payroll'
  }),
  
  // Lead notifications
  newLead: (leadName, source) => ({
    title: 'Nuevo lead capturado',
    message: `Nuevo lead: ${leadName} desde ${source || 'directo'}`,
    type: 'info',
    icon: '🎯',
    linkType: 'lead',
    linkUrl: '/leads-manage'
  }),
  
  // Project notifications
  projectCreated: (projectName) => ({
    title: 'Nuevo proyecto creado',
    message: `Se ha creado el proyecto: ${projectName}`,
    type: 'info',
    icon: '🎯',
    linkType: 'project',
    linkUrl: '/projects'
  }),
  
  // System notifications
  systemMessage: (message) => ({
    title: 'Mensaje del sistema',
    message: message,
    type: 'system',
    icon: '⚙️'
  }),
  
  welcomeMessage: (userName) => ({
    title: `¡Bienvenido, ${userName}!`,
    message: 'Gracias por unirte a ZIONX Marketing. Explora las funciones del sistema.',
    type: 'info',
    icon: '👋'
  })
};

module.exports = {
  createNotification,
  broadcastNotification,
  notifyAdmins,
  notifyAllUsers,
  NotificationTemplates
};

