import Head from 'next/head';
import AdminDevDashboard from '../../components/admin/AdminDevDashboard';

const MetricsPage = () => {
  return (
    <>
      <Head>
        <title>Metricas | TuCancha Admin</title>
      </Head>
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Panel de Monitoreo</h1>
          <p className="text-gray-400 text-sm">Estado del servidor en tiempo real</p>
        </div>
        <AdminDevDashboard />
      </div>
    </>
  );
};

export const getServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
};

export default MetricsPage;
