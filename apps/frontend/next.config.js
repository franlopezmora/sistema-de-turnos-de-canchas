/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/admin/agenda-playground2', destination: '/admin/agenda', permanent: false },
      { source: '/admin/clientes-playground2', destination: '/admin/clientes', permanent: false },
      { source: '/admin/clientes-playground', destination: '/admin/clientes', permanent: false },
      { source: '/admin/pagos-playground', destination: '/admin/caja', permanent: false },
      { source: '/admin/cash', destination: '/admin/caja?tab=cash', permanent: false },
      { source: '/admin/cash-playground', destination: '/admin/caja?tab=cash', permanent: false },
      { source: '/admin/cash-playground2', destination: '/admin/caja?tab=cash', permanent: false },
      { source: '/admin/cuentas', destination: '/admin/caja?tab=accounts', permanent: false },
      { source: '/admin/devoluciones', destination: '/admin/caja?tab=refunds', permanent: false },
      { source: '/admin/products', destination: '/admin/tienda?tab=productos', permanent: false },
      { source: '/admin/services', destination: '/admin/tienda?tab=servicios', permanent: false },
      { source: '/admin/statistics', destination: '/admin/informes?tab=resumen', permanent: false },
      { source: '/admin/metrics', destination: '/admin/informes?tab=resumen', permanent: false },
      { source: '/admin/settings', destination: '/admin/ajustes?tab=club', permanent: false },
      { source: '/admin/canchas', destination: '/admin/ajustes?tab=canchas', permanent: false },
    ];
  },
  webpack: (config, { isServer }) => {
    // Suprimir el warning de react-datepicker sobre dependencias críticas
    config.module = {
      ...config.module,
      exprContextCritical: false,
      unknownContextCritical: false,
    };
    return config;
  },
};

module.exports = nextConfig;
