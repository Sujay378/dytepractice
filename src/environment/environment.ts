const environment = {
  production: false,
  protocol: 'http',
  host: 'localhost:3000',
  api: {
    register: 'api/v1/auth/register',
    login: 'api/v1/auth/login',
    fetch: 'api/v1/logs/fetch/[page]/[count]',
  },
};
