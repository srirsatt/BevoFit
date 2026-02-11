import React, { createContext, useContext, useState, ReactNode } from 'react';

type DemoModeContextType = {
    isDemoMode: boolean;
    setIsDemoMode: (value: boolean) => void;
};

const DemoModeContext = createContext<DemoModeContextType>({
    isDemoMode: false,
    setIsDemoMode: () => { },
});

export const DemoModeProvider = ({ children }: { children: ReactNode }) => {
    const [isDemoMode, setIsDemoMode] = useState(false);

    return (
        <DemoModeContext.Provider value={{ isDemoMode, setIsDemoMode }}>
            {children}
        </DemoModeContext.Provider>
    );
};

export const useDemoMode = () => useContext(DemoModeContext);