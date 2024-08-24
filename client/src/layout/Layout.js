import React from 'react';
import Header from '../components/header/Header';
import Footer from '../components/footer/Footer';
import Routers from '../routes/Routers';


const Layout = () => {
  return (
    <div>
      <>
      <Header />
      <main>

        <Routers />

      </main>
      <Footer />
      </>
    </div>
  );
};

export default Layout;