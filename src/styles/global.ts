import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: Arial, sans-serif;
    background: #1e1f25;
    color: white;
    overflow: hidden;
  }

  #root {
    width: 100vw;
    height: 100vh;
  }
`;

export default GlobalStyle;