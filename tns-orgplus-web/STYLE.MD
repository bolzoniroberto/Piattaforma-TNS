Markdown
# 🏛️ Design System & Style Guide: Gruppo Il Sole 24 Ore

Questo documento istruisce Claude (o altri modelli AI) sulla creazione di interfacce web e applicazioni ispirate all'identità visiva del Gruppo Il Sole 24 Ore. Carica questo file per forzare l'AI a generare codice CSS e layout editoriali-finanziari.

---

## 1. Identità e Tono Visivo
L'interfaccia deve comunicare **autorevolezza, rigore, trasparenza e precisione**.
- **Estetica:** Editoriale, pulita, basata su griglie.
- **Forme:** Angoli retti (border-radius minimo o nullo).
- **Elementi chiave:** Linee di separazione sottili, ampio spazio bianco, focus sulla leggibilità del dato.

---

## 2. Design Tokens (CSS Variables)

Utilizza queste variabili in ogni progetto web generato:

```css
:root {
  /* Brand Colors */
  --sole-yellow: #E3A11F;       /* Il leggendario Giallo Sole */
  --sole-black: #1A1A1A;        /* Testo principale e titoli */
  --sole-grey-dark: #4D4D4D;    /* Testo secondario / captions */
  --sole-grey-medium: #CCCCCC;  /* Bordi e divisori */
  --sole-grey-light: #F9F9F9;   /* Sfondi sezioni e input */
  --sole-white: #FFFFFF;
  
  /* Typography */
  --font-serif: 'Georgia', 'Times New Roman', serif; /* Per Titoli e Quote */
  --font-sans: 'Helvetica Neue', Arial, sans-serif;  /* Per UI, Nav e Body */
  
  /* Layout */
  --border-thin: 1px solid var(--sole-grey-medium);
  --border-thick: 3px solid var(--sole-black);
  --section-padding: 2rem;
  --max-width: 1200px;
}
3. Specifiche dei Componenti
A. Tipografia
Titoli (H1, H2, H3): Font Serif, colore var(--sole-black), font-weight: bold.

Corpo del testo: Font Sans-serif, line-height: 1.6 per massima leggibilità.

Numeri/Dati: Font Sans-serif, possibilmente con spaziatura tabulare (monospaced per le cifre).

B. Bottoni e Input
Primary Button: Sfondo var(--sole-yellow), testo nero, border-radius 0px, padding generoso.

Secondary Button: Outline var(--sole-black), background trasparente, border-radius 0px.

Form Fields: Sfondo var(--sole-grey-light), bordo solo inferiore o molto sottile su 4 lati.

C. Tabelle e Dati
Header della tabella: Sfondo var(--sole-black), testo var(--sole-white), font-size piccolo, tutto maiuscolo.

Righe: Alternate (zebra-striping) con var(--sole-grey-light) o separate da var(--border-thin).

D. Layout e Header
Top Bar: Una linea sottile di 4px di colore var(--sole-yellow) in cima a tutta la pagina.

Header: Logo centrato o a sinistra, menu di navigazione in Sans-serif, font-weight 600.

4. Configurazione Tailwind (Opzionale)
Se richiesto l'uso di Tailwind CSS, integra questa configurazione:

JavaScript
module.exports = {
  theme: {
    extend: {
      colors: {
        sole: {
          yellow: '#E3A11F',
          black: '#1A1A1A',
          grey: {
            light: '#F9F9F9',
            dark: '#4D4D4D'
          }
        }
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'none': '0',
        'sm': '2px',
      }
    }
  }
}