import { useState } from 'react';
import { ThemeProvider } from 'styled-components';

import GlobalStyle from './styles/global';
import theme from './styles/theme';

import MainLayout from './components/layout/MainLayout';

import { modules, ModuleKey } from './config/moduleConfig';

import ProjectsPage from './pages/projects/ProjectsPage';

function App() {
    const [activeModule, setActiveModule] =
        useState<ModuleKey>('projectManager');

    return (
        <ThemeProvider theme={theme}>
            <GlobalStyle />

            <MainLayout
                modules={modules}
                activeModule={activeModule}
                onModuleChange={setActiveModule}
            >
                <ProjectsPage />
            </MainLayout>
        </ThemeProvider>
    );
}

export default App;