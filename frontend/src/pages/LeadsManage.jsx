import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const LeadsManage = () => {
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', source: 'all', assigned_to: 'all' });
  const [editingLead, setEditingLead] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'kanban'

  useEffect(() => {
    fetchLeads();
    fetchTeamMembers();
  }, [filter]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let queryParams = [];
      if (filter.status !== 'all') queryParams.push(`status=${filter.status}`);
      if (filter.source !== 'all') queryParams.push(`source=${filter.source}`);
      if (filter.assigned_to !== 'all') queryParams.push(`assigned_to=${filter.assigned_to}`);
      
      const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
      
      const response = await axios.get(`${API_BASE_URL}/leads${queryString}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeads(response.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
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
      setTeamMembers(response.data.team_members || []);
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/leads/${leadId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead:', error);
      alert('Error al actualizar el lead');
    }
  };

  const assignLead = async (leadId, teamMemberId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/leads/${leadId}`,
        { assigned_to: teamMemberId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchLeads();
    } catch (error) {
      console.error('Error assigning lead:', error);
      alert('Error al asignar el lead');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-blue-500',
      contacted: 'bg-yellow-500',
      qualified: 'bg-purple-500',
      proposal_sent: 'bg-indigo-500',
      negotiation: 'bg-orange-500',
      converted: 'bg-green-500',
      lost: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status) => {
    const labels = {
      new: 'Nuevo',
      contacted: 'Contactado',
      qualified: 'Calificado',
      proposal_sent: 'Propuesta Enviada',
      negotiation: 'Negociación',
      converted: 'Convertido',
      lost: 'Perdido',
    };
    return labels[status] || status;
  };

  const leadsByStatus = {
    new: leads.filter(l => l.status === 'new'),
    contacted: leads.filter(l => l.status === 'contacted'),
    qualified: leads.filter(l => l.status === 'qualified'),
    proposal_sent: leads.filter(l => l.status === 'proposal_sent'),
    negotiation: leads.filter(l => l.status === 'negotiation'),
    converted: leads.filter(l => l.status === 'converted'),
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">📊 Gestión de Leads</h1>
              <p className="text-gray-600">Administra y da seguimiento a tus leads</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.href = '/leads-capture'}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                ➕ Capturar Lead
              </button>
              <button
                onClick={() => window.location.href = '/leads-inbox'}
                className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                💬 Ir al Inbox
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-1">Total Leads</p>
            <p className="text-3xl font-bold text-black">{leads.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-1">Nuevos</p>
            <p className="text-3xl font-bold text-blue-600">{leadsByStatus.new.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-1">Calificados</p>
            <p className="text-3xl font-bold text-purple-600">{leadsByStatus.qualified.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-1">Convertidos</p>
            <p className="text-3xl font-bold text-green-600">{leadsByStatus.converted.length}</p>
          </div>
        </div>

        {/* Filters & View Mode */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex space-x-3">
            <select
              value={filter.status}
              onChange={(e) => setFilter({...filter, status: e.target.value})}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">Todos los Estados</option>
              <option value="new">Nuevos</option>
              <option value="contacted">Contactados</option>
              <option value="qualified">Calificados</option>
              <option value="proposal_sent">Propuesta Enviada</option>
              <option value="negotiation">Negociación</option>
              <option value="converted">Convertidos</option>
              <option value="lost">Perdidos</option>
            </select>

            <select
              value={filter.source}
              onChange={(e) => setFilter({...filter, source: e.target.value})}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">Todas las Fuentes</option>
              <option value="website">Sitio Web</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="whatsapp_direct">WhatsApp Directo</option>
              <option value="referral">Referido</option>
            </select>

            <select
              value={filter.assigned_to}
              onChange={(e) => setFilter({...filter, assigned_to: e.target.value})}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">Todos los Asignados</option>
              <option value="">Sin Asignar</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Tabla
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 Pipeline
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          </div>
        )}

        {/* Table View */}
        {!loading && viewMode === 'table' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Servicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      No hay leads para mostrar
                    </td>
                  </tr>
                ) : (
                  leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                            {(lead.whatsapp_name || 'L').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-black">{lead.whatsapp_name || 'Sin nombre'}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(lead.created_at).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-black">{lead.phone_number}</p>
                        {lead.email && <p className="text-xs text-gray-500">{lead.email}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-black">
                        {lead.service_interest || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          className={`text-xs px-3 py-1 rounded-full font-medium border-0 ${getStatusColor(lead.status)} text-white cursor-pointer`}
                        >
                          <option value="new">Nuevo</option>
                          <option value="contacted">Contactado</option>
                          <option value="qualified">Calificado</option>
                          <option value="proposal_sent">Propuesta</option>
                          <option value="negotiation">Negociación</option>
                          <option value="converted">Convertido</option>
                          <option value="lost">Perdido</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={lead.assigned_to || ''}
                          onChange={(e) => assignLead(lead.id, e.target.value || null)}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1"
                        >
                          <option value="">Sin asignar</option>
                          {teamMembers.map(member => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => window.location.href = `/leads-inbox?lead=${lead.id}`}
                            className="text-green-600 hover:text-green-700 text-sm"
                            title="Abrir chat"
                          >
                            💬
                          </button>
                          <button
                            onClick={() => setEditingLead(lead)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                            title="Editar"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Kanban View */}
        {!loading && viewMode === 'kanban' && (
          <div className="grid grid-cols-6 gap-4">
            {['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted'].map(status => (
              <div key={status} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-black text-sm">{getStatusLabel(status)}</h3>
                  <span className={`${getStatusColor(status)} text-white px-2 py-1 rounded text-xs font-bold`}>
                    {leadsByStatus[status]?.length || 0}
                  </span>
                </div>
                <div className="space-y-3">
                  {(leadsByStatus[status] || []).map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => window.location.href = `/leads-inbox?lead=${lead.id}`}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <p className="font-medium text-black text-sm mb-2">{lead.whatsapp_name || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-500 mb-2">{lead.phone_number}</p>
                      {lead.service_interest && (
                        <p className="text-xs text-gray-600 mb-2">{lead.service_interest}</p>
                      )}
                      {lead.assigned_to_name && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <span>👤</span>
                          <span>{lead.assigned_to_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default LeadsManage;



