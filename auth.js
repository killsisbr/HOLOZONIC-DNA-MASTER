(function() {
  const API_BASE = '';
  const TOKEN_KEY = 'holozonic_token';
  const USER_KEY = 'holozonic_user';

  window.HOLOZONIC_AUTH = {
    API_BASE,
    TOKEN_KEY,
    USER_KEY,

    getToken() {
      return localStorage.getItem(this.TOKEN_KEY);
    },

    getUser() {
      const user = localStorage.getItem(this.USER_KEY);
      return user ? JSON.parse(user) : null;
    },

    isLoggedIn() {
      return !!this.getToken();
    },

    async login(user, pass) {
      try {
        const res = await fetch(`${this.API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, pass })
        });
        const data = await res.json();
        
        if (data.success && data.token) {
          localStorage.setItem(this.TOKEN_KEY, data.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
          return { success: true, user: data.user };
        }
        return { success: false, message: data.message || 'Credenciais inválidas' };
      } catch (err) {
        return { success: false, message: 'Erro de conexão' };
      }
    },

    logout() {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      window.location.href = '/';
    },

    getAuthHeader() {
      const token = this.getToken();
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    async apiCall(endpoint, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
        ...(options.headers || {})
      };

      const response = await fetch(`${this.API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.logout();
        throw new Error('Sessão expirada');
      }

      return response;
    },

    async authenticatedFetch(endpoint, options = {}) {
      const res = await this.apiCall(endpoint, options);
      return res.json();
    },

    requireAuth() {
      if (!this.isLoggedIn()) {
        this.showLoginModal();
        return false;
      }
      return true;
    },

    showLoginModal() {
      if (document.getElementById('loginModal')) return;
      
      const modal = document.createElement('div');
      modal.id = 'loginModal';
      modal.innerHTML = `
        <style>
          #loginModal {
            position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
          }
          #loginModal .login-box {
            background: #0f172a; border: 1px solid #00d9a5; border-radius: 16px;
            padding: 32px; width: 100%; max-width: 400px; color: white;
          }
          #loginModal h2 { margin: 0 0 24px; color: #00d9a5; font-size: 24px; text-align: center; }
          #loginModal input {
            width: 100%; padding: 12px 16px; margin-bottom: 16px;
            background: #1e293b; border: 1px solid #334155; border-radius: 8px;
            color: white; font-size: 16px;
          }
          #loginModal input:focus { outline: none; border-color: #00d9a5; }
          #loginModal button {
            width: 100%; padding: 14px; background: #00d9a5; color: #0f172a;
            border: none; border-radius: 8px; font-size: 16px; font-weight: 600;
            cursor: pointer; transition: background 0.2s;
          }
          #loginModal button:hover { background: #00f5b8; }
          #loginModal .error { color: #ef4444; margin-bottom: 16px; text-align: center; }
        </style>
        <div class="login-box">
          <h2><i class="fas fa-user-md"></i> HOLOZONIC</h2>
          <div id="loginError" class="error"></div>
          <input type="text" id="loginUser" placeholder="Usuário" autocomplete="username">
          <input type="password" id="loginPass" placeholder="Senha" autocomplete="current-password">
          <button onclick="HOLOZONIC_AUTH.handleLogin()">Entrar</button>
        </div>
      `;
      document.body.appendChild(modal);
      
      document.getElementById('loginPass').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    },

    async handleLogin() {
      const user = document.getElementById('loginUser').value;
      const pass = document.getElementById('loginPass').value;
      const errorDiv = document.getElementById('loginError');
      
      const result = await this.login(user, pass);
      
      if (result.success) {
        document.getElementById('loginModal').remove();
        if (typeof window.onAuthSuccess === 'function') {
          window.onAuthSuccess(result.user);
        }
        window.location.reload();
      } else {
        errorDiv.textContent = result.message;
      }
    }
  };

  window.authFetch = function(endpoint, options = {}) {
    return window.HOLOZONIC_AUTH.authenticatedFetch(endpoint, options);
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.needsAuth !== 'undefined' && window.needsAuth) {
      if (!window.HOLOZONIC_AUTH.isLoggedIn()) {
        window.HOLOZONIC_AUTH.showLoginModal();
      }
    }
  });
})();