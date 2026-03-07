import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./pages/Home";
import { Merge } from "./pages/Merge";
import { Extract } from "./pages/Extract";
import { Compress } from "./pages/Compress";
import { Edit } from "./pages/Edit";

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-background text-foreground font-sans antialiased overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-background/50">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/merge" element={<Merge />} />
            <Route path="/extract" element={<Extract />} />
            <Route path="/compress" element={<Compress />} />
            <Route path="/edit" element={<Edit />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
