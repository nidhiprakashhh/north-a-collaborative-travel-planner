interface EnvConfig {
  apiUrl: string;
}

export const env: EnvConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
};
