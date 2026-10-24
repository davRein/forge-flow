import styled from 'styled-components';
import Header from './Header';
import Sidebar from './Sidenav';
import Topbar from './Topbar.tsx';

import { AppModule, ModuleKey } from '../../config/moduleConfig';

const Wrapper = styled.div`
    width: 100%;
    height: 100%;
`;

const Body = styled.div`
    display: flex;
    height: calc(100% - ${({ theme }) => theme.layout.headerHeight});
`;

const ContentArea = styled.div`
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.content};
`;

const Main = styled.main`
    flex: 1;
    min-height: 0;
    overflow: auto;
    scrollbar-gutter: stable;
`;

type Props = {
    modules: AppModule[];
    activeModule: ModuleKey;
    onModuleChange: (moduleKey: ModuleKey) => void;
    children: React.ReactNode;
    unsavedSettings?: boolean;
};

export default function MainLayout({
                                       modules,
                                       activeModule,
                                       onModuleChange,
                                       children,
                                       unsavedSettings = false
                                   }: Props) {

    const currentModule = modules.find(
        (module) => module.key === activeModule
    );

    return (
        <Wrapper>
            <Header unsavedSettings={unsavedSettings} />

            <Body>
                <Sidebar
                    modules={modules}
                    activeModule={activeModule}
                    onModuleChange={onModuleChange}
                />

                <ContentArea>
                    <Topbar items={currentModule?.topbarItems ?? []} moduleKey={activeModule} />

                    <Main>
                        {children}
                    </Main>
                </ContentArea>
            </Body>
        </Wrapper>
    );
}
