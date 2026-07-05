import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import "./TeamManagement.css";

const TeamManagement = () => {
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'designer_jr',
    skills: [],
    monthly_wage: '',
    max_daily_tasks: 5,
    phone: '',
    status: 'active'
  });

  const roles = [
    { value: 'designer_jr', label: 'Diseñador Jr', icon: '🎨' },
    { value: 'designer_sr', label: 'Diseñador Sr', icon: '🎨' },
    { value: 'community_manager', label: 'Community Manager', icon: '📱' },
    { value: 'project_manager', label: 'Project Manager', icon: '📋' },
    { value: 'copywriter', label: 'Copywriter', icon: '✍️' },
    { value: 'photographer', label: 'Fotógrafo', icon: '📸' },
    { value: 'video_editor', label: 'Editor de Video', icon: '🎬' }
  ];

  const skillOptions = {
    designer_jr: ['Photoshop', 'Illustrator', 'Canva', 'InDesign', 'Figma'],
    designer_sr: ['Photoshop', 'Illustrator', 'Figma', 'After Effects', 'InDesign', 'Canva', 'Branding', 'UI/UX'],
    community_manager: ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Twitter', 'Analytics'],
    project_manager: ['Gestión de Proyectos', 'Planificación', 'Coordinación', 'Cliente', 'Presupuestos', 'Reportes'],
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
      role: 'designer_jr',
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
      case 'active': return 'active';
      case 'busy': return 'busy';
      case 'offline': return 'offline';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="zxtem">
          <div className="zxtem-inner">
            <div className="zxtem-loading">Cargando equipo…</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxtem">
        <div className="zxtem-inner">
          {/* Header */}
          <div className="zxtem-head">
            <div>
              <div className="zxtem-eyebrow">Equipo</div>
              <h1 className="zxtem-h1">Gestión de <span className="zxtem-serif">equipo</span></h1>
              <p className="zxtem-sub">Administra diseñadores, community managers y el equipo creativo</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditingMember(null);
                setShowAddModal(true);
              }}
              className="zxtem-btn solid"
            >
              Agregar miembro
            </button>
          </div>

          {/* Team Overview */}
          <div className="zxtem-stats">
            <div className="zxtem-stat">
              <span className="v">{teamMembers.length}</span>
              <span className="k">Total miembros</span>
            </div>
            <div className="zxtem-stat">
              <span className="v">
                {Array.isArray(teamMembers) ? teamMembers.filter(m => m && (m.role === 'designer_jr' || m.role === 'designer_sr' || m.role === 'designer')).length : 0}
              </span>
              <span className="k">Diseñadores</span>
            </div>
            <div className="zxtem-stat">
              <span className="v">
                {Array.isArray(teamMembers) ? teamMembers.filter(m => m && m.role === 'community_manager').length : 0}
              </span>
              <span className="k">Community Managers</span>
            </div>
            <div className="zxtem-stat">
              <span className="v">
                {Array.isArray(teamMembers) ? teamMembers.reduce((sum, m) => sum + (m && m.current_tasks || 0), 0) : 0}
              </span>
              <span className="k">Tareas activas</span>
            </div>
          </div>

          {/* Team Members Grid */}
          <div className="zxtem-grid">
            {Array.isArray(teamMembers) && teamMembers.length > 0 ? (
              teamMembers.map((member) => {
                const roleInfo = getRoleInfo(member.role);
                return (
                  <div key={member.id} className="zxtem-card">
                    <div className="zxtem-card-top">
                      <div className="zxtem-id">
                        <div className="zxtem-avatar">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <div className="name">{member.name}</div>
                          <div className="email">{member.email}</div>
                        </div>
                      </div>
                      <span className={`zxtem-status ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </div>

                    <div className="zxtem-role">
                      <span className="ico">{roleInfo.icon}</span>
                      <span>{roleInfo.label}</span>
                    </div>

                    <div className="zxtem-meta">
                      <div className="zxtem-metarow">
                        <span className="k">Tareas Actuales</span>
                        <span className="val">{member.current_tasks || 0}</span>
                      </div>

                      <div className="zxtem-metarow">
                        <span className="k">Completadas (mes)</span>
                        <span className="val ok">{member.completed_this_month || 0}</span>
                      </div>

                      <div className="zxtem-metarow">
                        <span className="k">Salario Mensual</span>
                        <span className="val">${member.monthly_wage?.toLocaleString()}</span>
                      </div>
                    </div>

                    {member.skills && member.skills.length > 0 && (
                      <div className="zxtem-skills">
                        <div className="lbl">Habilidades</div>
                        <div className="zxtem-chips">
                          {member.skills.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="zxtem-chip">
                              {skill}
                            </span>
                          ))}
                          {member.skills.length > 3 && (
                            <span className="zxtem-more">+{member.skills.length - 3} más</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="zxtem-cardfoot">
                      <button
                        onClick={() => handleEdit(member)}
                        className="zxtem-btn sm grow"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => navigate(`/employee/${member.id}`)}
                        className="zxtem-btn sm grow"
                      >
                        👤 Perfil
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="zxtem-btn sm danger"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="zxtem-empty">
                <span className="ico">👥</span>
                <p>No hay miembros del equipo</p>
              </div>
            )}
          </div>

          {/* Add/Edit Modal */}
          {showAddModal && (
            <div className="zxtem-scrim">
              <div className="zxtem-modal">
                <div className="zxtem-modal-head">
                  <h3>
                    {editingMember ? 'Editar miembro' : 'Agregar miembro'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingMember(null);
                      resetForm();
                    }}
                    className="zxtem-close"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="zxtem-form">
                  <div className="zxtem-fld">
                    <label>Nombre</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="zxtem-input"
                      required
                    />
                  </div>

                  <div className="zxtem-fld">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="zxtem-input"
                      required
                    />
                  </div>

                  <div className="zxtem-fld">
                    <label>Rol</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value, skills: []})}
                      className="zxtem-select"
                    >
                      {roles.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.icon} {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="zxtem-fld">
                    <label>Habilidades</label>
                    <div className="zxtem-checks">
                      {skillOptions[formData.role]?.map(skill => (
                        <label key={skill} className="zxtem-check">
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
                          />
                          <span>{skill}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="zxtem-two">
                    <div className="zxtem-fld">
                      <label>Salario Mensual ($)</label>
                      <input
                        type="number"
                        value={formData.monthly_wage}
                        onChange={(e) => setFormData({...formData, monthly_wage: e.target.value})}
                        className="zxtem-input"
                        placeholder="15000"
                      />
                    </div>
                    <div className="zxtem-fld">
                      <label>Max tareas/día</label>
                      <input
                        type="number"
                        value={formData.max_daily_tasks}
                        onChange={(e) => setFormData({...formData, max_daily_tasks: parseInt(e.target.value)})}
                        className="zxtem-input"
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>

                  <div className="zxtem-fld">
                    <label>Teléfono</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="zxtem-input"
                    />
                  </div>

                  <div className="zxtem-modal-foot">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingMember(null);
                        resetForm();
                      }}
                      className="zxtem-btn"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="zxtem-btn solid"
                    >
                      {editingMember ? 'Actualizar' : 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TeamManagement;
