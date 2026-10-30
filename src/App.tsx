import { createSignal } from "solid-js";
import logo from "./assets/logo.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name: name() }));
  }

  return (
    <main class="min-h-screen bg-canvas text-text-main flex flex-col items-center justify-center p-6">
      <div class="bg-card border border-card-border rounded-2xl p-8 max-w-md w-full shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-center space-y-6">
        <h1 class="text-2xl font-bold tracking-tight text-text-main">
          Welcome to Tauri + Solid
        </h1>

        <div class="flex justify-center items-center gap-6">
          <a href="https://vite.dev" target="_blank" rel="noreferrer">
            <img src="/vite.svg" class="h-12 w-12 hover:scale-105 transition-transform" alt="Vite logo" />
          </a>
          <a href="https://tauri.app" target="_blank" rel="noreferrer">
            <img src="/tauri.svg" class="h-12 w-12 hover:scale-105 transition-transform" alt="Tauri logo" />
          </a>
          <a href="https://solidjs.com" target="_blank" rel="noreferrer">
            <img src={logo} class="h-12 w-12 hover:scale-105 transition-transform" alt="Solid logo" />
          </a>
        </div>

        <p class="text-xs text-text-muted">
          Click on the Tauri, Vite, and Solid logos to learn more.
        </p>

        <form
          class="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}
        >
          <input
            id="greet-input"
            class="flex-1 bg-white border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a name..."
          />
          <button
            type="submit"
            class="bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-medium px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
          >
            Greet
          </button>
        </form>

        {greetMsg() && (
          <p class="p-3 bg-primary-light border border-primary/20 rounded-xl text-xs font-semibold text-primary">
            {greetMsg()}
          </p>
        )}
      </div>
    </main>
  );
}

export default App;
