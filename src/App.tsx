import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DBProvider } from "./db/DBContext";
import { ActiveRecordProvider } from "./ui/ActiveRecordContext";
import Layout from "./components/Layout";

import DashboardPage from "./pages/DashboardPage";
import JournalPage from "./pages/JournalPage";
import PropFirmsPage from "./pages/PropFirmsPage";
import CompliancePage from "./pages/CompliancePage";
import ReportingPage from "./pages/ReportingPage";
import ReportingTotalsPage from "./pages/ReportingTotalsPage";
import BackupPage from "./pages/BackupPage";

export default function App() {
  return (
    <DBProvider>
      <ActiveRecordProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/journal" element={<JournalPage />} />
              <Route path="/prop-firms" element={<PropFirmsPage />} />
              <Route path="/compliance" element={<CompliancePage />} />
              <Route path="/reporting" element={<ReportingPage />} />
              <Route path="/reporting-totals" element={<ReportingTotalsPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ActiveRecordProvider>
    </DBProvider>
  );
}
