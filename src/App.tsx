import { Routes, Route, Navigate } from "react-router-dom";
import ExplorePage from "./pages/ExplorePage";
import HomePage from "./pages/HomePage";
import LearnPage from "./pages/LearnPage";
import QuizModeSelectPage from "./pages/QuizModeSelectPage";
import QuizRunnerPage from "./pages/QuizRunnerPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/quiz" element={<QuizModeSelectPage />} />
      <Route path="/quiz/:modeId" element={<QuizRunnerPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
