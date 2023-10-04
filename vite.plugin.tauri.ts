import { dirname, join, relative, resolve } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { Plugin, ResolvedConfig } from "vite";
import { run } from "@tauri-apps/cli";

export interface TauriOptions {
    debug?: boolean;
    target?: string;
    verbose?: boolean;
}

async function search(pattern: RegExp, {
    workPath = process.cwd(),
    ignorePatterns = [/node_modules/, /target/],
    maxDepth = 3
} = {}): Promise<string[]> {
    const tasks = (await readdir(workPath).catch(() => [])).map(async (entry): Promise<string[]> => {
        if (ignorePatterns.some(ignorePattern => ignorePattern.test(entry))) return [];

        const fullPath = join(workPath, entry);
        const stats = await stat(fullPath).catch(() => null);
        if (!stats) return [];
        if (stats.isDirectory() && maxDepth !== 0) {
            return search(pattern, { workPath: fullPath, ignorePatterns, maxDepth: maxDepth - 1 });
        } else if (stats.isFile() && pattern.test(entry)) {
            return [fullPath];
        }
        return [];
    });

    return (await Promise.all(tasks)).flat();
}

const getTauriConfPath = async () => {
    const results = await search(/(tauri\.conf\.(json|json5)|Tauri\.toml)$/);
    if (results.length === 0) return null;
    const result = results[0];
    console.info(result);
    return result;
};

export function tauri(options?: TauriOptions): Plugin[] {
    let viteConfig: ResolvedConfig;

    return [
        {
            name: "vite-plugin-tauri:serve",
            apply: "serve",
            enforce: "post",
            configResolved(config) { viteConfig = config; },
            async configureServer(server) {
                if (await getTauriConfPath() === null) process.exit(0);

                server.httpServer?.once("listening", () => {
                    const localhosts = ["localhost", "127.0.0.1", "::1", "0000:0000:0000:0000:0000:0000:0000:0001"];

                    const address = server.httpServer?.address();
                    if (!address || typeof address === "string") {
                        console.error("Unexpected dev server address", address);
                        process.exit(1);
                    }

                    const args = ["dev", "--config", JSON.stringify({
                        build: {
                            devPath: `${server.config.server.https ? "https" : "http"}://${localhosts.includes(address.address) ? "localhost" : address.address}:${address.port}`
                        }
                    })];

                    if (options?.debug !== undefined && !options?.debug) args.push("--release");
                    if (options?.target) args.push("--target", options.target);
                    if (options?.verbose) args.push("--verbose");

                    run(args, "vite-plugin-tauri");
                });
            },
        },
        {
            name: "vite-plugin-tauri:build",
            apply: "build",
            enforce: "post",
            configResolved(config) { viteConfig = config; },
            async closeBundle() {
                const paths = await getTauriConfPath();
                if (paths === null) process.exit(0);

                const args = ["build", "--config", JSON.stringify({
                    build: {
                        distDir: relative(dirname(paths[0]), resolve(viteConfig.build.outDir))
                    },
                })];

                if (options?.debug) args.push("--debug");
                if (options?.target) args.push("--target", options.target);
                if (options?.verbose) args.push("--verbose");

                await run(args, "vite-plugin-tauri");
            },
        },
    ];
}
