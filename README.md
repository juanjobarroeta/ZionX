# ZIONX Marketing Platform

A comprehensive marketing management platform designed for modern businesses. This software provides complete marketing automation, campaign management, lead tracking, and analytics capabilities.

## 🏗️ Architecture

### Frontend Stack
- **React 19** with Vite build system
- **Tailwind CSS** for styling with neutral, professional design palette
- **React Router** for navigation
- **Axios** for API communication
- **Chart.js** for data visualization
- **JWT Authentication** system

### Backend Stack
- **Node.js** with Express
- **PostgreSQL** database
- **JWT Authentication**
- **File Upload** with Multer
- **PDF Generation** capabilities
- **Double-entry Accounting** foundation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will run on http://localhost:5174

### Backend Setup
```bash
cd backend
npm install

# Update .env with your database credentials
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=foundation_template
# DB_USER=postgres
# DB_PASSWORD=your_password

npm start
```
Backend will run on http://localhost:5001

### Database Setup
The `schema.sql` file contains the complete database structure. Run it against your PostgreSQL database to set up the tables.

## 📁 Project Structure

```
foundation-template/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   └── Router.jsx       # Application routing
├── backend/                 # Node.js backend
│   ├── index.js            # Main server file
│   └── schema.sql          # Database schema
└── README.md
```

## 🎨 Design System

The template includes a concrete-inspired design palette perfect for professional business applications:
- Modern dark theme with lime green accents
- Professional typography (Manrope, Montserrat)
- Responsive design patterns
- Clean, industrial aesthetic

## 🔧 Key Features Included

- **Authentication System**: Complete login/logout with JWT
- **User Management**: Role-based permissions
- **Dashboard Framework**: Ready-to-customize dashboard
- **Database Architecture**: Professional accounting-ready schema
- **File Upload System**: Ready for document management
- **PDF Generation**: Built-in document creation
- **Responsive Layout**: Mobile-first design approach

## 🛠️ Customization

This template provides a solid foundation that can be adapted for various business applications:
- Financial management systems
- Inventory management
- Customer relationship management
- Project management tools
- E-commerce platforms

## 📊 Next Steps

1. **Database**: Set up PostgreSQL and run the schema
2. **Authentication**: Configure JWT secrets
3. **Customization**: Adapt the UI and business logic for your needs
4. **Deployment**: Use the included Netlify/Railway configurations

---

Built from the production-tested CrediYa architecture - a comprehensive financial management system.
