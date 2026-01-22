import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { useSearchParams, useNavigate } from 'react-router-dom';

const SocialAccountsManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [postContent, setPostContent] = useState({ message: '', mediaUrl: '' });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Handle OAuth callback
    const code = searchParams.get('code');
    if (code) {
      handleOAuthCallback(code);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [accountsRes, configRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/social/accounts`, { headers }),
        axios.get(`${API_BASE_URL}/api/social/config`, { headers })
      ]);

      setAccounts(accountsRes.data);
      setConfig(configRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code) => {
    try {
      setConnecting(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.post(
        `${API_BASE_URL}/api/social/callback`,
        { code },
        { headers }
      );

      alert(`✅ ${response.data.message}`);
      
      // Clear URL params
      navigate('/social/accounts', { replace: true });
      fetchData();
    } catch (error) {
      console.error('OAuth callback error:', error);
      alert('Error al conectar la cuenta: ' + (error.response?.data?.error || error.message));
    } finally {
      setConnecting(false);
    }
  };

  const connectMetaAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_BASE_URL}/api/social/auth-url`, { headers });
      
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      } else {
        alert('No se pudo generar el enlace de autorización');
      }
    } catch (error) {
      console.error('Error getting auth URL:', error);
      alert('Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const disconnectAccount = async (accountId) => {
    if (!confirm('¿Desconectar esta cuenta?')) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_BASE_URL}/api/social/accounts/${accountId}`, { headers });
      
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      alert('Cuenta desconectada');
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Error al desconectar');
    }
  };

  const fetchAccountPosts = async (account) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(
        `${API_BASE_URL}/api/social/accounts/${account.id}/posts`,
        { headers }
      );

      return response.data.posts || response.data.media || [];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  };

  const openPostModal = (account) => {
    setSelectedAccount(account);
    setPostContent({ message: '', mediaUrl: '' });
    setShowPostModal(true);
  };

  const submitPost = async () => {
    if (!postContent.message.trim()) {
      alert('Escribe un mensaje');
      return;
    }

    if (selectedAccount.platform === 'instagram' && !postContent.mediaUrl.trim()) {
      alert('Instagram requiere una imagen. Ingresa una URL de imagen.');
      return;
    }

    try {
      setPosting(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(
        `${API_BASE_URL}/api/social/post`,
        {
          account_id: selectedAccount.id,
          message: postContent.message,
          media_urls: postContent.mediaUrl ? [postContent.mediaUrl] : null
        },
        { headers }
      );

      alert('✅ Publicado exitosamente!');
      setShowPostModal(false);
    } catch (error) {
      console.error('Error posting:', error);
      alert('Error al publicar: ' + (error.response?.data?.error || error.message));
    } finally {
      setPosting(false);
    }
  };

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: '📘',
      instagram: '📷',
      tiktok: '🎵',
      linkedin: '💼'
    };
    return icons[platform] || '🌐';
  };

  const getPlatformColor = (platform) => {
    const colors = {
      facebook: 'from-blue-500 to-blue-700',
      instagram: 'from-purple-500 to-pink-500',
      tiktok: 'from-gray-800 to-black',
      linkedin: 'from-blue-600 to-blue-800'
    };
    return colors[platform] || 'from-gray-500 to-gray-700';
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

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  📱 Cuentas de Redes Sociales
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  Conecta tus cuentas de Meta (Facebook e Instagram) para publicar y ver analíticas
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/social-hub')}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                >
                  📅 Hub de Publicaciones
                </button>
                {config?.configured && (
                  <button
                    onClick={connectMetaAccount}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg hover:opacity-90 flex items-center gap-2"
                  >
                    ➕ Conectar Meta
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Configuration Status */}
          {!config?.configured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-4">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-yellow-800 text-lg">Configuración Requerida</h3>
                  <p className="text-yellow-700 mt-1">
                    Para conectar cuentas de Meta, necesitas configurar las credenciales de tu app de Facebook.
                  </p>
                  <div className="mt-4 bg-white rounded-lg p-4 border border-yellow-200">
                    <h4 className="font-medium text-gray-900 mb-2">Pasos para configurar:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                      <li>Ve a <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developers.facebook.com</a></li>
                      <li>Crea una app de tipo "Business"</li>
                      <li>Agrega los productos: Facebook Login, Instagram Basic Display, Pages API</li>
                      <li>Copia el <strong>App ID</strong> y <strong>App Secret</strong></li>
                      <li>Agrega estas variables a tu archivo <code className="bg-gray-100 px-1 rounded">.env</code> del backend:</li>
                    </ol>
                    <pre className="mt-3 bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`META_APP_ID=tu_app_id
META_APP_SECRET=tu_app_secret
META_REDIRECT_URI=http://localhost:5174/social/accounts`}
                    </pre>
                    <p className="text-xs text-gray-500 mt-2">
                      Después de agregar las variables, reinicia el servidor backend.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connecting State */}
          {connecting && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div>
                  <h3 className="font-semibold text-blue-800">Conectando cuentas...</h3>
                  <p className="text-blue-600 text-sm">Por favor espera mientras procesamos la autorización.</p>
                </div>
              </div>
            </div>
          )}

          {/* Connected Accounts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <div key={account.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className={`bg-gradient-to-r ${getPlatformColor(account.platform)} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getPlatformIcon(account.platform)}</span>
                      <div>
                        <h3 className="font-semibold capitalize">{account.platform}</h3>
                        <p className="text-sm opacity-90">{account.account_name}</p>
                      </div>
                    </div>
                    {account.account_picture_url && (
                      <img 
                        src={account.account_picture_url} 
                        alt="" 
                        className="w-10 h-10 rounded-full border-2 border-white"
                      />
                    )}
                  </div>
                </div>
                
                <div className="p-4">
                  {account.account_username && (
                    <p className="text-gray-600 text-sm mb-3">@{account.account_username}</p>
                  )}
                  
                  {account.followers_count > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl font-bold text-gray-900">
                        {account.followers_count.toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-sm">seguidores</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                    <span>Conectado {new Date(account.created_at).toLocaleDateString()}</span>
                    {account.last_synced_at && (
                      <span>Sync: {new Date(account.last_synced_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => openPostModal(account)}
                      className="flex-1 bg-black text-white py-2 rounded-lg hover:bg-gray-800 text-sm"
                    >
                      ✏️ Publicar
                    </button>
                    <button
                      onClick={() => navigate(`/social/insights/${account.id}`)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      📊 Insights
                    </button>
                    <button
                      onClick={() => disconnectAccount(account.id)}
                      className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
                      title="Desconectar"
                    >
                      🔌
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Account Card */}
            {config?.configured && (
              <div 
                onClick={connectMetaAccount}
                className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors min-h-[200px]"
              >
                <span className="text-4xl mb-3">➕</span>
                <p className="font-medium text-gray-700">Conectar cuenta de Meta</p>
                <p className="text-sm text-gray-500 mt-1">Facebook o Instagram</p>
              </div>
            )}
          </div>

          {/* Empty State */}
          {accounts.length === 0 && config?.configured && !connecting && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <span className="text-6xl block mb-4">📱</span>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                No hay cuentas conectadas
              </h2>
              <p className="text-gray-500 mb-6">
                Conecta tu primera cuenta de Meta para comenzar a publicar
              </p>
              <button
                onClick={connectMetaAccount}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg hover:opacity-90"
              >
                Conectar Meta (Facebook/Instagram)
              </button>
            </div>
          )}

          {/* Quick Stats */}
          {accounts.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm text-gray-500">Cuentas Conectadas</p>
                <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm text-gray-500">Facebook Pages</p>
                <p className="text-2xl font-bold text-blue-600">
                  {accounts.filter(a => a.platform === 'facebook').length}
                </p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm text-gray-500">Instagram Business</p>
                <p className="text-2xl font-bold text-purple-600">
                  {accounts.filter(a => a.platform === 'instagram').length}
                </p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm text-gray-500">Total Seguidores</p>
                <p className="text-2xl font-bold text-green-600">
                  {accounts.reduce((sum, a) => sum + (a.followers_count || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Post Modal */}
        {showPostModal && selectedAccount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {getPlatformIcon(selectedAccount.platform)} Publicar en {selectedAccount.account_name}
                </h2>
                <button onClick={() => setShowPostModal(false)} className="text-gray-500 text-2xl">×</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mensaje / Caption
                  </label>
                  <textarea
                    value={postContent.message}
                    onChange={(e) => setPostContent({ ...postContent, message: e.target.value })}
                    rows={4}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Escribe tu mensaje aquí..."
                  />
                  <p className="text-xs text-gray-400 mt-1">{postContent.message.length} caracteres</p>
                </div>

                {selectedAccount.platform === 'instagram' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL de Imagen <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={postContent.mediaUrl}
                      onChange={(e) => setPostContent({ ...postContent, mediaUrl: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                    <p className="text-xs text-gray-400 mt-1">Instagram requiere una imagen pública</p>
                  </div>
                )}

                {selectedAccount.platform === 'facebook' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL de Imagen (opcional)
                    </label>
                    <input
                      type="url"
                      value={postContent.mediaUrl}
                      onChange={(e) => setPostContent({ ...postContent, mediaUrl: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                )}

                {postContent.mediaUrl && (
                  <div className="bg-gray-100 rounded-lg p-2">
                    <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                    <img 
                      src={postContent.mediaUrl} 
                      alt="Preview" 
                      className="max-h-40 rounded"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPostModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                  disabled={posting}
                >
                  Cancelar
                </button>
                <button
                  onClick={submitPost}
                  disabled={posting || !postContent.message.trim()}
                  className={`flex-1 py-3 rounded-lg text-white ${
                    posting ? 'bg-gray-400' : `bg-gradient-to-r ${getPlatformColor(selectedAccount.platform)} hover:opacity-90`
                  }`}
                >
                  {posting ? '⏳ Publicando...' : '📤 Publicar Ahora'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SocialAccountsManager;

