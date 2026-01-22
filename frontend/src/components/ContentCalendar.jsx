import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const ContentCalendar = ({ customerId, customerData }) => {
  const [contentData, setContentData] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [tempValue, setTempValue] = useState('');

  // Platform-specific format options
  const getFormatOptions = (platform) => {
    const formatsByPlatform = {
      instagram: ['post', 'reel', 'story', 'carousel', 'video'],
      facebook: ['post', 'video', 'story', 'live', 'album'],
      tiktok: ['video', 'duet', 'stitch', 'slideshow', 'live'],
      linkedin: ['post', 'article', 'document', 'video'],
      twitter: ['post', 'video', 'thread'],
    };
    return formatsByPlatform[platform] || ['post', 'video'];
  };

  // Content calendar columns (Excel-like structure as requested)
  const columns = [
    { key: 'post_number', label: 'NUMERO POST', width: '80px', type: 'readonly' },
    { key: 'scheduled_date', label: 'FECHA', width: '120px', type: 'date' },
    { key: 'campaign', label: 'Campaña', width: '150px', type: 'text' },
    { key: 'status', label: 'STATUS', width: '120px', type: 'select', options: ['planificado', 'en_diseño', 'revision', 'aprobado', 'publicado'] },
    { key: 'platform', label: 'PLATAFORMA', width: '130px', type: 'select', options: ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter'] },
    { key: 'pilar', label: 'PILAR', width: '120px', type: 'text' },
    { key: 'content_type', label: 'FORMATO', width: '100px', type: 'dynamic_select' }, // Dynamic based on platform
    { key: 'idea_tema', label: 'IDEA/TEMA', width: '200px', type: 'textarea' },
    { key: 'elementos_utilizar', label: 'ELEMENTOS A UTILIZAR', width: '150px', type: 'file' },
    { key: 'referencia', label: 'REFERENCIA', width: '150px', type: 'text' },
    { key: 'copy_in', label: 'COPY IN', width: '200px', type: 'textarea' },
    { key: 'copy_out', label: 'COPY OUT', width: '200px', type: 'textarea' },
    { key: 'arte', label: 'ARTE', width: '120px', type: 'file' },
    { key: 'fotos_video', label: 'FOTOS Y VIDEO', width: '120px', type: 'boolean' },
    { key: 'assigned_designer', label: 'DISEÑADOR', width: '140px', type: 'team_select', role: 'designer' },
    { key: 'assigned_community_manager', label: 'COMMUNITY MANAGER', width: '140px', type: 'team_select', role: 'community_manager' }
  ];

  useEffect(() => {
    fetchContentCalendar();
    fetchTeamMembers();
  }, [currentMonth, customerId]);

  // Refresh when customer data changes (team assignments)
  useEffect(() => {
    console.log('Customer data in ContentCalendar:', customerData);
    if (customerData && (customerData.default_designer || customerData.default_community_manager)) {
      console.log('Updating content data with default assignments:', {
        designer: customerData.default_designer,
        cm: customerData.default_community_manager
      });
      // Update existing content data with new default assignments and fix numbering
      setContentData(prevData => 
        prevData.map((row, index) => ({
          ...row,
          post_number: index + 1, // Ensure consecutive numbering
          assigned_designer: row.assigned_designer || customerData.default_designer || null,
          assigned_community_manager: row.assigned_community_manager || customerData.default_community_manager || null
        }))
      );
    }
  }, [customerData?.default_designer, customerData?.default_community_manager]);

  const fetchContentCalendar = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/customers/${customerId}/content-calendar/${currentMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Content calendar data from API:', response.data);
      console.log('Customer data available:', customerData);
      console.log('API response length:', response.data?.length);
      console.log('Current month:', currentMonth);
      
      // If no data exists for this month, create empty rows (30 posts)
      if (!response.data || response.data.length === 0) {
        console.log('Creating empty rows because no data found');
        const emptyRows = Array.from({ length: 30 }, (_, i) => ({
          id: null,
          post_number: i + 1,
          customer_id: customerId,
          month_year: currentMonth,
          scheduled_date: '',
          campaign: '',
          status: 'planificado',
          platform: '',
          pilar: '',
          content_type: 'post',
          idea_tema: '',
          elementos_utilizar: [],
          referencia: '',
          copy_in: '',
          copy_out: '',
          arte: null,
          fotos_video: false,
          assigned_designer: customerData?.default_designer || null,
          assigned_community_manager: customerData?.default_community_manager || null
        }));
        setContentData(emptyRows);
      } else {
        // Always create 30 posts, merging any existing data
        const posts = Array.from({ length: 30 }, (_, i) => {
          const postNumber = i + 1;
          const existingPost = response.data.find(row => row.post_number === postNumber);
          
          if (existingPost) {
            // Use direct column mapping now that we have the right columns
            return {
              id: existingPost.id,
              post_number: existingPost.post_number || postNumber,
              customer_id: existingPost.customer_id,
              month_year: existingPost.month_year,
              scheduled_date: existingPost.scheduled_date,
              campaign: existingPost.campaign || '',
              status: existingPost.status,
              platform: existingPost.platform || '',
              pilar: existingPost.pilar || '',
              content_type: existingPost.content_type,
              idea_tema: existingPost.idea_tema || '',
              elementos_utilizar: existingPost.elementos_utilizar || [],
              referencia: existingPost.referencia || '',
              copy_in: existingPost.copy_in || '',
              copy_out: existingPost.copy_out || '',
              arte: existingPost.arte || null,
              fotos_video: existingPost.fotos_video || false,
              assigned_designer: existingPost.assigned_designer || customerData?.default_designer || null,
              assigned_community_manager: existingPost.assigned_community_manager || customerData?.default_community_manager || null
            };
          } else {
            // Create empty post with default assignments
            return {
              id: null,
              post_number: postNumber,
              customer_id: customerId,
              month_year: currentMonth,
              scheduled_date: '',
              campaign: '',
              status: 'planificado',
              platform: '',
              pilar: '',
              content_type: 'post',
              idea_tema: '',
              elementos_utilizar: [],
              referencia: '',
              copy_in: '',
              copy_out: '',
              arte: null,
              fotos_video: false,
              assigned_designer: customerData?.default_designer || null,
              assigned_community_manager: customerData?.default_community_manager || null
            };
          }
        });
        
        setContentData(posts);
      }
    } catch (error) {
      console.error('Error fetching content calendar:', error);
      // Create empty rows as fallback
      const emptyRows = Array.from({ length: 30 }, (_, i) => ({
        id: null,
        post_number: i + 1,
        customer_id: customerId,
        month_year: currentMonth,
        scheduled_date: '',
        campaign: '',
        status: 'planificado',
        pilar: '',
        content_type: 'post',
        idea_tema: '',
        elementos_utilizar: [],
        referencia: '',
        copy_in: '',
        copy_out: '',
        arte: null,
        fotos_video: false,
        assigned_designer: null,
        assigned_community_manager: null
      }));
      setContentData(emptyRows);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const members = response.data.team_members || response.data || [];
      console.log('Team members loaded in ContentCalendar:', members);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
      // Mock team members for demo
      setTeamMembers([
        { id: 1, name: 'Ana García', role: 'designer', skills: ['photoshop', 'illustrator'] },
        { id: 2, name: 'Carlos López', role: 'community_manager', skills: ['copywriting', 'social_media'] },
        { id: 3, name: 'María Rodríguez', role: 'designer', skills: ['video_editing', 'motion_graphics'] }
      ]);
    }
  };

  const updateCell = async (rowIndex, field, value) => {
    try {
      const updatedData = [...contentData];
      updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };
      setContentData(updatedData);

      // Save to backend
      const token = localStorage.getItem('token');
      const rowData = updatedData[rowIndex];
      
      console.log('Updating cell:', { field, value, rowData });
      console.log('Row has ID?', !!rowData.id);
      console.log('Will create new post?', !rowData.id);
      
      // Check if we're assigning team members
      const isTeamAssignment = field === 'assigned_designer' || field === 'assigned_community_manager';
      const shouldGenerateTasks = isTeamAssignment && value && rowData.assigned_designer && rowData.assigned_community_manager;
      
      if (rowData.id) {
        // Update existing row
        console.log('📤 Updating existing post, platform value:', rowData.platform);
        await axios.put(`${API_BASE_URL}/content-calendar/${rowData.id}`, rowData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Auto-generate tasks if both team members are now assigned
        if (shouldGenerateTasks) {
          console.log('🚀 Both team members assigned, auto-generating tasks...');
          await createTasksForPost(rowData);
        }
      } else {
        // Create new row - use direct escaleta field mapping
        const cleanRowData = {
          customer_id: rowData.customer_id,
          month_year: rowData.month_year,
          post_number: rowData.post_number,
          campaign: rowData.campaign || '',
          platform: rowData.platform || '',
          pilar: rowData.pilar || '',
          content_type: rowData.content_type || 'post',
          scheduled_date: rowData.scheduled_date || null,
          status: rowData.status || 'planificado',
          idea_tema: rowData.idea_tema || '',
          referencia: rowData.referencia || '',
          copy_in: rowData.copy_in || '',
          copy_out: rowData.copy_out || '',
          arte: rowData.arte || '',
          fotos_video: rowData.fotos_video || false,
          elementos_utilizar: rowData.elementos_utilizar || [],
          assigned_designer: rowData.assigned_designer,
          assigned_community_manager: rowData.assigned_community_manager
        };
        
        console.log('Creating new content calendar entry with platform:', cleanRowData.platform);
        console.log('Full cleanRowData:', cleanRowData);
        
        const response = await axios.post(`${API_BASE_URL}/content-calendar`, cleanRowData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        updatedData[rowIndex].id = response.data.data.id;
        setContentData(updatedData);
        
        // Auto-create tasks for team members when a new post is created
        if (response.data.data) {
          await createTasksForPost(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error updating content calendar:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const createTasksForPost = async (postData) => {
    try {
      const token = localStorage.getItem('token');
      
      // Create tasks based on post requirements
      const tasks = [];
      
      // Check if tasks already exist for this post to prevent duplicates
      const existingTasksRes = await axios.get(
        `${API_BASE_URL}/tasks/by-post/${postData.customer_id}/${postData.post_number}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => ({ data: [] }));
      
      if (existingTasksRes.data && existingTasksRes.data.length > 0) {
        console.log('⚠️ Tasks already exist for this post, skipping generation');
        return;
      }
      
      // Always create a design task
      if (postData.assigned_designer) {
        tasks.push({
          title: `Diseñar ${postData.content_type} para ${postData.campaign || 'Campaña'}`,
          description: `Crear arte para ${postData.content_type} - Post #${postData.post_number}`,
          assigned_to: postData.assigned_designer,
          customer_id: postData.customer_id,
          post_id: postData.id,
          post_number: postData.post_number,
          due_date: postData.scheduled_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
          task_type: 'design',
          priority: postData.scheduled_date && new Date(postData.scheduled_date) - new Date() < 2 * 24 * 60 * 60 * 1000 ? 'high' : 'medium',
          required_files: ['arte'],
          content_details: {
            campaign: postData.campaign,
            platform: postData.platform,
            format: postData.content_type,
            idea_tema: postData.idea_tema,
            pilar: postData.pilar,
            referencia: postData.referencia,
            copy_in: postData.copy_in,
            elementos_utilizar: postData.elementos_utilizar
          }
        });
      }
      
      // Create community management task if assigned
      if (postData.assigned_community_manager) {
        tasks.push({
          title: `Gestionar publicación - ${postData.campaign || 'Campaña'}`,
          description: `Programar y publicar ${postData.content_type} - Post #${postData.post_number}`,
          assigned_to: postData.assigned_community_manager,
          customer_id: postData.customer_id,
          post_id: postData.id,
          post_number: postData.post_number,
          due_date: postData.scheduled_date || new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 day from now
          task_type: 'community_management',
          priority: 'medium',
          required_files: ['copy_final'],
          content_details: {
            campaign: postData.campaign,
            platform: postData.platform,
            format: postData.content_type,
            copy_out: postData.copy_out,
            scheduled_date: postData.scheduled_date
          }
        });
      }
      
      // Create tasks in backend
      for (const task of tasks) {
        await axios.post(`${API_BASE_URL}/tasks`, task, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      console.log(`✅ Created ${tasks.length} tasks for post #${postData.post_number}`);
      
    } catch (error) {
      console.error('Error creating tasks for post:', error);
    }
  };

  const handleCellClick = (rowIndex, field, currentValue) => {
    // Don't allow editing of post numbers - they're auto-assigned
    if (field === 'post_number') {
      return;
    }
    setEditingCell({ row: rowIndex, field });
    setTempValue(currentValue || '');
  };

  const handleCellSave = () => {
    if (editingCell) {
      updateCell(editingCell.row, editingCell.field, tempValue);
      setEditingCell(null);
      setTempValue('');
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setTempValue('');
  };

  const handleFileUpload = async (files, rowIndex, fieldKey) => {
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`files`, file);
      });
      formData.append('category', fieldKey);
      formData.append('customer_id', customerId);
      formData.append('row_index', rowIndex);

      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE_URL}/customers/${customerId}/files/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // Update the specific cell with the uploaded file info
        const updatedData = [...contentData];
        const fileInfo = response.data.files.map(file => ({
          name: file.original_name,
          url: file.file_path,
          id: file.id
        }));
        
        // For carousel arte files, store in arte_files array
        const isCarousel = updatedData[rowIndex].content_type === 'carousel' || 
                          updatedData[rowIndex].content_type === 'slideshow' || 
                          updatedData[rowIndex].content_type === 'album';
        
        if (fieldKey === 'arte' && isCarousel && files.length > 1) {
          // Multiple arte files for carousel
          updatedData[rowIndex] = { 
            ...updatedData[rowIndex], 
            arte_files: fileInfo, // Store in arte_files
            arte: fileInfo[0].url // Keep first one as main arte for backwards compatibility
          };
          setContentData(updatedData);
          updateCell(rowIndex, 'arte_files', fileInfo);
          updateCell(rowIndex, 'arte', fileInfo[0].url);
        } else {
          // Single file or elementos
          updatedData[rowIndex] = { 
            ...updatedData[rowIndex], 
            [fieldKey]: files.length === 1 ? fileInfo[0].url : fileInfo 
          };
          setContentData(updatedData);
          updateCell(rowIndex, fieldKey, files.length === 1 ? fileInfo[0].url : fileInfo);
        }
        
        alert(`✅ ${files.length} archivo(s) subido(s) exitosamente`);
      }
    } catch (err) {
      console.error(`Error uploading files for ${fieldKey}:`, err);
      alert(`Error subiendo archivos para ${fieldKey}`);
    }
  };

  const renderCell = (row, column, rowIndex) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.field === column.key;
    const value = row[column.key];

    if (isEditing) {
      switch (column.type) {
        case 'select':
          return (
            <select
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleCellSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCellSave();
                if (e.key === 'Escape') handleCellCancel();
              }}
              autoFocus
              className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="">Seleccionar...</option>
              {column.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          );
        
        case 'dynamic_select':
          // Format options change based on platform
          const formatOptions = getFormatOptions(row.platform || 'instagram');
          return (
            <select
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleCellSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCellSave();
                if (e.key === 'Escape') handleCellCancel();
              }}
              className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
              autoFocus
            >
              <option value="">Seleccionar...</option>
              {formatOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          );
        case 'textarea':
          return (
            <textarea
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleCellSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleCellSave();
                if (e.key === 'Escape') handleCellCancel();
              }}
              className="w-full bg-white border border-zionx-secondary rounded px-2 py-1 text-sm focus:border-zionx-highlight focus:outline-none resize-none"
              rows={2}
              autoFocus
            />
          );
        case 'boolean':
          return (
            <select
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value === 'true')}
              onBlur={handleCellSave}
              className="w-full bg-white border border-zionx-secondary rounded px-2 py-1 text-sm focus:border-zionx-highlight focus:outline-none"
              autoFocus
            >
              <option value={false}>No</option>
              <option value={true}>Sí</option>
            </select>
          );
        case 'file':
          // Allow multiple files for arte if it's a carousel or slideshow
          const isCarouselType = row.content_type === 'carousel' || row.content_type === 'slideshow' || row.content_type === 'album';
          const allowMultiple = column.key === 'elementos_utilizar' || (column.key === 'arte' && isCarouselType);
          
          return (
            <div className="w-full">
              <input
                type="file"
                multiple={allowMultiple}
                accept={column.key === 'arte' ? 'image/*,video/*' : 'image/*,video/*'}
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length > 0) {
                    handleFileUpload(files, rowIndex, column.key);
                    handleCellCancel();
                  }
                }}
                className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                autoFocus
              />
              {allowMultiple && (
                <p className="text-xs text-gray-500 mt-1">
                  📎 Puedes seleccionar múltiples archivos {column.key === 'arte' ? 'para carousel' : ''}
                </p>
              )}
            </div>
          );
        case 'team_select':
          const roleMembers = (Array.isArray(teamMembers) ? teamMembers : []).filter(m => 
            m && (
              (column.role === 'designer' && (m.role === 'UI/UX Designer' || m.role === 'designer')) ||
              (column.role === 'community_manager' && (m.role === 'Content Strategist' || m.role === 'community_manager'))
            )
          );
          return (
            <select
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleCellSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCellSave();
                if (e.key === 'Escape') handleCellCancel();
              }}
              className="w-full bg-white border border-zionx-secondary rounded px-2 py-1 text-sm focus:border-zionx-highlight focus:outline-none"
              autoFocus
            >
              <option value="">Sin asignar</option>
              {roleMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          );
        default:
          return (
            <input
              type={column.type === 'date' ? 'date' : 'text'}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleCellSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCellSave();
                if (e.key === 'Escape') handleCellCancel();
              }}
              className="w-full bg-white border border-zionx-secondary rounded px-2 py-1 text-sm focus:border-zionx-highlight focus:outline-none"
              autoFocus
            />
          );
      }
    }

    // Display mode
    const cellContent = () => {
      switch (column.type) {
        case 'boolean':
          return value ? '✅ Sí' : '❌ No';
        case 'readonly':
          return (
            <span className="font-bold text-zionx-primary bg-zionx-secondary px-2 py-1 rounded">
              #{value}
            </span>
          );
        case 'select':
        case 'dynamic_select':
          return value || '-';
        case 'date':
          return value ? new Date(value).toLocaleDateString() : '-';
        case 'team_select':
          if (value) {
            const member = (Array.isArray(teamMembers) ? teamMembers : []).find(m => m && m.id == value);
            console.log('Team select display:', { value, member, teamMembers: teamMembers.map(m => ({ id: m.id, name: m.name })) });
            return member ? (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                👤 {member.name}
              </span>
            ) : (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                ❓ ID: {value}
              </span>
            );
          }
          return '-';
        case 'file':
          if (value && value.length > 0) {
            return (
              <div className="flex flex-wrap gap-1">
                {Array.isArray(value) ? value.map((file, idx) => (
                  <button
                    key={idx}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs hover:bg-blue-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle file download
                      window.open(file.url || file, '_blank');
                    }}
                  >
                    📎 {file.name || `Archivo ${idx + 1}`}
                  </button>
                )) : (
                  <button
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs hover:bg-blue-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(value, '_blank');
                    }}
                  >
                    📎 Archivo
                  </button>
                )}
              </div>
            );
          }
          return (
            <button
              className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                // Trigger file upload
                const input = document.createElement('input');
                input.type = 'file';
                const isCarousel = row.content_type === 'carousel' || row.content_type === 'slideshow' || row.content_type === 'album';
                input.multiple = column.key === 'elementos_utilizar' || (column.key === 'arte' && isCarousel);
                input.accept = 'image/*,video/*';
                input.onchange = (event) => {
                  const files = Array.from(event.target.files);
                  // Handle file upload here
                  handleFileUpload(files, rowIndex, column.key);
                };
                input.click();
              }}
            >
              📤 Subir
            </button>
          );
        default:
          return value || '-';
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'planificado': return 'bg-zionx-secondary text-zionx-primary';
        case 'en_diseño': return 'bg-yellow-100 text-yellow-800';
        case 'revision': return 'bg-orange-100 text-orange-800';
        case 'aprobado': return 'bg-green-100 text-green-800';
        case 'publicado': return 'bg-zionx-highlight text-white';
        default: return 'bg-zionx-tertiary text-zionx-primary';
      }
    };

    return (
      <div
        className={`px-3 py-2 min-h-[40px] cursor-pointer hover:bg-zionx-tertiary/50 transition-colors ${
          column.key === 'status' ? `${getStatusColor(value)} rounded-md text-center` : ''
        }`}
        onClick={() => handleCellClick(rowIndex, column.key, value)}
        style={{ width: column.width }}
      >
        <span className="text-sm">{cellContent()}</span>
      </div>
    );
  };

  const addNewRow = async () => {
    try {
      // Create the post in database immediately with default values
      const newRow = {
        customer_id: customerId,
        month_year: currentMonth,
        post_number: contentData.length + 1,
        campaign: '',
        pilar: '',
        content_type: 'post',
        scheduled_date: null,
        status: 'planificado',
        idea_tema: '',
        referencia: '',
        copy_in: '',
        copy_out: '',
        arte: '',
        fotos_video: false,
        elementos_utilizar: [],
        assigned_designer: customerData?.default_designer || null,
        assigned_community_manager: customerData?.default_community_manager || null
      };

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/content-calendar`, newRow, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Refresh the calendar to show the new post with proper ID
        await fetchContentCalendar();
      }
    } catch (error) {
      console.error('Error creating new post:', error);
      alert('Error creando nuevo post');
    }
  };

  const workloadSummary = useMemo(() => {
    const designerWorkload = {};
    const cmWorkload = {};

    // Safe array handling
    (contentData || []).forEach(row => {
      if (row && row.assigned_designer) {
        designerWorkload[row.assigned_designer] = (designerWorkload[row.assigned_designer] || 0) + 1;
      }
      if (row && row.assigned_community_manager) {
        cmWorkload[row.assigned_community_manager] = (cmWorkload[row.assigned_community_manager] || 0) + 1;
      }
    });

    // Also include default assignments from customer data
    if (customerData?.default_designer) {
      designerWorkload[customerData.default_designer] = designerWorkload[customerData.default_designer] || 0;
    }
    if (customerData?.default_community_manager) {
      cmWorkload[customerData.default_community_manager] = cmWorkload[customerData.default_community_manager] || 0;
    }

    return { designerWorkload, cmWorkload };
  }, [contentData, customerData]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-zionx-primary">📅 Calendario de Contenido</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-zionx-primary font-medium">Mes:</label>
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="bg-white border border-zionx-secondary rounded-lg px-3 py-2 text-zionx-primary focus:border-zionx-highlight focus:outline-none"
              />
            </div>
            <button
              onClick={addNewRow}
              className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all"
            >
              ➕ Agregar Post
            </button>
          </div>
        </div>

        {/* Workload Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-zionx-secondary">
            <h4 className="font-bold text-zionx-primary mb-2">👨‍🎨 Carga de Diseñadores</h4>
            <div className="space-y-2">
              {/* Show only assigned designer for this customer */}
              {customerData?.default_designer ? (() => {
                const assignedDesigner = (Array.isArray(teamMembers) ? teamMembers : [])
                  .find(m => m && m.id == customerData.default_designer);
                
                return assignedDesigner ? (
                  <div className="flex justify-between">
                    <span className="text-zionx-primary">
                      {assignedDesigner.name}
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Principal</span>
                    </span>
                    <span className="text-zionx-accent">{workloadSummary.designerWorkload[assignedDesigner.id] || 0} posts</span>
                  </div>
                ) : (
                  <p className="text-zionx-accent text-sm">Diseñador asignado no encontrado</p>
                );
              })() : (
                <p className="text-zionx-accent text-sm">No hay diseñador asignado a este cliente</p>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-zionx-secondary">
            <h4 className="font-bold text-zionx-primary mb-2">📱 Carga de Community Managers</h4>
            <div className="space-y-2">
              {/* Show only assigned CM for this customer */}
              {customerData?.default_community_manager ? (() => {
                const assignedCM = (Array.isArray(teamMembers) ? teamMembers : [])
                  .find(m => m && m.id == customerData.default_community_manager);
                
                return assignedCM ? (
                  <div className="flex justify-between">
                    <span className="text-zionx-primary">
                      {assignedCM.name}
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Principal</span>
                    </span>
                    <span className="text-zionx-accent">{workloadSummary.cmWorkload[assignedCM.id] || 0} posts</span>
                  </div>
                ) : (
                  <p className="text-zionx-accent text-sm">Community Manager asignado no encontrado</p>
                );
              })() : (
                <p className="text-zionx-accent text-sm">No hay community manager asignado a este cliente</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Excel-like Table */}
      <div className="bg-white rounded-xl border border-zionx-secondary overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header Row */}
            <div className="bg-zionx-accent text-white flex items-center">
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="px-3 py-3 font-semibold text-sm border-r border-zionx-primary/20 flex items-center justify-center"
                  style={{ width: column.width, minWidth: column.width }}
                >
                  {column.label}
                </div>
              ))}
              <div className="px-3 py-3 font-semibold text-sm w-24">Acciones</div>
            </div>

            {/* Data Rows */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zionx-highlight"></div>
                <span className="ml-3 text-zionx-accent">Cargando calendario...</span>
              </div>
            ) : (
              (contentData || []).map((row, rowIndex) => (
                <div
                  key={`${row.id || rowIndex}-${rowIndex}`}
                  className={`flex items-center border-b border-zionx-secondary hover:bg-zionx-tertiary/30 ${
                    row.status === 'publicado' ? 'bg-green-50' : 
                    row.status === 'aprobado' ? 'bg-blue-50' : 
                    row.status === 'en_diseño' ? 'bg-yellow-50' : 
                    row.status === 'revision' ? 'bg-orange-50' : ''
                  }`}
                >
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className="border-r border-zionx-secondary/30"
                      style={{ width: column.width, minWidth: column.width }}
                    >
                      {renderCell(row, column, rowIndex)}
                    </div>
                  ))}
                  
                  {/* Actions Column */}
                  <div className="px-3 py-2 w-24 flex space-x-1">
                    <button
                      onClick={async () => {
                        // Generate tasks for this post if it has content and team assignments
                        const postData = row;
                        
                        if (!postData.assigned_designer && !postData.assigned_community_manager) {
                          alert('Este post necesita tener diseñador y/o community manager asignado para generar tareas');
                          return;
                        }
                        
                        if (!postData.campaign && !postData.idea_tema) {
                          alert('Este post necesita tener campaña o idea/tema para generar tareas');
                          return;
                        }
                        
                        try {
                          // Save post first if it doesn't have an ID
                          if (!postData.id) {
                            await updateCell(rowIndex, 'status', postData.status || 'planificado');
                          }
                          
                          // Generate actual tasks for team members
                          const tasks = [];
                          
                          // Create designer task (responsible for ARTE)
                          if (postData.assigned_designer) {
                            tasks.push({
                              title: `Crear ARTE para ${postData.campaign || 'Post'} #${postData.post_number}`,
                              description: `Diseñar arte para ${postData.content_type} - ${postData.idea_tema || 'Contenido visual'}`,
                              assigned_to: postData.assigned_designer,
                              customer_id: postData.customer_id,
                              post_id: postData.id,
                              post_number: postData.post_number,
                              due_date: postData.scheduled_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              task_type: 'design',
                              priority: postData.scheduled_date && new Date(postData.scheduled_date) - new Date() < 2 * 24 * 60 * 60 * 1000 ? 'high' : 'medium',
                              required_files: ['arte'],
                              content_details: {
                                campaign: postData.campaign,
                                format: postData.content_type,
                                idea_tema: postData.idea_tema,
                                pilar: postData.pilar,
                                elementos_utilizar: postData.elementos_utilizar,
                                referencia: postData.referencia,
                                fotos_video: postData.fotos_video
                              }
                            });
                          }
                          
                          // Create CM task (responsible for COPY IN/OUT)
                          if (postData.assigned_community_manager) {
                            tasks.push({
                              title: `Crear COPY para ${postData.campaign || 'Post'} #${postData.post_number}`,
                              description: `Escribir copy in/out para ${postData.content_type} - ${postData.idea_tema || 'Contenido'}`,
                              assigned_to: postData.assigned_community_manager,
                              customer_id: postData.customer_id,
                              post_id: postData.id,
                              post_number: postData.post_number,
                              due_date: postData.scheduled_date || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              task_type: 'copywriting',
                              priority: 'medium',
                              required_files: ['copy_in', 'copy_out'],
                              content_details: {
                                campaign: postData.campaign,
                                format: postData.content_type,
                                idea_tema: postData.idea_tema,
                                pilar: postData.pilar,
                                copy_in: postData.copy_in,
                                copy_out: postData.copy_out,
                                scheduled_date: postData.scheduled_date
                              }
                            });
                          }
                          
                          // Create tasks in backend
                          const token = localStorage.getItem('token');
                          const createdTasks = [];
                          
                          for (const task of tasks) {
                            try {
                              const response = await axios.post(`${API_BASE_URL}/tasks`, task, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              createdTasks.push(response.data.data);
                            } catch (taskError) {
                              console.error('Error creating individual task:', taskError);
                            }
                          }
                          
                          // Update status to show tasks are generated
                          await updateCell(rowIndex, 'status', 'en_diseño');
                          
                          const designerName = (Array.isArray(teamMembers) ? teamMembers : []).find(m => m && m.id == postData.assigned_designer)?.name || 'Diseñador';
                          const cmName = (Array.isArray(teamMembers) ? teamMembers : []).find(m => m && m.id == postData.assigned_community_manager)?.name || 'CM';
                          
                          alert(`✅ ${createdTasks.length} tareas generadas para Post #${postData.post_number}!\n\n🎨 ${designerName}: Crear ARTE\n📝 ${cmName}: Escribir COPY IN/OUT\n\nLas tareas aparecerán en sus dashboards individuales.`);
                          
                        } catch (error) {
                          console.error('Error generating tasks:', error);
                          alert('Error generando tareas para este post');
                        }
                      }}
                      className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 transition-colors"
                      title="Guardar y generar tareas"
                    >
                      💾
                    </button>
                    <button
                      onClick={() => {
                        const updatedData = contentData.filter((_, i) => i !== rowIndex);
                        setContentData(updatedData);
                      }}
                      className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                      title="Eliminar fila"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Monthly Statistics */}
      <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
        <h3 className="text-xl font-bold text-zionx-primary mb-4">📊 Estadísticas del Mes</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 text-center border border-zionx-secondary">
            <div className="text-2xl font-bold text-zionx-primary">{(contentData || []).filter(r => r && r.status === 'planificado').length}</div>
            <div className="text-zionx-accent text-sm">Planificados</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-zionx-secondary">
            <div className="text-2xl font-bold text-yellow-600">{(contentData || []).filter(r => r && r.status === 'en_diseño').length}</div>
            <div className="text-zionx-accent text-sm">En Diseño</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-zionx-secondary">
            <div className="text-2xl font-bold text-orange-600">{(contentData || []).filter(r => r && r.status === 'revision').length}</div>
            <div className="text-zionx-accent text-sm">En Revisión</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-zionx-secondary">
            <div className="text-2xl font-bold text-green-600">{(contentData || []).filter(r => r && r.status === 'aprobado').length}</div>
            <div className="text-zionx-accent text-sm">Aprobados</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-zionx-secondary">
            <div className="text-2xl font-bold text-zionx-highlight">{(contentData || []).filter(r => r && r.status === 'publicado').length}</div>
            <div className="text-zionx-accent text-sm">Publicados</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCalendar;
