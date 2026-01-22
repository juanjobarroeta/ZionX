import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const TeamManagement = () => {
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'designer',
    skills: [],
    monthly_wage: '',
    max_daily_tasks: 5,
    phone: '',
    status: 'active'
  });

  const roles = [
    { value: 'designer', label: 'Diseñador', icon: '🎨' },
    { value: 'community_manager', label: 'Community Manager', icon: '📱' },
    { value: 'copywriter', label: 'Copywriter', icon: '✍️' },
    { value: 'photographer', label: 'Fotógrafo', icon: '📸' },
    { value: 'video_editor', label: 'Editor de Video', icon: '🎬' }
  ];

  const skillOptions = {
    designer: ['Photoshop', 'Illustrator', 'Figma', 'After Effects', 'InDesign', 'Canva'],
    community_manager: ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Twitter', 'Analytics'],
    copywriter: ['SEO', 'Email Marketing', 'Blog Writing', 'Social Media Copy', 'Ad Copy'],
    photographer: ['Product Photography', 'Portrait', 'Event Photography', 'Photo Editing'],
    video_editor: ['Premiere Pro', 'After Effects', 'Final Cut Pro', 'Motion Graphics', 'Color Grading']
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data.team_members || response.data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      // Mock data for development
      setTeamMembers([
        {
          id: 1,
          name: 'Ana García',
          email: 'ana@zionx.com',
          role: 'designer',
          skills: ['Photoshop', 'Illustrator', 'Figma'],
          monthly_wage: 15000,
          max_daily_tasks: 5,
          phone: '+52 555 1234',
          status: 'active',
          current_tasks: 3,
          completed_this_month: 45
        },
        {
          id: 2,
          name: 'Carlos López',
          email: 'carlos@zionx.com',
          role: 'community_manager',
          skills: ['Instagram', 'Facebook', 'TikTok', 'Analytics'],
          monthly_wage: 12000,
          max_daily_tasks: 8,
          phone: '+52 555 5678',
          status: 'active',
          current_tasks: 5,
          completed_this_month: 67
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (editingMember) {
        await axios.put(`${API_BASE_URL}/team-members/${editingMember.id}`, formData, { headers });
      } else {
        await axios.post(`${API_BASE_URL}/team-members`, formData, { headers });
      }

      await fetchTeamMembers();
      setShowAddModal(false);
      setEditingMember(null);
      resetForm();
    } catch (error) {
      console.error('Error saving team member:', error);
      alert('Error guardando miembro del equipo');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'designer',
      skills: [],
      monthly_wage: '',
      max_daily_tasks: 5,
      phone: '',
      status: 'active'
    });
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      skills: member.skills || [],
      monthly_wage: member.monthly_wage,
      max_daily_tasks: member.max_daily_tasks,
      phone: member.phone,
      status: member.status
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este miembro del equipo?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/team-members/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchTeamMembers();
    } catch (error) {
      console.error('Error deleting team member:', error);
      alert('Error eliminando miembro del equipo');
    }
  };

  const getRoleInfo = (role) => {
    return roles.find(r => r.value === role) || { label: role, icon: '👤' };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-highlight mx-auto mb-4"></div>
            <p className="text-zionx-accent">Cargando equipo...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-zionx-primary font-display">👥 Gestión de Equipo</h1>
                <p className="text-zionx-accent mt-2">Administra diseñadores, community managers y el equipo creativo</p>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setEditingMember(null);
                  setShowAddModal(true);
                }}
                className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-6 py-3 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all duration-200 transform hover:scale-105"
              >
                ➕ Agregar Miembro
              </button>
            </div>
          </div>
        </div>

        {/* Team Overview */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Total Miembros</p>
                  <p className="text-2xl font-bold text-zionx-primary">{teamMembers.length}</p>
                </div>
                <span className="text-3xl">👥</span>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Diseñadores</p>
                  <p className="text-2xl font-bold text-zionx-primary">
                    {Array.isArray(teamMembers) ? teamMembers.filter(m => m && m.role === 'designer').length : 0}
                  </p>
                </div>
                <span className="text-3xl">🎨</span>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Community Managers</p>
                  <p className="text-2xl font-bold text-zionx-primary">
                    {Array.isArray(teamMembers) ? teamMembers.filter(m => m && m.role === 'community_manager').length : 0}
                  </p>
                </div>
                <span className="text-3xl">📱</span>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zionx-accent text-sm">Tareas Activas</p>
                  <p className="text-2xl font-bold text-zionx-primary">
                    {Array.isArray(teamMembers) ? teamMembers.reduce((sum, m) => sum + (m && m.current_tasks || 0), 0) : 0}
                  </p>
                </div>
                <span className="text-3xl">📋</span>
              </div>
            </div>
          </div>

          {/* Team Members Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(teamMembers) && teamMembers.length > 0 ? (
              teamMembers.map((member) => {
                const roleInfo = getRoleInfo(member.role);
                return (
                  <div key={member.id} className="bg-white rounded-xl p-6 border border-zionx-secondary hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-zionx-accent to-zionx-primary rounded-full flex items-center justify-center text-white font-bold">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-zionx-primary">{member.name}</h3>
                          <p className="text-sm text-zionx-accent">{member.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{roleInfo.icon}</span>
                        <span className="text-sm font-medium text-zionx-primary">{roleInfo.label}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zionx-accent">Tareas Actuales:</span>
                        <span className="font-medium text-zionx-primary">{member.current_tasks || 0}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zionx-accent">Completadas (mes):</span>
                        <span className="font-medium text-green-600">{member.completed_this_month || 0}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zionx-accent">Salario Mensual:</span>
                        <span className="font-medium text-zionx-primary">${member.monthly_wage?.toLocaleString()}</span>
                      </div>

                      {member.skills && member.skills.length > 0 && (
                        <div>
                          <p className="text-xs text-zionx-accent mb-2">Habilidades:</p>
                          <div className="flex flex-wrap gap-1">
                            {member.skills.slice(0, 3).map((skill, idx) => (
                              <span key={idx} className="bg-zionx-secondary text-zionx-primary px-2 py-1 rounded text-xs">
                                {skill}
                              </span>
                            ))}
                            {member.skills.length > 3 && (
                              <span className="text-xs text-zionx-accent">+{member.skills.length - 3} más</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2 mt-4 pt-4 border-t border-zionx-secondary">
                      <button
                        onClick={() => handleEdit(member)}
                        className="flex-1 bg-zionx-secondary text-zionx-primary px-3 py-2 rounded text-sm hover:bg-zionx-accent hover:text-white transition-colors"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => navigate(`/employee/${member.id}`)}
                        className="flex-1 bg-zionx-highlight text-white px-3 py-2 rounded text-sm hover:bg-zionx-accent transition-colors"
                      >
                        👤 Perfil
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12 text-zionx-accent">
                <span className="text-4xl block mb-4">👥</span>
                <p>No hay miembros del equipo</p>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zionx-primary">
                  {editingMember ? 'Editar Miembro' : 'Agregar Miembro'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingMember(null);
                    resetForm();
                  }}
                  className="text-zionx-accent hover:text-zionx-primary"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">Nombre</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value, skills: []})}
                    className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.icon} {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">Habilidades</label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {skillOptions[formData.role]?.map(skill => (
                      <label key={skill} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.skills.includes(skill)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, skills: [...formData.skills, skill]});
                            } else {
                              setFormData({...formData, skills: formData.skills.filter(s => s !== skill)});
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{skill}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zionx-primary mb-1">Salario Mensual ($)</label>
                    <input
                      type="number"
                      value={formData.monthly_wage}
                      onChange={(e) => setFormData({...formData, monthly_wage: e.target.value})}
                      className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                      placeholder="15000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zionx-primary mb-1">Max tareas/día</label>
                    <input
                      type="number"
                      value={formData.max_daily_tasks}
                      onChange={(e) => setFormData({...formData, max_daily_tasks: parseInt(e.target.value)})}
                      className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                      min="1"
                      max="20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingMember(null);
                      resetForm();
                    }}
                    className="flex-1 bg-zionx-secondary text-zionx-primary px-4 py-2 rounded-lg hover:bg-zionx-accent hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all"
                  >
                    {editingMember ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TeamManagement;
