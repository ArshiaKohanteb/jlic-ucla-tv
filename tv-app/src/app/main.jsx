import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Home from "./Home.jsx";
import "./app.css";

// Zmanim at the address itself; voting at #vote (uclaminyan.com/vote lands there too).
// The TV's check-in code (?here) goes straight to voting.
const voting = () => location.hash === "#vote" || new URLSearchParams(location.search).has("here");

function Site() {
  const [vote, setVote] = useState(voting);
  useEffect(() => {
    const on = () => setVote(voting());
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => { window.removeEventListener("hashchange", on); window.removeEventListener("popstate", on); };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [vote]);
  const go = (v) => { history.pushState(null, "", v ? "#vote" : location.pathname); setVote(v); };
  return vote ? <App onHome={() => go(false)} /> : <Home onVote={() => go(true)} />;
}

createRoot(document.getElementById("root")).render(<Site />);
