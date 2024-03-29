import { defineConfig } from "vite";
import { tauri } from "./vite.plugin.tauri";

export default defineConfig(async () => {
    return {
        // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`

        plugins: [tauri()],
        // 1. prevent vite from obscuring rust errors
        clearScreen: false,
        // 2. tauri expects a fixed port, fail if that port is not available
        server: {
            port: 1420,
            strictPort: true,
        },
        // 3. to make use of `TAURI_DEBUG` and other env variables
        // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
        envPrefix: ["VITE_", "TAURI_"],
    };
});
