import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import Studio from "./pages/Studio";
import Library from "./pages/Library";

import CloningVoice from "./pages/CloningVoice";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Studio />} />
          <Route path="library" element={<Library />} />
          <Route path="cloning-voice" element={<CloningVoice />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
