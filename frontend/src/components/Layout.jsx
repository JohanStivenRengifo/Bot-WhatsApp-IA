import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';

function Layout() {
  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <NavLink to="/" className="flex items-center">
                  <i className="fab fa-whatsapp text-green-500 text-2xl mr-2"></i>
                  <span className="font-bold text-white">Conecta2 Bot</span>
                </NavLink>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <NavLink 
                    to="/" 
                    className={({isActive}) => 
                      `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
                    }
                    end
                  >
                    <i className="fas fa-home mr-1"></i> Inicio
                  </NavLink>
                  <NavLink 
                    to="/analytics" 
                    className={({isActive}) => 
                      `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
                    }
                  >
                    <i className="fas fa-chart-line mr-1"></i> Analítica
                  </NavLink>
                  <NavLink 
                    to="/tickets" 
                    className={({isActive}) => 
                      `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
                    }
                  >
                    <i className="fas fa-ticket-alt mr-1"></i> Tickets
                  </NavLink>
                  <NavLink 
                    to="/appointments" 
                    className={({isActive}) => 
                      `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
                    }
                  >
                    <i className="fas fa-calendar-alt mr-1"></i> Citas
                  </NavLink>
                  <NavLink 
                    to="/settings" 
                    className={({isActive}) => 
                      `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
                    }
                  >
                    <i className="fas fa-cog mr-1"></i> Configuración
                  </NavLink>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <button className="bg-gray-800 p-1 rounded-full text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                  <span className="sr-only">Ver notificaciones</span>
                  <i className="fas fa-bell"></i>
                </button>
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              <button type="button" className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                <span className="sr-only">Abrir menú principal</span>
                <i className="fas fa-bars"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;