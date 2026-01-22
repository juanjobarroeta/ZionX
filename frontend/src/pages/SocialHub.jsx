import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const SocialHub = () => {
  const [posts, setPosts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, scheduled, published, failed
  const [platformFilter, setPlatformFilter] = useState('all'); // all, instagram, facebook, tiktok
  const [customerFilter, setCustomerFilter] = useState('all'); // all, or customer id
  const [monthFilter, setMonthFilter] = useState('all'); // all, or YYYY-MM format
  const [selectedPost, setSelectedPost] = useState(null); // For preview modal

  useEffect(() => {
    fetchPublications();
  }, []);

  const fetchPublications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch customers
      const customersRes = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCustomers(customersRes.data || []);

      // Fetch completed posts with arte from all customers
      const allPosts = [];
      
      for (const customer of customersRes.data || []) {
        try {
          // Get current month and previous/next months
          const currentDate = new Date();
          const months = [];
          for (let i = -1; i <= 1; i++) {
            const date = new Date(currentDate);
            date.setMonth(date.getMonth() + i);
            months.push(date.toISOString().slice(0, 7));
          }

          // Fetch posts for each month
          for (const month of months) {
            try {
              const response = await axios.get(
                `${API_BASE_URL}/customers/${customer.id}/content-calendar/${month}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );

              // Filter posts that have arte (completed)
              const completedPosts = (response.data || [])
                .filter(post => post.arte || (post.arte_files && post.arte_files.length > 0))
                .map(post => ({
                  id: post.id,
                  customer_id: customer.id,
                  customer: customer.business_name || customer.commercial_name || `Cliente ${customer.id}`,
                  campaign: post.campaign || 'Sin campaña',
                  platform: post.platform || 'instagram',
                  status: post.status || 'draft',
                  scheduled_date: post.scheduled_date,
                  published_date: post.published_date,
                  month: month,
                  image_url: post.arte ? `http://localhost:5001${post.arte}` : null,
                  arte_files: post.arte_files || [],
                  post_number: post.post_number,
                  copy_in: post.copy_in,
                  copy_out: post.copy_out
                }));

              allPosts.push(...completedPosts);
            } catch (err) {
              // Skip if month doesn't exist
              console.log(`No calendar for ${customer.id} in ${month}`);
            }
          }
        } catch (err) {
          console.error(`Error fetching posts for customer ${customer.id}:`, err);
        }
      }

      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching publications:', error);
    } finally {
      setLoading(false);
    }
  };

  const platformConfig = {
    instagram: { color: 'from-purple-500 to-pink-500', icon: '📷', name: 'Instagram' },
    facebook: { color: 'from-blue-500 to-blue-700', icon: '📘', name: 'Facebook' },
    tiktok: { color: 'from-black to-gray-800', icon: '🎵', name: 'TikTok' }
  };

  const statusConfig = {
    scheduled: { color: 'bg-blue-500', label: 'Programado', icon: '⏰' },
    published: { color: 'bg-green-500', label: 'Publicado', icon: '✅' },
    failed: { color: 'bg-red-500', label: 'Error', icon: '❌' },
    draft: { color: 'bg-gray-500', label: 'Borrador', icon: '📝' }
  };

  const filteredPosts = posts.filter(post => {
    if (activeFilter !== 'all' && post.status !== activeFilter) return false;
    if (platformFilter !== 'all' && post.platform !== platformFilter) return false;
    if (customerFilter !== 'all' && post.customer_id != customerFilter) return false;
    if (monthFilter !== 'all' && post.month !== monthFilter) return false;
    return true;
  });

  const stats = {
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    failed: posts.filter(p => p.status === 'failed').length,
    total: posts.length
  };

  // Platform-specific preview components
  const InstagramPreview = ({ post }) => {
    const [currentSlide, setCurrentSlide] = React.useState(0);
    const carouselImages = post.arte_files || (post.image_url ? [{ url: post.image_url }] : []);
    const isCarousel = carouselImages.length > 1;
    
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg overflow-hidden shadow-xl">
        {/* Instagram Header */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <span className="text-xs font-bold text-gray-700">{post.customer?.charAt(0)}</span>
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-semibold text-gray-900">{post.customer}</p>
          </div>
          <button className="text-gray-900">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>

        {/* Instagram Image/Carousel */}
        <div className="relative aspect-square bg-black">
          {isCarousel ? (
            <>
              <img 
                src={carouselImages[currentSlide].url?.startsWith('http') ? carouselImages[currentSlide].url : `http://localhost:5001${carouselImages[currentSlide].url}`} 
                alt={`Slide ${currentSlide + 1}`} 
                className="w-full h-full object-contain" 
              />
              {/* Carousel Navigation */}
              {currentSlide > 0 && (
                <button
                  onClick={() => setCurrentSlide(currentSlide - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg"
                >
                  ‹
                </button>
              )}
              {currentSlide < carouselImages.length - 1 && (
                <button
                  onClick={() => setCurrentSlide(currentSlide + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg"
                >
                  ›
                </button>
              )}
              {/* Carousel Dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1">
                {carouselImages.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full ${idx === currentSlide ? 'bg-blue-500' : 'bg-white/60'}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <img src={post.image_url} alt="Post" className="w-full h-full object-contain" />
          )}
        </div>

        {/* Instagram Actions */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
            <button className="hover:text-gray-500">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            <button className="hover:text-gray-500">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            <button className="hover:text-gray-500">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <button className="hover:text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>

        {/* Caption */}
        <div className="text-sm">
          <p className="mb-1">
            <span className="font-semibold mr-2">{post.customer}</span>
            <span className="text-gray-900">{post.copy_out || 'Sin caption'}</span>
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'Fecha no definida'}
          </p>
        </div>
      </div>
    </div>
    );
  };

  const FacebookPreview = ({ post }) => (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg overflow-hidden shadow-xl">
      {/* Facebook Header */}
      <div className="px-4 py-3">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold">{post.customer?.charAt(0)}</span>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-semibold text-gray-900">{post.customer}</p>
            <p className="text-xs text-gray-500">
              {post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'Ahora'} · 🌎
            </p>
          </div>
          <button className="text-gray-500 hover:bg-gray-100 rounded-full p-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>

        {/* Caption above image (Facebook style) */}
        <p className="mt-3 text-gray-900 text-sm whitespace-pre-wrap">{post.copy_out || 'Sin texto'}</p>
      </div>

      {/* Facebook Image */}
      <div className="relative bg-black">
        <img src={post.image_url} alt="Post" className="w-full object-cover" style={{ maxHeight: '500px' }} />
      </div>

      {/* Facebook Reactions Bar */}
      <div className="px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <div className="flex -space-x-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs">👍</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs">❤️</span>
            </div>
            <span>Me gusta</span>
          </div>
          <div className="flex space-x-2">
            <span>0 comentarios</span>
            <span>·</span>
            <span>0 veces compartido</span>
          </div>
        </div>
      </div>

      {/* Facebook Actions */}
      <div className="px-4 py-2 flex items-center justify-around border-t border-gray-200">
        <button className="flex items-center space-x-2 py-2 px-4 hover:bg-gray-100 rounded-lg transition-colors flex-1 justify-center">
          <span className="text-gray-600">👍</span>
          <span className="text-sm font-medium text-gray-600">Me gusta</span>
        </button>
        <button className="flex items-center space-x-2 py-2 px-4 hover:bg-gray-100 rounded-lg transition-colors flex-1 justify-center">
          <span className="text-gray-600">💬</span>
          <span className="text-sm font-medium text-gray-600">Comentar</span>
        </button>
        <button className="flex items-center space-x-2 py-2 px-4 hover:bg-gray-100 rounded-lg transition-colors flex-1 justify-center">
          <span className="text-gray-600">↗️</span>
          <span className="text-sm font-medium text-gray-600">Compartir</span>
        </button>
      </div>
    </div>
  );

  const TikTokPreview = ({ post }) => (
    <div className="w-full max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl relative" style={{ aspectRatio: '9/16', maxHeight: '600px' }}>
      {/* TikTok Video Container */}
      <div className="absolute inset-0">
        <img src={post.image_url} alt="Post" className="w-full h-full object-cover" />
        
        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* TikTok Right Side Icons */}
      <div className="absolute right-3 bottom-20 flex flex-col items-center space-y-5">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-400 p-[2px]">
            <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{post.customer?.charAt(0)}</span>
            </div>
          </div>
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center -mt-3 border-2 border-black">
            <span className="text-white font-bold text-xs">+</span>
          </div>
        </div>

        <button className="flex flex-col items-center">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span className="text-white text-xs mt-1">125K</span>
        </button>

        <button className="flex flex-col items-center">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
          <span className="text-white text-xs mt-1">8.5K</span>
        </button>

        <button className="flex flex-col items-center">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
          </svg>
          <span className="text-white text-xs mt-1">Share</span>
        </button>
      </div>

      {/* TikTok Bottom Info */}
      <div className="absolute bottom-3 left-3 right-16">
        <p className="text-white font-semibold text-sm mb-1">@{post.customer?.toLowerCase().replace(/\s+/g, '')}</p>
        <p className="text-white text-sm mb-2 line-clamp-2">{post.copy_out || 'Sin descripción'}</p>
        <div className="flex items-center text-white text-xs">
          <span className="mr-2">♫</span>
          <span className="truncate">Original sound - {post.customer}</span>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Hub de Publicaciones</h1>
              <p className="text-gray-500 text-sm mt-1">Gestión centralizada de contenido en redes sociales</p>
            </div>
            <button className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg transition-colors font-medium">
              ➕ Programar Post
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-8 py-6 border-b border-gray-200">
          {/* Customer & Month Filters */}
          <div className="flex space-x-3 mb-4">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="all">Todos los Clientes</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.business_name || customer.commercial_name || `Cliente ${customer.id}`}
                </option>
              ))}
            </select>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="all">Todos los Meses</option>
              <option value="2025-10">Octubre 2025</option>
              <option value="2025-11">Noviembre 2025</option>
              <option value="2025-12">Diciembre 2025</option>
              <option value="2026-01">Enero 2026</option>
            </select>
          </div>

          {/* Platform Filters */}
          <div className="flex space-x-3">
            <button
              onClick={() => setPlatformFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                platformFilter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas las Plataformas
            </button>
            <button
              onClick={() => setPlatformFilter('instagram')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2 ${
                platformFilter === 'instagram' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>📷</span>
              <span>Instagram</span>
            </button>
            <button
              onClick={() => setPlatformFilter('facebook')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2 ${
                platformFilter === 'facebook' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>📘</span>
              <span>Facebook</span>
            </button>
            <button
              onClick={() => setPlatformFilter('tiktok')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2 ${
                platformFilter === 'tiktok' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>🎵</span>
              <span>TikTok</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Programadas</p>
                  <p className="text-3xl font-bold text-black">{stats.scheduled}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⏰</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Publicadas</p>
                  <p className="text-3xl font-bold text-black">{stats.published}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Fallidas</p>
                  <p className="text-3xl font-bold text-black">{stats.failed}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">❌</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total</p>
                  <p className="text-3xl font-bold text-black">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📱</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex space-x-3 mb-6">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveFilter('scheduled')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'scheduled' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Programadas
            </button>
            <button
              onClick={() => setActiveFilter('published')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'published' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Publicadas
            </button>
            <button
              onClick={() => setActiveFilter('failed')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'failed' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Fallidas
            </button>
          </div>

          {/* 3-Column Grid (TikTok/Instagram style) */}
          <div className="grid grid-cols-3 gap-1">
            {filteredPosts.map(post => (
              <div 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
                  {post.image_url ? (
                    <img src={post.image_url} alt={post.campaign} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl">📱</span>
                  )}
                  
                  {/* Platform Badge */}
                  <div className="absolute top-2 right-2 bg-white rounded-full p-2 shadow">
                    <span className="text-lg">{platformConfig[post.platform]?.icon}</span>
                  </div>

                  {/* Status Badge */}
                  <div className={`absolute bottom-2 left-2 ${statusConfig[post.status]?.color} text-white px-3 py-1 rounded-lg text-xs font-bold`}>
                    {statusConfig[post.status]?.icon} {statusConfig[post.status]?.label}
                  </div>
                </div>

                {/* Post Info */}
                <div className="p-3">
                  <p className="font-medium text-black text-sm truncate">{post.campaign}</p>
                  <p className="text-xs text-gray-500 truncate">{post.customer}</p>
                  {post.status === 'scheduled' && (
                    <p className="text-xs text-blue-600 mt-1">{post.scheduled_date}</p>
                  )}
                  {post.status === 'failed' && (
                    <p className="text-xs text-red-600 mt-1">{post.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay publicaciones para mostrar</p>
              <p className="text-sm text-gray-400 mt-2">Crea contenido en la escaleta y genera tareas para ver publicaciones aquí</p>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {selectedPost && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPost(null)}
          >
            <div 
              className="relative max-w-6xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedPost(null)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 text-3xl font-bold z-10"
              >
                ✕
              </button>

              {/* Platform Preview */}
              <div className="bg-gray-900 rounded-lg p-8">
                {selectedPost.platform === 'instagram' && <InstagramPreview post={selectedPost} />}
                {selectedPost.platform === 'facebook' && <FacebookPreview post={selectedPost} />}
                {selectedPost.platform === 'tiktok' && <TikTokPreview post={selectedPost} />}
                {!['instagram', 'facebook', 'tiktok'].includes(selectedPost.platform) && (
                  <div className="text-center text-white">
                    <p>Vista previa no disponible para esta plataforma</p>
                  </div>
                )}
              </div>

              {/* Post Actions */}
              <div className="mt-6 flex items-center justify-center space-x-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  📅 Reprogramar
                </button>
                <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  ✅ Publicar Ahora
                </button>
                <button className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  ✏️ Editar
                </button>
                <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SocialHub;

