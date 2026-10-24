import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI Variable Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    color-scheme: ${({ theme }) => theme.mode};
    overflow: hidden;
  }

  #root {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    --motion-fast: 140ms;
    --motion-normal: 200ms;
    --ease-out: cubic-bezier(0.2, 0, 0, 1);
  }

  h1, h2, h3, h4 { font-weight: 650; line-height: 1.3; overflow-wrap: anywhere; }
  h1 { font-size: clamp(24px, 2.2vw, 30px); letter-spacing: -0.7px; }
  h2 { font-size: 20px; letter-spacing: -0.35px; }
  h3 { font-size: 16px; letter-spacing: -0.15px; }
  h4 { font-size: 14px; }
  strong { font-weight: 600; }
  code, pre { font-family: 'Cascadia Code', 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
  ::selection { background: ${({ theme }) => theme.colors.primarySubtle}; color: ${({ theme }) => theme.colors.text}; }
  * { scrollbar-width: thin; scrollbar-color: ${({ theme }) => theme.colors.borderStrong} transparent; }

  button, input, select, textarea {
    font: inherit;
  }

  button, a, input, select, textarea {
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--motion-fast) var(--ease-out),
      border-color var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out),
      box-shadow var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
  }
  input::placeholder, textarea::placeholder { color: ${({ theme }) => theme.colors.textSecondary}; opacity: 0.8; }
  input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='range']), select, textarea { min-width: 0; }
  input:not(:disabled):hover, select:not(:disabled):hover, textarea:not(:disabled):hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  button:focus-visible, a:focus-visible, input:focus-visible,
  select:focus-visible, textarea:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }
`;

export default GlobalStyle;
