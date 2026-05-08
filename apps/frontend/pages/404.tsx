import Head from 'next/head';
import NotFound from '../components/NotFound';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>Pagina no encontrada | Punto</title>
      </Head>
      <NotFound title="Pagina no encontrada" message="La ruta que ingresaste no existe." />
    </>
  );
}
