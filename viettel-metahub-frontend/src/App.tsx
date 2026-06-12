import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { viettelTheme } from './theme/viettelTheme';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ClassificationPage from './pages/ClassificationPage';
import SettingsPage from './pages/SettingsPage';
import MetadataInputPage from './pages/MetadataInputPage';
import LoginPage from './pages/LoginPage';

export default function App() {
    return (
        <ConfigProvider theme={viettelTheme} locale={viVN}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<HomePage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/classification" element={<ClassificationPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/metadata-input" element={<MetadataInputPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </ConfigProvider>
    );
}
