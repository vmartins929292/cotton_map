import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VALOR AG — Mapa de Compradores de Algodão",
  description:
    "Dashboard de prospecção comercial: fiações, integradas, denim e malharias compradoras de algodão em pluma no Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap"
          rel="stylesheet"
        />
        {/*
          Remove atributos injetados pelo inspetor do Cursor IDE Browser
          (data-cursor-ref) antes da hidratação do React, evitando o aviso
          "A tree hydrated but some attributes ... didn't match".
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=document.currentScript;var run=function(){document.querySelectorAll('[data-cursor-ref]').forEach(function(el){el.removeAttribute('data-cursor-ref')});};if(document.readyState!=='loading'){run()}else{document.addEventListener('DOMContentLoaded',run,{once:true})}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
