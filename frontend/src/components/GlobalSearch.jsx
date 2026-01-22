import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const GlobalSearch = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ customers: [], projects: [], team: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length >= 2) {
      searchGlobal();
    } else {
      setResults({ customers: [], projects: [], team: [] });
    }
  }, [query]);

  const searchGlobal = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Search customers
      const customersRes = await axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] }));
      const teamRes = await axios.get(`${API_BASE_URL}/team-members`, { headers }).catch(() => ({ data: { team_members: [] } }));

      const searchLower = query.toLowerCase();

      // Filter customers
      const matchedCustomers = (customersRes.data || []).filter(c =>
        c.business_name?.toLowerCase().includes(searchLower) ||
        c.commercial_name?.toLowerCase().includes(searchLower) ||
        c.contact_email?.toLowerCase().includes(searchLower)
      ).slice(0, 5);

      // Filter team members
      const matchedTeam = (teamRes.data.team_members || []).filter(t =>
        t.name?.toLowerCase().includes(searchLower) ||
        t.email?.toLowerCase().includes(searchLower)
      ).slice(0, 3);

      setResults({
        customers: matchedCustomers,
        team: matchedTeam,
        projects: []
      });
    } catch (error) {
      console.error('Global search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (type, item) => {
    if (type === 'customer') {
      navigate(`/customer/${item.id}`);
    } else if (type === 'team') {
      navigate(`/employee/${item.id}`);
    }
    onClose();
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-32">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-96 overflow-hidden">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200">
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar clientes, equipo, proyectos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            className="w-full text-lg px-4 py-2 border-0 focus:outline-none"
          />
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-80 p-4">
          {loading && (
            <div className="text-center py-8 text-gray-500">Buscando...</div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}

          {!loading && query.length >= 2 && (
            <>
              {/* Customers */}
              {results.customers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Clientes</h3>
                  <div className="space-y-2">
                    {results.customers.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelect('customer', customer)}
                        className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                      >
                        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold">
                          {customer.business_name?.charAt(0) || customer.commercial_name?.charAt(0) || 'C'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-black">{customer.business_name || customer.commercial_name}</p>
                          <p className="text-sm text-gray-500">{customer.contact_email}</p>
                        </div>
                        <span className="text-gray-400">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Members */}
              {results.team.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Equipo</h3>
                  <div className="space-y-2">
                    {results.team.map(member => (
                      <button
                        key={member.id}
                        onClick={() => handleSelect('team', member)}
                        className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                      >
                        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold">
                          {member.name?.charAt(0) || 'T'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-black">{member.name}</p>
                          <p className="text-sm text-gray-500">{member.role}</p>
                        </div>
                        <span className="text-gray-400">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {results.customers.length === 0 && results.team.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron resultados para "{query}"
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">Esc</kbd> para cerrar
          </p>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;





