import React, { useState } from 'react';
import { API_BASE_URL } from '../utils/constants';

const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

export const InstagramPreview = ({ post }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselImages = post.arte_files?.length
    ? post.arte_files
    : post.image_url
      ? [{ url: post.image_url }]
      : [];
  const isCarousel = carouselImages.length > 1;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg overflow-hidden shadow-xl">
      {/* Header */}
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

      {/* Image/Carousel */}
      <div className="relative aspect-square bg-black">
        {carouselImages.length > 0 ? (
          <>
            <img
              src={resolveImageUrl(carouselImages[currentSlide]?.url || carouselImages[currentSlide])}
              alt={`Slide ${currentSlide + 1}`}
              className="w-full h-full object-contain"
            />
            {isCarousel && currentSlide > 0 && (
              <button
                onClick={() => setCurrentSlide(currentSlide - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg"
              >
                ‹
              </button>
            )}
            {isCarousel && currentSlide < carouselImages.length - 1 && (
              <button
                onClick={() => setCurrentSlide(currentSlide + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg"
              >
                ›
              </button>
            )}
            {isCarousel && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1">
                {carouselImages.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full ${idx === currentSlide ? 'bg-blue-500' : 'bg-white/60'}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <span className="text-6xl">📷</span>
          </div>
        )}
      </div>

      {/* Actions */}
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

export const FacebookPreview = ({ post }) => (
  <div className="w-full max-w-md mx-auto bg-white rounded-lg overflow-hidden shadow-xl">
    {/* Header */}
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
      </div>
      <p className="mt-3 text-gray-900 text-sm whitespace-pre-wrap">{post.copy_out || 'Sin texto'}</p>
    </div>

    {/* Image */}
    <div className="relative bg-black">
      {post.image_url ? (
        <img src={resolveImageUrl(post.image_url)} alt="Post" className="w-full object-cover" style={{ maxHeight: '500px' }} />
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <span className="text-6xl">📘</span>
        </div>
      )}
    </div>

    {/* Reactions */}
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

    {/* Actions */}
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

export const TikTokPreview = ({ post }) => (
  <div className="w-full max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl relative" style={{ aspectRatio: '9/16', maxHeight: '600px' }}>
    <div className="absolute inset-0">
      {post.image_url ? (
        <img src={resolveImageUrl(post.image_url)} alt="Post" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-6xl">🎵</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
    </div>

    {/* Right Side Icons */}
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

    {/* Bottom Info */}
    <div className="absolute bottom-3 left-3 right-16">
      <p className="text-white font-semibold text-sm mb-1">@{post.customer?.toLowerCase().replace(/\s+/g, '')}</p>
      <p className="text-white text-sm mb-2 line-clamp-2">{post.copy_out || 'Sin descripcion'}</p>
      <div className="flex items-center text-white text-xs">
        <span className="mr-2">♫</span>
        <span className="truncate">Original sound - {post.customer}</span>
      </div>
    </div>
  </div>
);

/**
 * PlatformPreview — picks the correct preview component based on platform.
 * Props: { post } where post has: customer, copy_out, image_url, arte_files, scheduled_date, platform
 */
export const PlatformPreview = ({ post }) => {
  if (!post) return null;

  switch (post.platform) {
    case 'instagram':
      return <InstagramPreview post={post} />;
    case 'facebook':
      return <FacebookPreview post={post} />;
    case 'tiktok':
      return <TikTokPreview post={post} />;
    default:
      return (
        <div className="w-full max-w-md mx-auto bg-white rounded-lg overflow-hidden shadow-xl p-8 text-center">
          <span className="text-4xl block mb-3">📱</span>
          <p className="text-gray-600">Vista previa no disponible para {post.platform}</p>
          {post.image_url && (
            <img src={resolveImageUrl(post.image_url)} alt="Post" className="mt-4 rounded-lg max-h-64 mx-auto" />
          )}
          {post.copy_out && (
            <p className="mt-4 text-sm text-gray-700">{post.copy_out}</p>
          )}
        </div>
      );
  }
};

export default PlatformPreview;
