-- Sample Project Management Data for ZIONX Marketing Platform

-- Create a sample project
INSERT INTO projects (
    name, description, customer_id, project_manager_id, 
    start_date, due_date, budget, project_type, priority, status
) VALUES (
    'Campaña Digital ZIONX Q1 2025',
    'Lanzamiento completo de campaña digital para el primer trimestre, incluyendo redes sociales, contenido y análisis de performance',
    1,
    1,
    '2025-01-15',
    '2025-03-31',
    15000.00,
    'marketing_campaign',
    'high',
    'active'
) ON CONFLICT DO NOTHING;

-- Get the project ID for tasks (assuming it's 1 if this is the first project)
-- Create sample tasks for the project
INSERT INTO tasks (
    project_id, title, description, status, priority, 
    task_type, estimated_hours, due_date, created_by
) VALUES 
(1, 'Investigación de Mercado', 'Análisis completo del mercado objetivo y competencia', 'completed', 'high', 'research', 16, '2025-01-25', 1),
(1, 'Estrategia de Contenido', 'Desarrollo de estrategia de contenido para redes sociales', 'in_progress', 'high', 'strategy', 24, '2025-02-05', 1),
(1, 'Diseño de Assets', 'Creación de assets visuales para la campaña', 'todo', 'medium', 'design', 32, '2025-02-15', 1),
(1, 'Configuración de Campañas', 'Setup de campañas en plataformas digitales', 'todo', 'high', 'implementation', 20, '2025-02-20', 1),
(1, 'Análisis y Optimización', 'Monitoreo y optimización de performance', 'todo', 'medium', 'analysis', 40, '2025-03-30', 1)
ON CONFLICT DO NOTHING;

-- Create task assignments
INSERT INTO task_assignments (task_id, assignee_id, assigned_by, assignment_type) VALUES
(1, 1, 1, 'primary'),
(2, 4, 1, 'primary'),
(3, 3, 1, 'primary'),
(4, 2, 1, 'primary'),
(5, 1, 1, 'primary')
ON CONFLICT DO NOTHING;

-- Create project stages
INSERT INTO project_stages (project_id, name, description, stage_order, status) VALUES
(1, 'Investigación y Planificación', 'Fase inicial de investigación y estrategia', 1, 'completed'),
(1, 'Desarrollo Creativo', 'Creación de contenido y assets visuales', 2, 'active'),
(1, 'Implementación', 'Lanzamiento de campañas y configuración', 3, 'pending'),
(1, 'Análisis y Optimización', 'Monitoreo y mejora continua', 4, 'pending')
ON CONFLICT DO NOTHING;

-- Create some follow-ups
INSERT INTO follow_ups (
    project_id, task_id, assignee_id, follow_up_type, 
    title, message, scheduled_for, status, auto_generated
) VALUES
(1, 2, 4, 'deadline_reminder', 'Recordatorio: Estrategia de Contenido', 'La tarea "Estrategia de Contenido" vence pronto. Por favor revisa el progreso.', '2025-02-03 10:00:00', 'pending', true),
(1, 3, 3, 'task_assigned', 'Nueva Asignación: Diseño de Assets', 'Se te ha asignado la tarea "Diseño de Assets". Revisa los requerimientos.', '2025-01-20 09:00:00', 'pending', true),
(1, NULL, 1, 'project_status', 'Revisión Semanal del Proyecto', 'Revisión semanal del progreso general del proyecto ZIONX Q1 2025.', '2025-01-22 14:00:00', 'pending', false)
ON CONFLICT DO NOTHING;

-- Create project activity log
INSERT INTO project_activities (
    project_id, task_id, user_id, activity_type, description
) VALUES
(1, NULL, 1, 'created', 'Proyecto creado: Campaña Digital ZIONX Q1 2025'),
(1, 1, 1, 'task_created', 'Tarea creada: Investigación de Mercado'),
(1, 1, 1, 'status_change', 'Tarea completada: Investigación de Mercado'),
(1, 2, 1, 'task_created', 'Tarea creada: Estrategia de Contenido'),
(1, 2, 4, 'assignment', 'Tarea asignada a Carol Davis: Estrategia de Contenido')
ON CONFLICT DO NOTHING;

-- Create some time entries
INSERT INTO time_entries (
    task_id, team_member_id, project_id, start_time, end_time, 
    duration_minutes, description, billable, hourly_rate
) VALUES
(1, 1, 1, '2025-01-16 09:00:00', '2025-01-16 17:00:00', 480, 'Investigación de mercado y análisis competitivo', true, 75.00),
(1, 1, 1, '2025-01-17 09:00:00', '2025-01-17 13:00:00', 240, 'Finalización del reporte de investigación', true, 75.00),
(2, 4, 1, '2025-01-18 10:00:00', '2025-01-18 15:00:00', 300, 'Desarrollo inicial de estrategia de contenido', true, 65.00)
ON CONFLICT DO NOTHING;





