const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function setupGoogleAuth(app) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      accessType: 'offline',
      prompt: 'consent'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Encontrar ou criar usuário baseado no Google ID
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id }
        });

        if (!user) {
          // Se não existir, tenta vincular ao usuário 'admin' ou criar um novo
          // Para o JARVIS 4.1, vamos assumir que o primeiro login Google vincula ao Admin se estivermos em dev
          user = await prisma.user.upsert({
            where: { user: profile.emails[0].value },
            update: { 
              googleId: profile.id,
              refreshToken: refreshToken || undefined
            },
            create: {
              user: profile.emails[0].value,
              hash: 'GOOGLE_OAUTH',
              role: 'ADMIN',
              googleId: profile.id,
              refreshToken: refreshToken
            }
          });
        } else if (refreshToken) {
          // Atualiza o refresh token se recebido (geralmente só no primeiro consentimento)
          user = await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Rotas de Auth
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar'] })
  );

  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' }),
    (req, res) => {
      // Sucesso! Redireciona para o painel
      res.redirect('/painel.html');
    }
  );

  app.get('/api/auth/logout', (req, res) => {
    req.logout(() => {
      res.redirect('/');
    });
  });
}

module.exports = setupGoogleAuth;
