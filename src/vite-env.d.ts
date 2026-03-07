/// <reference types="vite/client" />

interface DbConfig {
	DB_USER: string;
	DB_HOST: string;
	DB_NAME: string;
	DB_PASSWORD: string;
	DB_PORT: string;
}

interface DbStartupPreferences {
	askOnStartup: boolean;
	configPath: string;
	currentConfig: DbConfig;
}

interface SaveDbConfigResult {
	canceled: boolean;
	filePath?: string;
}

interface ElectronBridgeApi {
	getAppVersion: () => Promise<string>;
	getAppPath: () => Promise<string>;
	platform: string;
	fetchNightcafe: (url: string) => Promise<unknown>;
	getDbStartupPreferences: () => Promise<DbStartupPreferences>;
	setDbAskOnStartup: (askOnStartup: boolean) => Promise<{ askOnStartup: boolean }>;
	saveCurrentDbConfigAs: () => Promise<SaveDbConfigResult>;
}

declare global {
	interface Window {
		electron?: ElectronBridgeApi;
		isElectron?: boolean;
	}
}

export {};
