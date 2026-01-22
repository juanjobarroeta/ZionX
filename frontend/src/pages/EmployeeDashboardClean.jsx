import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const EmployeeDashboardClean = () => {
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [viewMode, setViewMode] = useState('kanban'); // kanban or list
  const [selectedTask, setSelectedTask] = useState(null);
  const [postData, setPostData] = useState(null); // To store post files
  const [uploadedFiles, setUploadedFiles] = useState([]); // Files uploaded for current task
  const [uploading, setUploading] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState([]); // Other tasks for the same post
  
  // Post metadata for community manager to fill
  const [postMetadata, setPostMetadata] = useState({
    copy_out: '',
    scheduled_date: '',
    scheduled_time: '',
    platform: '',
    location: '',
    hashtags: ''
  });

  useEffect(() => {
    fetchEmployeeData();
    fetchTasks();
  }, [employeeId]);

  // Fetch post data and related tasks when task is selected
  useEffect(() => {
    const fetchPostData = async () => {
      if (selectedTask?.customer_id) {
        try {
          const token = localStorage.getItem('token');
          const monthYear = selectedTask.due_date?.slice(0, 7) || new Date().toISOString().slice(0, 7);
          
          const response = await axios.get(
            `${API_BASE_URL}/customers/${selectedTask.customer_id}/content-calendar/${monthYear}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          // Find post by post_number since post_id might not be in task
          const post = response.data.find(p => 
            p.post_number === selectedTask.post_number && 
            p.customer_id === selectedTask.customer_id
          );
          console.log('Found post data for task:', post);
          console.log('Post has arte:', post?.arte);
          console.log('Post has elementos:', post?.elementos_utilizar);
          console.log('Post copy_in:', post?.copy_in);
          console.log('Post copy_out:', post?.copy_out);
          setPostData(post);
        } catch (error) {
          console.error('Error fetching post data:', error);
        }
      } else {
        setPostData(null);
      }
    };

    const fetchRelatedTasks = async () => {
      if (selectedTask?.customer_id && selectedTask?.post_number) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(
            `${API_BASE_URL}/tasks/by-post/${selectedTask.customer_id}/${selectedTask.post_number}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          // Filter out the current task
          const otherTasks = response.data.filter(t => t.id !== selectedTask.id);
          setRelatedTasks(otherTasks);
        } catch (error) {
          console.error('Error fetching related tasks:', error);
          setRelatedTasks([]);
        }
      } else {
        setRelatedTasks([]);
      }
    };
    
    if (selectedTask) {
      fetchPostData();
      fetchRelatedTasks();
      setUploadedFiles([]); // Reset uploaded files when task changes
    } else {
      setPostMetadata({
        copy_out: '',
        scheduled_date: '',
        scheduled_time: '',
        platform: '',
        location: '',
        hashtags: ''
      });
    }
  }, [selectedTask]);

  // Update metadata when postData is loaded
  useEffect(() => {
    if (postData) {
      console.log('📊 Loading post data into form:', postData);
      
      // Parse scheduled_date properly - handle both ISO format and space-separated format
      let dateOnly = '';
      let timeOnly = '';
      
      if (postData.scheduled_date) {
        if (postData.scheduled_date.includes('T')) {
          // ISO format: "2025-11-16T06:00:00.000Z"
          const date = new Date(postData.scheduled_date);
          dateOnly = date.toISOString().split('T')[0]; // "2025-11-16"
          timeOnly = date.toTimeString().split(' ')[0].slice(0, 5); // "HH:MM"
        } else if (postData.scheduled_date.includes(' ')) {
          // Space-separated format: "2025-11-16 10:00:00"
          const parts = postData.scheduled_date.split(' ');
          dateOnly = parts[0];
          timeOnly = parts[1]?.slice(0, 5) || '';
        } else {
          // Just a date: "2025-11-16"
          dateOnly = postData.scheduled_date;
        }
      } else if (postData.date) {
        // Fallback to date field
        dateOnly = postData.date.includes('T') ? postData.date.split('T')[0] : postData.date.split(' ')[0];
      }
      
      const platformValue = (postData.platform || postData.platform_type || '').toLowerCase().trim();
      console.log('🔍 Platform from DB:', postData.platform);
      console.log('🔍 Platform processed:', platformValue);
      
      setPostMetadata({
        copy_out: postData.copy_out || '',
        scheduled_date: dateOnly,
        scheduled_time: timeOnly,
        platform: platformValue,
        location: postData.location || '',
        hashtags: Array.isArray(postData.hashtags) ? postData.hashtags.join(' ') : (postData.hashtags || '')
      });
    }
  }, [postData]);

  const fetchEmployeeData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const allMembers = response.data.team_members || [];
      const targetEmployee = allMembers.find(member => member.id == employeeId);
      
      if (targetEmployee) {
        setEmployee(targetEmployee);
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/team-members/${employeeId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.length > 0) {
        setTasks(response.data);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const getTasksByStatus = (status) => {
    return tasks.filter(t => {
      if (status === 'pending') return t.status === 'todo' || t.status === 'pending';
      if (status === 'in_progress') return t.status === 'in_progress';
      if (status === 'review') return t.status === 'review';
      if (status === 'completed') return t.status === 'completed';
      return false;
    });
  };

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const savePostMetadata = async () => {
    try {
      const customerId = selectedTask.customer_id || selectedTask.custom_fields?.customer_id;
      const postNumber = selectedTask.post_number || selectedTask.custom_fields?.post_number;
      const monthYear = selectedTask.due_date?.slice(0, 7) || new Date().toISOString().slice(0, 7);

      const token = localStorage.getItem('token');
      
      // Convert hashtags string to array (split by space or comma)
      const hashtagsArray = postMetadata.hashtags 
        ? postMetadata.hashtags.split(/[\s,]+/).filter(h => h.trim())
        : null;

      await axios.put(
        `${API_BASE_URL}/customers/${customerId}/content-calendar/${monthYear}/${postNumber}`,
        {
          copy_out: postMetadata.copy_out,
          scheduled_date: postMetadata.scheduled_date, // Send only the date, not combined
          scheduled_time: postMetadata.scheduled_time, // Send time separately
          platform: postMetadata.platform,
          location: postMetadata.location,
          hashtags: hashtagsArray
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('✅ Información del post guardada');
      return true;
    } catch (error) {
      console.error('Error saving post metadata:', error);
      alert('Error al guardar la información del post');
      return false;
    }
  };

  const validatePostComplete = () => {
    const errors = [];
    
    // Check if arte exists (from any design task)
    if (!postData?.arte && !relatedTasks.some(t => t.task_type === 'design' && t.custom_fields?.deliverable_file)) {
      errors.push('Falta el ARTE (imagen/diseño)');
    }

    // Check if required metadata is filled
    if (!postMetadata.copy_out?.trim()) {
      errors.push('Falta el Copy Out (texto de la publicación)');
    }
    if (!postMetadata.scheduled_date) {
      errors.push('Falta la fecha de publicación');
    }
    if (!postMetadata.platform) {
      errors.push('Falta seleccionar la plataforma');
    }

    return errors;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // Extract customer_id and post_number from task's custom_fields if needed
      const customerId = selectedTask.customer_id || selectedTask.custom_fields?.customer_id;
      const postNumber = selectedTask.post_number || selectedTask.custom_fields?.post_number;

      console.log('📤 Uploading file for task:', selectedTask.id);
      console.log('📤 Customer ID:', customerId, 'Post Number:', postNumber);

      if (!customerId || !postNumber) {
        console.error('❌ Missing customer_id or post_number', { selectedTask });
        alert('Error: Faltan datos de la tarea (customer_id o post_number). Por favor contacta al administrador.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('customer_id', customerId);
      formData.append('post_number', postNumber);
      formData.append('task_id', selectedTask.id);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/tasks/${selectedTask.id}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setUploadedFiles([...uploadedFiles, { name: file.name, url: response.data.file_url }]);
      alert('✅ Archivo subido exitosamente');
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = error.response?.data?.details || error.response?.data?.error || error.message;
      alert(`Error al subir el archivo: ${errorMsg}\n\nPor favor intenta de nuevo.`);
    } finally {
      setUploading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      
      // If sending to review, validate based on task type
      if (newStatus === 'review') {
        const taskType = selectedTask.task_type;
        
        // For design tasks, require file upload
        if (taskType === 'design') {
          if (uploadedFiles.length === 0) {
            alert('⚠️ Debes subir el archivo de diseño (ARTE) antes de enviar a revisión.');
            return;
          }
        }

        // For non-design tasks (copy/community/etc), save metadata and validate
        if (taskType !== 'design') {
          // Save the metadata first
          const saved = await savePostMetadata();
          if (!saved) return;

          // Validate that all required fields are filled
          const validationErrors = validatePostComplete();
          if (validationErrors.length > 0) {
            const confirmed = window.confirm(
              `⚠️ El post aún no está completo:\n\n` +
              validationErrors.map(e => `• ${e}`).join('\n') +
              `\n\n¿Quieres enviar a revisión de todos modos?`
            );
            if (!confirmed) return;
          } else {
            // All fields are complete!
            alert('✅ Información del post guardada y completa. Enviando a revisión.');
          }
        }

        // Check if there are related tasks not yet ready
        if (relatedTasks.length > 0) {
          const pendingTasks = relatedTasks.filter(t => 
            t.status !== 'review' && t.status !== 'completed' && !t.custom_fields?.deliverable_file
          );

          if (pendingTasks.length > 0) {
            const taskNames = pendingTasks.map(t => `${t.assigned_to_name} (${t.task_type})`).join(', ');
            const confirmed = window.confirm(
              `⚠️ Hay otras tareas pendientes para este post:\n\n${taskNames}\n\n` +
              `¿Estás seguro que quieres enviar tu parte a revisión? El post completo estará listo cuando todas las tareas estén terminadas.`
            );
            if (!confirmed) return;
          } else {
            // All related tasks are ready! Validate the complete post
            const validationErrors = validatePostComplete();
            if (validationErrors.length === 0) {
              alert('✅ ¡Perfecto! Todas las tareas y la información del post están completas. Enviando a revisión final.');
            } else {
              alert(`⚠️ Todas las tareas están listas, pero falta:\n\n${validationErrors.map(e => `• ${e}`).join('\n')}\n\nEnviando a revisión de todos modos.`);
            }
          }
        }
      }

      await axios.put(
        `${API_BASE_URL}/tasks/${taskId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh tasks and close modal
      await fetchTasks();
      setSelectedTask(null);
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Error al actualizar la tarea. Por favor intenta de nuevo.');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-black"></div>
        </div>
      </Layout>
    );
  }

  const pendingTasks = getTasksByStatus('pending');
  const inProgressTasks = getTasksByStatus('in_progress');
  const reviewTasks = getTasksByStatus('review');
  const completedTasks = getTasksByStatus('completed');

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {employee?.name?.charAt(0) || 'E'}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-black">{employee?.name || 'Empleado'}</h1>
                <p className="text-gray-500 text-sm">{employee?.role || 'Team Member'}</p>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-black">{pendingTasks.length}</p>
                <p className="text-xs text-gray-500">Pendientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-black">{completedTasks.length}</p>
                <p className="text-xs text-gray-500">Completadas</p>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Tabs */}
        <div className="px-8 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                  viewMode === 'kanban' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                }`}
              >
                📋 Kanban
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                  viewMode === 'list' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                }`}
              >
                📄 Lista
              </button>
            </div>
          </div>
        </div>

        {/* Tasks Content */}
        <div className="px-8 py-6">
          {viewMode === 'kanban' ? (
            /* Kanban View */
            <div className="grid grid-cols-4 gap-4">
              {[
                { id: 'pending', label: 'Pendientes', tasks: pendingTasks, color: 'bg-yellow-100 text-yellow-700' },
                { id: 'in_progress', label: 'En Progreso', tasks: inProgressTasks, color: 'bg-blue-100 text-blue-700' },
                { id: 'review', label: 'En Revisión', tasks: reviewTasks, color: 'bg-purple-100 text-purple-700' },
                { id: 'completed', label: 'Completadas', tasks: completedTasks, color: 'bg-green-100 text-green-700' }
              ].map(column => (
                <div key={column.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-black text-sm">{column.label}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${column.color}`}>
                      {column.tasks.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {column.tasks.map(task => {
                      const daysUntil = getDaysUntilDue(task.due_date);
                      const isOverdue = daysUntil < 0;
                      
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                            isOverdue && column.id === 'pending' ? 'border-red-300 bg-red-50' : 'border-gray-200'
                          } ${column.id === 'completed' ? 'opacity-75' : ''}`}
                        >
                          <h4 className="font-medium text-black text-sm mb-2 line-clamp-2">{task.title}</h4>
                          <p className="text-xs text-gray-500 mb-2">{task.customer_name}</p>
                          <p className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            📅 {new Date(task.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      );
                    })}
                    {column.tasks.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Sin tareas</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div>
              <div className="flex space-x-2 mb-4">
              {[
                { id: 'pending', label: 'Pendientes', count: pendingTasks.length },
                { id: 'in_progress', label: 'En Progreso', count: inProgressTasks.length },
                { id: 'review', label: 'En Revisión', count: reviewTasks.length },
                { id: 'completed', label: 'Completadas', count: completedTasks.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
              </div>
              <div className="space-y-4">
            {getTasksByStatus(activeTab).map(task => {
              const daysUntil = getDaysUntilDue(task.due_date);
              const isOverdue = daysUntil < 0;
              
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-black transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-black">{task.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority?.toUpperCase() || 'MEDIUM'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>👤 {task.customer_name || 'Cliente'}</span>
                        <span>📝 Post #{task.post_number}</span>
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          📅 {new Date(task.due_date).toLocaleDateString('es-ES')}
                          {isOverdue ? ` (${Math.abs(daysUntil)} días vencida)` : 
                           daysUntil === 0 ? ' (Hoy)' : 
                           daysUntil === 1 ? ' (Mañana)' : 
                           daysUntil > 0 ? ` (${daysUntil} días)` : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-2">
                      {activeTab === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTaskStatus(task.id, 'in_progress');
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                        >
                          🔄 Iniciar
                        </button>
                      )}
                      {activeTab === 'in_progress' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                          }}
                          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                        >
                          📤 Subir y Enviar
                        </button>
                      )}
                      {activeTab === 'review' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTaskStatus(task.id, 'completed');
                          }}
                          className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                        >
                          ✓ Aprobar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

                {getTasksByStatus(activeTab).length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No hay tareas en esta categoría</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Task Detail Modal */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-black">{selectedTask.title}</h2>
                  <p className="text-xs text-gray-500">{selectedTask.customer_name} • Post #{selectedTask.post_number}</p>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-black text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {/* Task Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fecha de Entrega</p>
                    <p className="text-sm font-medium text-black">
                      {new Date(selectedTask.due_date).toLocaleDateString('es-ES', { 
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tipo de Tarea</p>
                    <p className="text-sm font-medium text-black capitalize">{selectedTask.task_type}</p>
                  </div>
                </div>

                {/* Related Tasks - Co-workers working on same post */}
                {relatedTasks.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      🤝 Colaboradores en este Post
                    </p>
                    <div className="space-y-2">
                      {relatedTasks.map(task => {
                        const hasFile = task.custom_fields?.deliverable_file;
                        const isReady = task.status === 'review' || task.status === 'completed' || hasFile;
                        
                        return (
                          <div 
                            key={task.id} 
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isReady 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-yellow-50 border-yellow-200'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                isReady ? 'bg-green-500' : 'bg-yellow-500'
                              }`}>
                                {task.assigned_to_name?.charAt(0) || 'T'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-black">
                                  {task.assigned_to_name || 'Colaborador'}
                                </p>
                                <p className="text-xs text-gray-600 capitalize">
                                  {task.task_type === 'design' ? 'Diseño' : 
                                   task.task_type === 'copy' ? 'Copy' : task.task_type}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {isReady ? (
                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                                  ✓ Listo
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                                  ⏳ En proceso
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {relatedTasks.every(t => t.status === 'review' || t.status === 'completed' || t.custom_fields?.deliverable_file) && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs text-green-700 font-medium">
                          ✅ ¡Todos los colaboradores han terminado! El post está listo para revisión final.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Files from Post */}
                {postData && (postData.arte || postData.arte_files || postData.elementos_utilizar) && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Archivos del Post</p>
                    
                    {/* ARTE Preview - Support carousel with multiple files */}
                    {(postData.arte_files && postData.arte_files.length > 0) ? (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">ARTE Carousel ({postData.arte_files.length} archivos)</p>
                        <div className="grid grid-cols-2 gap-2">
                          {postData.arte_files.map((file, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                              {file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img 
                                  src={`http://localhost:5001${file.url}`} 
                                  alt={`ARTE ${idx + 1}`} 
                                  className="w-full h-auto rounded cursor-pointer"
                                  onClick={() => window.open(`http://localhost:5001${file.url}`, '_blank')}
                                />
                              ) : (
                                <a 
                                  href={`http://localhost:5001${file.url}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 text-blue-600 hover:underline"
                                >
                                  <span>📎</span>
                                  <span className="text-xs">{file.name || `Archivo ${idx + 1}`}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : postData.arte ? (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">ARTE Final</p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          {postData.arte.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img 
                              src={`http://localhost:5001${postData.arte}`} 
                              alt="ARTE" 
                              className="max-w-full h-auto rounded"
                            />
                          ) : (
                            <a 
                              href={`http://localhost:5001${postData.arte}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 text-blue-600 hover:underline"
                            >
                              <span>📎</span>
                              <span className="text-sm">{postData.arte.split('/').pop()}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Elementos Preview */}
                    {postData.elementos_utilizar && postData.elementos_utilizar.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Elementos de Referencia</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(Array.isArray(postData.elementos_utilizar) 
                            ? postData.elementos_utilizar 
                            : JSON.parse(postData.elementos_utilizar || '[]')
                          ).map((file, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                              {file.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img 
                                  src={`http://localhost:5001${file}`} 
                                  alt={`Elemento ${idx + 1}`} 
                                  className="w-full h-24 object-cover rounded cursor-pointer"
                                  onClick={() => window.open(`http://localhost:5001${file}`, '_blank')}
                                />
                              ) : (
                                <a 
                                  href={`http://localhost:5001${file}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block text-center text-xs text-blue-600 hover:underline"
                                >
                                  📎 {file.split('/').pop()}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!postData && selectedTask.customer_id && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center py-4">
                      Cargando información del post #{selectedTask.post_number}...
                    </p>
                  </div>
                )}

                {/* Brief - Show from post data if available, fallback to task details */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Brief del Contenido</p>
                  
                  {(postData?.campaign || selectedTask.content_details?.campaign) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Campaña</p>
                      <p className="text-sm text-black">{postData?.campaign || selectedTask.content_details?.campaign}</p>
                    </div>
                  )}

                  {(postData?.pilar || selectedTask.content_details?.pilar) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Pilar</p>
                      <p className="text-sm text-black">{postData?.pilar || selectedTask.content_details?.pilar}</p>
                    </div>
                  )}

                  {(postData?.idea_tema || selectedTask.content_details?.idea_tema) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Idea/Tema</p>
                      <p className="text-sm text-black whitespace-pre-wrap">{postData?.idea_tema || selectedTask.content_details?.idea_tema}</p>
                    </div>
                  )}

                  {(postData?.referencia || selectedTask.content_details?.referencia) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Referencia</p>
                      <a 
                        href={postData?.referencia || selectedTask.content_details?.referencia} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {postData?.referencia || selectedTask.content_details?.referencia}
                      </a>
                    </div>
                  )}

                  {(postData?.copy_in) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Copy In</p>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-sm text-black whitespace-pre-wrap">{postData.copy_in}</p>
                      </div>
                    </div>
                  )}

                  {(postData?.copy_out) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Copy Out</p>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-sm text-black whitespace-pre-wrap">{postData.copy_out}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Post Information Form - For Copy/Community Tasks */}
                {selectedTask.task_type !== 'design' && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      📝 Información de Publicación
                    </p>
                    
                    <div className="space-y-4">
                      {/* Copy Out */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Copy Out (Texto para Publicar) <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={postMetadata.copy_out}
                          onChange={(e) => setPostMetadata({...postMetadata, copy_out: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
                          rows={4}
                          placeholder="Escribe el texto que se publicará en la red social..."
                        />
                        <p className="text-xs text-gray-400 mt-1">{postMetadata.copy_out.length} caracteres</p>
                      </div>

                      {/* Platform */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Plataforma <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={postMetadata.platform || ""}
                          onChange={(e) => setPostMetadata({...postMetadata, platform: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        >
                          <option value="">Selecciona una plataforma</option>
                          <option value="instagram">📷 Instagram</option>
                          <option value="facebook">📘 Facebook</option>
                          <option value="tiktok">🎵 TikTok</option>
                          <option value="linkedin">💼 LinkedIn</option>
                          <option value="twitter">🐦 Twitter/X</option>
                        </select>
                        {postMetadata.platform && (
                          <p className="text-xs text-green-600 mt-1">✓ Ya establecida: {postMetadata.platform}</p>
                        )}
                      </div>

                      {/* Date and Time */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Fecha <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={postMetadata.scheduled_date}
                            onChange={(e) => setPostMetadata({...postMetadata, scheduled_date: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                          />
                          {postMetadata.scheduled_date && (
                            <p className="text-xs text-green-600 mt-1">✓ Programada</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Hora
                          </label>
                          <input
                            type="time"
                            value={postMetadata.scheduled_time}
                            onChange={(e) => setPostMetadata({...postMetadata, scheduled_time: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                          />
                        </div>
                      </div>

                      {/* Location (Optional) */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Ubicación (Opcional)
                        </label>
                        <input
                          type="text"
                          value={postMetadata.location}
                          onChange={(e) => setPostMetadata({...postMetadata, location: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                          placeholder="Ej: Ciudad de México, México"
                        />
                      </div>

                      {/* Hashtags (Optional) */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Hashtags (Opcional)
                        </label>
                        <input
                          type="text"
                          value={postMetadata.hashtags}
                          onChange={(e) => setPostMetadata({...postMetadata, hashtags: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                          placeholder="#ejemplo #marketing #social"
                        />
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={savePostMetadata}
                        className="w-full bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        💾 Guardar Información del Post
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Section - Only for Design tasks */}
                {selectedTask.task_type === 'design' && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      Entregables <span className="text-red-500">*</span>
                    </p>
                    
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input 
                        type="file" 
                        className="hidden" 
                        id="file-upload" 
                        onChange={handleFileUpload}
                        disabled={uploading || selectedTask.status === 'completed'}
                        accept="image/*,.psd,.ai"
                      />
                      <label htmlFor="file-upload" className={uploading ? 'cursor-wait' : 'cursor-pointer'}>
                        <div className="mb-2">
                          <span className="text-4xl">{uploading ? '⏳' : '📤'}</span>
                        </div>
                        <p className="text-sm text-black font-medium">
                          {uploading ? 'Subiendo...' : 'Subir ARTE'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          ARTE final (JPG, PNG, PSD, AI)
                        </p>
                      </label>
                    </div>

                    {/* Uploaded Files */}
                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">✅</span>
                              <span className="text-sm text-black font-medium">{file.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Optional file upload for non-design tasks */}
                {selectedTask.task_type !== 'design' && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      Archivos Adicionales (Opcional)
                    </p>
                    
                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                      <input 
                        type="file" 
                        className="hidden" 
                        id="file-upload-optional" 
                        onChange={handleFileUpload}
                        disabled={uploading || selectedTask.status === 'completed'}
                      />
                      <label htmlFor="file-upload-optional" className={uploading ? 'cursor-wait' : 'cursor-pointer'}>
                        <p className="text-xs text-gray-500">
                          {uploading ? 'Subiendo...' : 'Si tienes documentos adicionales, puedes subirlos aquí'}
                        </p>
                      </label>
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">✅</span>
                              <span className="text-xs text-black font-medium">{file.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-black px-6 py-2 rounded-lg transition-colors"
                >
                  Cerrar
                </button>
                {(selectedTask.status === 'pending' || selectedTask.status === 'todo') && (
                  <button 
                    onClick={() => updateTaskStatus(selectedTask.id, 'in_progress')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    🔄 Iniciar Tarea
                  </button>
                )}
                {selectedTask.status === 'in_progress' && (
                  <button 
                    onClick={() => updateTaskStatus(selectedTask.id, 'review')}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors"
                    disabled={selectedTask.task_type === 'design' && uploadedFiles.length === 0}
                    title={
                      selectedTask.task_type === 'design' && uploadedFiles.length === 0
                        ? 'Debes subir el ARTE primero'
                        : selectedTask.task_type !== 'design'
                        ? 'Completa el formulario y envía a revisión'
                        : 'Enviar a revisión'
                    }
                  >
                    👀 Enviar a Revisión
                  </button>
                )}
                {selectedTask.status === 'review' && (
                  <button 
                    onClick={() => updateTaskStatus(selectedTask.id, 'completed')}
                    className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    ✓ Aprobar y Completar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EmployeeDashboardClean;


