import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './SocialAccounts.css';

const platformLabel = (p) => ({ facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn' }[p] || p || '—');
const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

const SocialAccountsManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [search, setSearch] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [postContent, setPostContent] = useState({ message: '', mediaUrl: '' });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchData();
    const code = searchParams.get('code');
    if (code) handleOAuthCallback(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setAccounts(Array.isArray(accountsRes.data) ? accountsRes.data : []);
      setConfig(configRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code) => {
    try {
      const oauthError = searchParams.get('error');
      if (oauthError) {
        const errorDesc = searchParams.get('error_description') || 'Authorization was denied';
        alert(`Error de Meta: ${errorDesc}`);
        navigate('/social/accounts', { replace: true });
        return;
      }
      setConnecting(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const state = searchParams.get('state');
      const response = await axios.post(`${API_BASE_URL}/api/social/callback`, { code, state }, { headers });
      alert(response.data.message || 'Cuentas conectadas');
      navigate('/social/accounts', { replace: true });
      fetchData();
    } catch (error) {
      console.error('OAuth callback error:', error);
      alert('Error al conectar la cuenta: ' + (error.response?.data?.error || error.message));
      navigate('/social/accounts', { replace: true });
    } finally {
      setConnecting(false);
    }
  };

  const connectMetaAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API_BASE_URL}/api/social/auth-url`, { headers });
      if (response.data.authUrl) window.location.href = response.data.authUrl;
      else alert('No se pudo generar el enlace de autorización');
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
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Error al desconectar');
    }
  };

  const openPostModal = (account) => {
    setSelectedAccount(account);
    setPostContent({ message: '', mediaUrl: '' });
    setShowPostModal(true);
  };

  const submitPost = async () => {
    if (!postContent.message.trim()) { alert('Escribe un mensaje'); return; }
    if (selectedAccount.platform === 'instagram' && !postContent.mediaUrl.trim()) {
      alert('Instagram requiere una imagen. Ingresa una URL de imagen.');
      return;
    }
    try {
      setPosting(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_BASE_URL}/api/social/post`, {
        account_id: selectedAccount.id,
        message: postContent.message,
        media_urls: postContent.mediaUrl ? [postContent.mediaUrl] : null
      }, { headers });
      alert('Publicado exitosamente.');
      setShowPostModal(false);
    } catch (error) {
      console.error('Error posting:', error);
      alert('Error al publicar: ' + (error.response?.data?.error || error.message));
    } finally {
      setPosting(false);
    }
  };

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return accounts;
    return accounts.filter((a) =>
      [a.account_name, a.account_username, a.platform].some((v) => (v || '').toString().toLowerCase().includes(t))
    );
  }, [accounts, search]);

  const stats = useMemo(() => ({
    total: accounts.length,
    fb: accounts.filter(a => a.platform === 'facebook').length,
    ig: accounts.filter(a => a.platform === 'instagram').length,
    followers: accounts.reduce((s, a) => s + (a.followers_count || 0), 0),
  }), [accounts]);

  if (loading) {
    return <Layout><div className="zxsa"><div className="zxsa-loading"><div className="zxsa-spinner" /></div></div></Layout>;
  }

  return (
    <Layout>
      <div className="zxsa">
        <div className="zxsa-inner">
          <div className="zxsa-head">
            <div>
              <div className="eyebrow">Contenido · Meta</div>
              <h1>Cuentas de <span className="zxsa-serif">redes sociales</span></h1>
              <div className="sub">Conecta Facebook e Instagram para publicar y ver analíticas.</div>
            </div>
            <div className="zxsa-actions">
              <button className="zxsa-btn" onClick={() => navigate('/social-hub')}>Hub de Publicaciones</button>
              {config?.configured && (
                <button className="zxsa-btn solid" onClick={connectMetaAccount}>+ Conectar Meta</button>
              )}
            </div>
          </div>

          {!config?.configured && (
            <div className="zxsa-note warn">
              <strong>Configuración requerida.</strong> Falta configurar las credenciales de la app de Meta
              (META_APP_ID, META_APP_SECRET, META_REDIRECT_URI) en el backend. Después reinicia el servidor.
            </div>
          )}

          {connecting && (
            <div className="zxsa-note">
              <div className="zxsa-spinner sm" />
              <div><strong>Conectando cuentas…</strong><br /><span className="muted">Procesando la autorización.</span></div>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="zxsa-tiles">
              <div className="zxsa-tile"><span className="k">Cuentas</span><span className="v">{stats.total}</span></div>
              <div className="zxsa-tile"><span className="k">Facebook</span><span className="v">{stats.fb}</span></div>
              <div className="zxsa-tile"><span className="k">Instagram</span><span className="v">{stats.ig}</span></div>
              <div className="zxsa-tile"><span className="k">Seguidores</span><span className="v">{stats.followers.toLocaleString('es-MX')}</span></div>
            </div>
          )}

          {accounts.length > 6 && (
            <input
              className="zxsa-search"
              placeholder={`Buscar entre ${accounts.length} cuentas…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          {accounts.length === 0 && config?.configured && !connecting ? (
            <div className="zxsa-empty">
              <div className="lead">No hay cuentas conectadas</div>
              <p>Conecta tu primera cuenta de Meta para comenzar a publicar.</p>
              <button className="zxsa-btn solid" onClick={connectMetaAccount}>Conectar Meta</button>
            </div>
          ) : (
            <div className="zxsa-grid">
              {filtered.map((account) => (
                <div key={account.id} className="zxsa-card">
                  <div className="zxsa-card-top">
                    {account.account_picture_url
                      ? <img className="zxsa-avatar" src={account.account_picture_url} alt="" />
                      : <span className="zxsa-avatar mono">{initialOf(account.account_name)}</span>}
                    <div className="zxsa-idwrap">
                      <div className="zxsa-name">{account.account_name}</div>
                      <div className="zxsa-meta">
                        <span className={`zxsa-plat ${account.platform}`}>{platformLabel(account.platform)}</span>
                        {account.account_username && <span>@{account.account_username}</span>}
                      </div>
                    </div>
                  </div>

                  {account.token_expired && <div className="zxsa-pill bad">Token expirado — reconecta</div>}
                  {account.token_expiring_soon && !account.token_expired && <div className="zxsa-pill warn">Token expira pronto</div>}

                  {account.followers_count > 0 && (
                    <div className="zxsa-followers"><b>{account.followers_count.toLocaleString('es-MX')}</b> seguidores</div>
                  )}

                  <div className="zxsa-date">Conectado {new Date(account.created_at).toLocaleDateString('es-MX')}</div>

                  <div className="zxsa-card-actions">
                    <button className="zxsa-act primary" onClick={() => openPostModal(account)}>Publicar</button>
                    <button className="zxsa-act link" onClick={() => disconnectAccount(account.id)}>Desconectar</button>
                  </div>
                </div>
              ))}

              {config?.configured && !search && (
                <button className="zxsa-add" onClick={connectMetaAccount}>
                  <span className="plus">+</span>
                  <span className="t">Conectar cuenta de Meta</span>
                  <span className="s">Facebook o Instagram</span>
                </button>
              )}
            </div>
          )}
        </div>

        {showPostModal && selectedAccount && (
          <div className="zxsa-overlay" onClick={() => !posting && setShowPostModal(false)}>
            <div className="zxsa-modal" onClick={(e) => e.stopPropagation()}>
              <div className="zxsa-modal-head">
                <h2>Publicar en <span className="zxsa-serif">{selectedAccount.account_name}</span></h2>
                <button className="zxsa-x" onClick={() => setShowPostModal(false)} aria-label="Cerrar">×</button>
              </div>
              <div className="zxsa-modal-body">
                <label className="zxsa-field">
                  <span>Mensaje / Caption</span>
                  <textarea rows={4} value={postContent.message}
                    onChange={(e) => setPostContent({ ...postContent, message: e.target.value })}
                    placeholder="Escribe tu mensaje aquí…" />
                  <span className="zxsa-hint">{postContent.message.length} caracteres</span>
                </label>
                <label className="zxsa-field">
                  <span>URL de imagen {selectedAccount.platform === 'instagram' ? '(requerida)' : '(opcional)'}</span>
                  <input type="url" value={postContent.mediaUrl}
                    onChange={(e) => setPostContent({ ...postContent, mediaUrl: e.target.value })}
                    placeholder="https://ejemplo.com/imagen.jpg" />
                  {selectedAccount.platform === 'instagram' && <span className="zxsa-hint">Instagram requiere una imagen pública.</span>}
                </label>
                {postContent.mediaUrl && (
                  <div className="zxsa-preview">
                    <img src={postContent.mediaUrl} alt="Vista previa" onError={(e) => (e.target.style.display = 'none')} />
                  </div>
                )}
              </div>
              <div className="zxsa-modal-foot">
                <button className="zxsa-btn" onClick={() => setShowPostModal(false)} disabled={posting}>Cancelar</button>
                <button className="zxsa-btn solid" onClick={submitPost} disabled={posting || !postContent.message.trim()}>
                  {posting ? 'Publicando…' : 'Publicar ahora'}
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
